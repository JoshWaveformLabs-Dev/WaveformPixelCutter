const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("waveformApi", {
  pickInputFolder: () => ipcRenderer.invoke("pick-input-folder"),
  pickOutputFolder: () => ipcRenderer.invoke("pick-output-folder"),
  listImages: (folderPath) => ipcRenderer.invoke("list-images", folderPath),
  readImageAsDataUrl: (filePath) =>
    ipcRenderer.invoke("read-image-data-url", filePath),
  exportBufferToFile: (buffer, outPath) =>
    ipcRenderer.invoke("export-buffer", buffer, outPath)
});
