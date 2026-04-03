import { contextBridge, ipcRenderer } from 'electron'
import { Buffer } from 'buffer'

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose Buffer for xlsx in renderer
  Buffer: Buffer,
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', filePath, data),
})