const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 740,
    backgroundColor: "#f6f7fb",
    resizable: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pick-input-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("pick-output-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("list-images", async (_event, folderPath) => {
  if (!folderPath) {
    return [];
  }
  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(folderPath, name));
  return files;
});

ipcMain.handle("read-image-data-url", async (_event, filePath) => {
  if (!filePath) {
    return null;
  }
  const buffer = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "png";
  const base64 = buffer.toString("base64");
  return `data:image/${ext};base64,${base64}`;
});

ipcMain.handle("export-buffer", async (_event, buffer, outPath) => {
  if (!buffer || !outPath) {
    return false;
  }
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await fs.promises.writeFile(outPath, data);
  return true;
});
