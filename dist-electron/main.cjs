"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
console.log("App starting...");
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
function createWindow() {
  console.log("Creating main window...");
  const win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "财务数据清洗工具"
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log("Loading dev server:", process.env.VITE_DEV_SERVER_URL);
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    console.log("Loading production build");
    win.loadFile(path.join(__dirname, "../dist/index.html"));
    win.webContents.openDevTools();
  }
  win.on("closed", () => {
    console.log("Window closed");
  });
}
electron.app.whenReady().then(() => {
  console.log("App ready");
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  console.log("All windows closed");
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("dialog:openFile", async () => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "数据文件", extensions: ["csv", "xlsx", "xls"] },
      { name: "所有文件", extensions: ["*"] }
    ]
  });
  return result;
});
electron.ipcMain.handle("dialog:saveFile", async (_, defaultName) => {
  const result = await electron.dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: "Excel 文件", extensions: ["xlsx"] },
      { name: "CSV 文件", extensions: ["csv"] }
    ]
  });
  return result;
});
electron.ipcMain.handle("file:read", async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("file:write", async (_, filePath, data) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
