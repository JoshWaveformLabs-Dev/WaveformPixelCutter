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
});

clearThumbnails();
