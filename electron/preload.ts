import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, data: string | ArrayBuffer) => ipcRenderer.invoke('file:write', filePath, data),
})

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<Electron.OpenDialogReturnValue>
      saveFile: (defaultName: string) => Promise<Electron.SaveDialogReturnValue>
      readFile: (filePath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>
      writeFile: (filePath: string, data: string | ArrayBuffer) => Promise<{ success: boolean; error?: string }>
    }
  }
}