use image::imageops::FilterType;
use image::{DynamicImage, Rgba};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static EXPORT_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Deserialize, Serialize, Clone)]
struct CropRect {
  x: u32,
  y: u32,
  w: u32,
  h: u32,
}

#[derive(Debug, Serialize)]
struct ImageEntry {
  path: String,
  name: String,
  ext: String,
}

#[derive(Serialize, Clone)]
struct ExportProgress {
  currentIndex: u32,
  total: u32,
  fileName: String,
}

#[derive(Debug, Serialize)]
struct ExportSummary {
  exported: u32,
  skipped: u32,
  errors: Vec<String>,
}

#[tauri::command]
fn export_single(
  input_path: String,
  output_path: String,
  crop: CropRect,
  shape: String,
  radius_px: u32,
  inset_px: u32,
  target_w: u32,
  target_h: u32,
  transparent_png: bool,
) -> Result<(), String> {
  let image = image::open(&input_path)
    .map_err(|err| format!("Load failed: {err}"))?
    .to_rgba8();
  let (width, height) = image.dimensions();

  if crop.w == 0 || crop.h == 0 {
    return Err("Crop size must be greater than zero.".into());
  }
  if crop.x >= width
    || crop.y >= height
    || crop.x + crop.w > width
    || crop.y + crop.h > height
  {
    return Err("Crop rectangle is out of bounds.".into());
  }

  let mut cropped = image::imageops::crop_imm(&image, crop.x, crop.y, crop.w, crop.h).to_image();

  if shape == "rounded" {
    apply_rounded_mask(&mut cropped, radius_px, inset_px, transparent_png)?;
  }

  let resized = image::imageops::resize(&cropped, target_w, target_h, FilterType::Lanczos3);
  write_png(&DynamicImage::ImageRgba8(resized), &output_path)?;
  Ok(())
}

#[tauri::command]
fn cancel_export() {
  EXPORT_CANCELLED.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn list_images_in_dir(input_dir: String) -> Result<Vec<ImageEntry>, String> {
  let entries = std::fs::read_dir(&input_dir)
    .map_err(|err| format!("Read folder failed: {err}"))?;
  let mut images = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|err| format!("Read entry failed: {err}"))?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let ext = match path.extension().and_then(|ext| ext.to_str()) {
      Some(ext) => ext.to_lowercase(),
      None => continue,
    };
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") {
      continue;
    }
    let name = path
      .file_name()
      .and_then(|name| name.to_str())
      .unwrap_or("image")
      .to_string();
    images.push(ImageEntry {
      path: path.to_string_lossy().to_string(),
      name,
      ext,
    });
  }
  images.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(images)
}

