const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  scan: () => ipcRenderer.invoke('scan'),
  clean: (results) => ipcRenderer.invoke('clean', results),
  checkAdmin: () => ipcRenderer.invoke('check-admin'),
  restartAdmin: () => ipcRenderer.invoke('restart-admin'),
});
