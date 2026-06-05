const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Cleaner } = require('./backend/cleaner');

let mainWindow;
let cleaner;

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
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  cleaner = new Cleaner();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('window:close', () => mainWindow.close());
ipcMain.handle('window:minimize', () => mainWindow.minimize());

ipcMain.handle('scan', async () => {
  return await cleaner.scanAll();
});

ipcMain.handle('clean', async (event, scanResults) => {
  return await cleaner.cleanAll(scanResults);
});

ipcMain.handle('check-admin', () => {
  return cleaner.isAdmin();
});

ipcMain.handle('restart-admin', async () => {
  return await cleaner.restartAsAdmin();
});
