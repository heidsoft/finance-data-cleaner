/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    openFile: () => Promise<{
      canceled: boolean
      filePaths: string[]
    }>
    saveFile: (defaultName: string) => Promise<{
      canceled: boolean
      filePath?: string
    }>
  }
}