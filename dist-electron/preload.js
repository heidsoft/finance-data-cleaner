"use strict";const e=require("electron");e.contextBridge.exposeInMainWorld("electronAPI",{openFile:()=>e.ipcRenderer.invoke("dialog:openFile"),saveFile:i=>e.ipcRenderer.invoke("dialog:saveFile",i)});
