import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
})

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<Electron.OpenDialogReturnValue>
      saveFile: (defaultName: string) => Promise<Electron.SaveDialogReturnValue>
    }
  }
}