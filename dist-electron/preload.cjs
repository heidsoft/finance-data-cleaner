"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => electron.ipcRenderer.invoke("dialog:openFile"),
  saveFile: (defaultName) => electron.ipcRenderer.invoke("dialog:saveFile", defaultName),
  readFile: (filePath) => electron.ipcRenderer.invoke("file:read", filePath),
  writeFile: (filePath, data) => electron.ipcRenderer.invoke("file:write", filePath, data)
});
