// 检测 ELECTRON_RUN_AS_NODE 误设置（必须在 require('electron') 之前）
if (process.env.ELECTRON_RUN_AS_NODE) {
  const { app: _app, dialog } = require('electron');
  _app.whenReady().then(() => {
    dialog.showErrorBox('ComClean 启动失败',
      '检测到 ELECTRON_RUN_AS_NODE=1 环境变量。\n'
      + '请移除该环境变量后重试。\n\n'
      + 'CMD:  set ELECTRON_RUN_AS_NODE=\n'
      + 'Bash: unset ELECTRON_RUN_AS_NODE');
    _app.quit();
  });
} else {
  const { app, BrowserWindow, ipcMain } = require('electron');
  const path = require('path');

  // ---- 延迟加载重模块，不在启动路径上阻塞 ----
  /** @type {import('./backend/cleaner').Cleaner} */
  let cleaner = null;
  /** @type {import('./backend/logger')} */
  let log = null;

  function getCleaner() {
    if (!cleaner) {
      const { Cleaner } = require('./backend/cleaner');
      cleaner = new Cleaner();
    }
    return cleaner;
  }

  function getLogger() {
    if (!log) {
      log = require('./backend/logger');
    }
    return log;
  }

  // ---- 窗口 ----
  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 780,
      height: 620,
      minWidth: 680,
      minHeight: 540,
      resizable: true,
      frame: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      backgroundColor: '#f0f2f5',
      show: true, // 立即显示，消除白屏等待
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // 如果窗口加载慢，ready-to-show 时确保显示
    mainWindow.once('ready-to-show', () => {
      if (!mainWindow.isVisible()) mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  function guardWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Window unavailable');
  }

  // ---- IPC 路由 ----
  ipcMain.handle('window:close', () => {
    guardWindow();
    mainWindow.close();
  });

  ipcMain.handle('window:minimize', () => {
    guardWindow();
    mainWindow.minimize();
  });

  ipcMain.handle('scan', async () => {
    guardWindow();
    const c = getCleaner();
    const results = await c.scanAll((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:progress', progress);
      }
    });
    getLogger().info(`Scan complete: ${results.length} categories`);
    return results;
  });

  ipcMain.handle('clean', async (_event, scanResults) => {
    guardWindow();
    const c = getCleaner();
    const summary = await c.cleanAll(scanResults, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clean:progress', progress);
      }
    });
    getLogger().info(`Clean complete: ${summary.totalFreed} bytes freed`);
    return summary;
  });

  ipcMain.handle('check-admin', () => {
    return getCleaner().isAdmin();
  });

  ipcMain.handle('restart-admin', async () => {
    const exePath = app.getPath('exe');
    return await getCleaner().restartAsAdmin(exePath);
  });

  ipcMain.handle('get-categories', () => {
    const { Cleaner } = require('./backend/cleaner');
    return Cleaner.getCategories();
  });

  // ---- 启动 ----
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
