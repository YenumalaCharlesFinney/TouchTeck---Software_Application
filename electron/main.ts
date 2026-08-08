import { app, BrowserWindow, Menu } from 'electron';
import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import log from 'electron-log/main';

log.initialize();
log.transports.file.level = 'info';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let bridgeProcess: ChildProcess | null = null;

function startBridge() {
  const bridgeScriptPath = path.join(app.getAppPath(), 'bridge', 'serial-bridge.js');
  log.info(`Starting ARES21 serial bridge: ${bridgeScriptPath}`);

  bridgeProcess = fork(bridgeScriptPath, [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    silent: true,
  });

  bridgeProcess.stdout?.on('data', (chunk) => {
    log.info(`[bridge] ${chunk.toString().trim()}`);
  });
  bridgeProcess.stderr?.on('data', (chunk) => {
    log.error(`[bridge] ${chunk.toString().trim()}`);
  });
  bridgeProcess.on('exit', (code) => {
    log.warn(`[bridge] process exited with code ${code}`);
    bridgeProcess = null;
  });
}

function stopBridge() {
  if (bridgeProcess) {
    bridgeProcess.kill();
    bridgeProcess = null;
  }
}

function setAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{ role: 'appMenu' as const }]
      : []),
    { role: 'editMenu' as const },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'TouchTeck',
    backgroundColor: '#0b0f19',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setAppMenu();
  startBridge();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBridge();
});
