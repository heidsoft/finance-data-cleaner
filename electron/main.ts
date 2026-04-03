import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

console.log('App starting...')

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

function createWindow() {
  console.log('Creating main window...')
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '财务数据清洗工具',
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading dev server:', process.env.VITE_DEV_SERVER_URL)
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    console.log('Loading production build')
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    console.log('Window closed')
  })
}

app.whenReady().then(() => {
  console.log('App ready')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  console.log('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC: 打开文件对话框
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '数据文件', extensions: ['csv', 'xlsx', 'xls'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  return result
})

// IPC: 保存文件对话框
ipcMain.handle('dialog:saveFile', async (_, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx'] },
      { name: 'CSV 文件', extensions: ['csv'] }
    ]
  })
  return result
})

// IPC: 读取文件内容（主进程读取，传回 Buffer）
ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return { success: true, buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// IPC: 写入文件内容
ipcMain.handle('file:write', async (_, filePath: string, data: string | Buffer) => {
  try {
    fs.writeFileSync(filePath, data)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})