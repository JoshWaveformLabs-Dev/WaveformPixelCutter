const inputButton = document.querySelector('[data-role="input-folder"]');
const outputButton = document.querySelector('[data-role="output-folder"]');
const inputPathLabel = document.querySelector('[data-role="input-path"]');
const outputPathLabel = document.querySelector('[data-role="output-path"]');
const thumbGrid = document.querySelector('[data-role="thumb-grid"]');
const imageCountLabel = document.querySelector('[data-role="image-count"]');
const previewImage = document.querySelector('[data-role="preview-image"]');
const previewPlaceholder = document.querySelector(
  '[data-role="preview-placeholder"]'
);
const previewCard = document.querySelector(".preview-card");
const exportButton = document.querySelector('[data-role="export-button"]');
const formatChips = Array.from(document.querySelectorAll(".chip"));

let inputFolder = null;
let outputFolder = null;
let selectedImagePath = null;
let selectedFormat = "png";
const TARGET_ASPECT = 4 / 3;
const MASK_RADIUS_PX = 18;

function setImageCount(count) {
  imageCountLabel.textContent = `${count} Images`;
}

function clearThumbnails() {
  thumbGrid.innerHTML = "";
  const placeholder = document.createElement("div");
  placeholder.className = "thumb-card thumb-placeholder";
  placeholder.textContent = "No images";
  thumbGrid.appendChild(placeholder);
}

function setPreviewImage(dataUrl) {
  if (!dataUrl) {
    previewCard.classList.remove("has-image");
    previewImage.removeAttribute("src");
    previewPlaceholder.style.display = "block";
    exportButton.disabled = true;
    return;
  }
  previewImage.src = dataUrl;
  previewCard.classList.add("has-image");
  previewPlaceholder.style.display = "none";
  exportButton.disabled = false;
}

function updateSelectedThumb(targetCard) {
  document.querySelectorAll(".thumb-card").forEach((card) => {
    card.classList.toggle("is-selected", card === targetCard);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getCenteredCropRect(srcWidth, srcHeight, targetAspect) {
  const srcAspect = srcWidth / srcHeight;
  if (srcAspect > targetAspect) {
    const cropWidth = Math.round(srcHeight * targetAspect);
    return {
      x: Math.round((srcWidth - cropWidth) / 2),
      y: 0,
      width: cropWidth,
      height: srcHeight
    };
  }
  const cropHeight = Math.round(srcWidth / targetAspect);
  return {
    x: 0,
    y: Math.round((srcHeight - cropHeight) / 2),
    width: srcWidth,
    height: cropHeight
  };
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function exportCroppedImage() {
  const dataUrl = await window.waveformApi.readImageAsDataUrl(selectedImagePath);
  const img = await loadImageFromDataUrl(dataUrl);
  const crop = getCenteredCropRect(img.naturalWidth, img.naturalHeight, TARGET_ASPECT);
  const outWidth = crop.width;
  const outHeight = crop.height;

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, outWidth, outHeight);

  ctx.save();
  drawRoundedRectPath(ctx, 0, 0, outWidth, outHeight, MASK_RADIUS_PX);
  ctx.clip();
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outWidth,
    outHeight
  );
  ctx.restore();

  console.log("Export crop", crop, "output", { width: outWidth, height: outHeight }, "source", selectedImagePath);

  const mime =
    selectedFormat === "jpg" || selectedFormat === "jpeg"
      ? "image/jpeg"
      : selectedFormat === "webp"
        ? "image/webp"
        : "image/png";

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime)
  );
  if (!blob) {
    throw new Error("Failed to create export image.");
  }

  const buffer = new Uint8Array(await blob.arrayBuffer());
  const fileName = selectedImagePath.split(/[\\/]/).pop() || "export";
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const extension = selectedFormat === "jpg" ? "jpg" : selectedFormat;
  const outputPath = `${outputFolder}\\${baseName}-cropped.${extension}`;

  await window.waveformApi.exportBufferToFile(buffer, outputPath);
}

async function refreshThumbnails() {
  if (!inputFolder) {
    clearThumbnails();
    setImageCount(0);
    setPreviewImage(null);
    return;
  }

  const paths = await window.waveformApi.listImages(inputFolder);
  thumbGrid.innerHTML = "";

  if (!paths.length) {
    clearThumbnails();
    setImageCount(0);
    setPreviewImage(null);
    return;
  }

  setImageCount(paths.length);

  const dataUrls = await Promise.all(
    paths.map((filePath) => window.waveformApi.readImageAsDataUrl(filePath))
  );

  dataUrls.forEach((dataUrl, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "thumb-card";
    card.dataset.path = paths[index];

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Thumbnail";
    card.appendChild(img);

    card.addEventListener("click", () => {
      selectedImagePath = paths[index];
      updateSelectedThumb(card);
      setPreviewImage(dataUrl);
    });

    thumbGrid.appendChild(card);
  });

  selectedImagePath = null;
  setPreviewImage(null);
}

inputButton.addEventListener("click", async () => {
  const folder = await window.waveformApi.pickInputFolder();
  if (!folder) {
    return;
  }
  inputFolder = folder;
  inputPathLabel.textContent = folder;
  await refreshThumbnails();
});

outputButton.addEventListener("click", async () => {
  const folder = await window.waveformApi.pickOutputFolder();
  if (!folder) {
    return;
  }
  outputFolder = folder;
  outputPathLabel.textContent = folder;
});

formatChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    formatChips.forEach((item) => item.classList.remove("is-selected"));
    chip.classList.add("is-selected");
    selectedFormat = chip.dataset.format || "png";
  });
});

exportButton.addEventListener("click", () => {
  if (!selectedImagePath || !outputFolder) {
    return;
  }
  exportCroppedImage().catch((error) => {
    console.error("Export failed:", error);
  });
});

clearThumbnails();