#[tauri::command]
fn export_batch(
  app: tauri::AppHandle,
  input_dir: String,
  output_dir: String,
  crop: CropRect,
  shape: String,
  radius_px: u32,
  inset_px: u32,
  target_w: u32,
  target_h: u32,
  transparent_png: bool,
  filename_mode: String,
) -> Result<ExportSummary, String> {
  EXPORT_CANCELLED.store(false, Ordering::SeqCst);

  let images = list_images_in_dir(input_dir)?;
  let total = images.len() as u32;
  if total == 0 {
    return Ok(ExportSummary {
      exported: 0,
      skipped: 0,
      errors: vec!["No supported images found.".into()],
    });
  }

  let name_suffix = match filename_mode.as_str() {
    "ui" => "",
    "cropped" => "_cropped",
    _ => return Err("Invalid filename mode.".into()),
  };

  let mut summary = ExportSummary {
    exported: 0,
    skipped: 0,
    errors: Vec::new(),
  };

  for (index, entry) in images.iter().enumerate() {
    if EXPORT_CANCELLED.load(Ordering::SeqCst) {
      summary.errors.push("Export cancelled.".into());
      break;
    }

    let _ = app.emit(
      "export_progress",
      ExportProgress {
        currentIndex: (index + 1) as u32,
        total,
        fileName: entry.name.clone(),
      },
    );

    let image = match image::open(&entry.path) {
      Ok(image) => image.to_rgba8(),
      Err(err) => {
        summary
          .errors
          .push(format!("{}: Load failed: {err}", entry.name));
        continue;
      }
    };
    let (width, height) = image.dimensions();

    if crop.w == 0 || crop.h == 0 {
      summary
        .errors
        .push(format!("{}: Crop size must be greater than zero.", entry.name));
      continue;
    }

    if crop.x >= width
      || crop.y >= height
      || crop.x + crop.w > width
      || crop.y + crop.h > height
    {
      summary.skipped += 1;
      continue;
    }

    let mut cropped = image::imageops::crop_imm(&image, crop.x, crop.y, crop.w, crop.h).to_image();

    if shape == "rounded" {
      if let Err(err) = apply_rounded_mask(&mut cropped, radius_px, inset_px, transparent_png) {
        summary.errors.push(format!("{}: {err}", entry.name));
        continue;
      }
    }

    let resized = image::imageops::resize(&cropped, target_w, target_h, FilterType::Lanczos3);

    let stem = Path::new(&entry.path)
      .file_stem()
      .and_then(|stem| stem.to_str())
      .unwrap_or("image");
    let file_name = format!("{stem}{name_suffix}.png");
    let output_path = Path::new(&output_dir).join(file_name);

    if let Err(err) = write_png(&DynamicImage::ImageRgba8(resized), &output_path.to_string_lossy()) {
      summary
        .errors
        .push(format!("{}: {err}", entry.name));
      continue;
    }

    summary.exported += 1;
  }

  Ok(summary)
}

fn apply_rounded_mask(
  image: &mut image::RgbaImage,
  radius_px: u32,
  inset_px: u32,
  transparent_png: bool,
) -> Result<(), String> {
  let (width, height) = image.dimensions();
  if width == 0 || height == 0 {
    return Err("Image has invalid dimensions.".into());
  }

  let inset = inset_px.min(width / 2).min(height / 2) as f32;
  let inner_w = (width as f32 - inset * 2.0).max(0.0);
  let inner_h = (height as f32 - inset * 2.0).max(0.0);
  if inner_w <= 0.0 || inner_h <= 0.0 {
    return Err("Inset is too large for the crop size.".into());
  }

  let max_radius = (inner_w.min(inner_h) / 2.0).max(0.0);
  let radius = (radius_px as f32).min(max_radius);
  let radius_sq = radius * radius;

  let left = inset;
  let top = inset;
  let right = inset + inner_w;
  let bottom = inset + inner_h;

  for y in 0..height {
    for x in 0..width {
      let xf = x as f32 + 0.5;
      let yf = y as f32 + 0.5;
      let inside = if radius == 0.0 {
        xf >= left && xf <= right && yf >= top && yf <= bottom
      } else if xf >= left + radius && xf <= right - radius {
        yf >= top && yf <= bottom
      } else if yf >= top + radius && yf <= bottom - radius {
        xf >= left && xf <= right
      } else {
        let (cx, cy) = if xf < left + radius {
          if yf < top + radius {
            (left + radius, top + radius)
          } else {
            (left + radius, bottom - radius)
          }
        } else if yf < top + radius {
          (right - radius, top + radius)
        } else {
          (right - radius, bottom - radius)
        };
        let dx = xf - cx;
        let dy = yf - cy;
        dx * dx + dy * dy <= radius_sq
      };

      if !inside {
        if transparent_png {
          image.put_pixel(x, y, Rgba([0, 0, 0, 0]));
        } else {
          image.put_pixel(x, y, Rgba([255, 255, 255, 255]));
        }
      }
    }
  }

  Ok(())
}

fn write_png(image: &DynamicImage, output_path: &str) -> Result<(), String> {
  let path = Path::new(output_path);
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|err| format!("Create folder failed: {err}"))?;
  }
  image
    .save(path)
    .map_err(|err| format!("Write failed: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      export_single,
      export_batch,
      list_images_in_dir,
      cancel_export
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
