const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  closeWindow:    () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),

  // 核心操作
  scan:           () => ipcRenderer.invoke('scan'),
  clean:          (results) => ipcRenderer.invoke('clean', results),

  // 权限
  checkAdmin:     () => ipcRenderer.invoke('check-admin'),
  restartAdmin:   () => ipcRenderer.invoke('restart-admin'),

  // 类别定义
  getCategories:  () => ipcRenderer.invoke('get-categories'),

  // 进度监听（主进程 → 渲染进程）
  onScanProgress:  (cb) => {
    const handler = (_e, progress) => cb(progress);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },
  onCleanProgress: (cb) => {
    const handler = (_e, progress) => cb(progress);
    ipcRenderer.on('clean:progress', handler);
    return () => ipcRenderer.removeListener('clean:progress', handler);
  },
});
