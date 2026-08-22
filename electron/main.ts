import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
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
    try {
      if (process.platform === 'win32' && bridgeProcess.pid) {
        const { execSync } = require('node:child_process');
        execSync(`taskkill /F /T /PID ${bridgeProcess.pid}`, { stdio: 'ignore' });
      } else {
        bridgeProcess.kill('SIGKILL');
      }
    } catch (e) {
      // process already exited
    }
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

function createWindow(initialTab?: string) {
  const isSecondary = Boolean(initialTab);

  const appIcon = process.platform === 'win32'
    ? (fs.existsSync(path.join(__dirname, '../build/icon.ico'))
        ? path.join(__dirname, '../build/icon.ico')
        : path.join(__dirname, '../public/favicon.ico'))
    : (fs.existsSync(path.join(__dirname, '../build/icon.icns'))
        ? path.join(__dirname, '../build/icon.icns')
        : path.join(__dirname, '../public/logo.png'));

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'TouchTeck',
    backgroundColor: '#0b0f19',
    show: false,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A scoreboard on a second screen is usually the unfocused window.
      // Without this Chromium throttles it to a crawl, which would stall the
      // very display the crowd is watching.
      backgroundThrottling: false,
    },
  });

  if (!isSecondary) mainWindow = win;

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') win.webContents.toggleDevTools();
  });

  // The tab is carried in the hash — a query string would not survive
  // loadFile, and the hash is available to the renderer before first paint.
  const hash = initialTab ? `tab=${initialTab}` : '';

  if (isDev) {
    win.loadURL(`http://localhost:5173${hash ? '#' + hash : ''}`);
    if (!isSecondary) win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), hash ? { hash } : undefined);
  }

  win.on('close', () => {
    if (win === mainWindow) {
      stopBridge();
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) {
          w.destroy();
        }
      }
      app.quit();
    }
  });

  win.on('closed', () => {
    if (win === mainWindow) mainWindow = null;
  });

  return win;
}

/* Every window runs the same app against the same database. Timing state is
   already broadcast between contexts on a BroadcastChannel, but that channel is
   scoped to an origin and the packaged app is served from file://, so windows
   cannot be relied on to hear each other directly. Relaying through the main
   process makes the sync explicit and origin-independent. */
function wireWindowIpc() {
  ipcMain.handle('touchteck:open-tab-window', (_event, tabId: unknown) => {
    if (typeof tabId !== 'string' || !/^[a-z-]+$/.test(tabId)) return false;
    createWindow(tabId);
    return true;
  });

  ipcMain.handle('touchteck:print-html', async (_event, html: string) => {
    if (typeof html !== 'string') return false;

    const printWin = new BrowserWindow({
      show: false,
      title: 'TouchTeck Print',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await printWin.loadURL(dataUrl);

    printWin.webContents.print(
      {
        silent: false,
        printBackground: true,
        color: true,
      },
      (success, failureReason) => {
        if (!success) {
          log.warn(`[print] Print result: ${failureReason}`);
        }
        if (!printWin.isDestroyed()) {
          printWin.close();
        }
      }
    );

    return true;
  });

  ipcMain.handle('touchteck:open-data-folder', async (_event, meetName?: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const baseDir = path.join(desktopDir, 'TouchTeck_Data');
      const cleanMeet = (meetName || 'Default_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const meetEventsDir = path.join(baseDir, 'Meets', cleanMeet, 'events');
      if (!fs.existsSync(meetEventsDir)) {
        fs.mkdirSync(meetEventsDir, { recursive: true });
      }
      shell.openPath(meetEventsDir);
      return meetEventsDir;
    } catch (e) {
      log.error('Failed to open data folder:', e);
      return null;
    }
  });

  ipcMain.handle('touchteck:write-event-file', async (_event, meetName: string, fileName: string, content: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const baseDir = path.join(desktopDir, 'TouchTeck_Data');
      const cleanMeet = (meetName || 'Default_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const meetEventsDir = path.join(baseDir, 'Meets', cleanMeet, 'events');
      if (!fs.existsSync(meetEventsDir)) {
        fs.mkdirSync(meetEventsDir, { recursive: true });
      }
      const filePath = path.join(meetEventsDir, fileName);
      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    } catch (e) {
      log.error('Failed to write event file:', e);
      return null;
    }
  });

  ipcMain.handle('touchteck:write-meet-file', async (_event, meetName: string, subPath: string, content: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const baseDir = path.join(desktopDir, 'TouchTeck_Data');
      const cleanMeet = (meetName || 'Default_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetFilePath = path.join(baseDir, 'Meets', cleanMeet, subPath);
      const targetDir = path.dirname(targetFilePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, content, 'utf8');
      return targetFilePath;
    } catch (e) {
      log.error('Failed to write meet file:', e);
      return null;
    }
  });

  ipcMain.handle('touchteck:list-disk-meets', async () => {
    try {
      const desktopDir = app.getPath('desktop');
      const baseMeetsDir = path.join(desktopDir, 'TouchTeck_Data', 'Meets');
      if (!fs.existsSync(baseMeetsDir)) {
        fs.mkdirSync(baseMeetsDir, { recursive: true });
        return [];
      }
      const entries = fs.readdirSync(baseMeetsDir, { withFileTypes: true });
      const meetsList = [];

      for (const ent of entries) {
        if (ent.isDirectory()) {
          const meetFolderPath = path.join(baseMeetsDir, ent.name);
          const meetInfoPath = path.join(meetFolderPath, 'meet_info.json');
          const swimmersPath = path.join(meetFolderPath, 'swimmers.json');
          const eventsDir = path.join(meetFolderPath, 'events');

          let meetInfo: any = null;
          if (fs.existsSync(meetInfoPath)) {
            try {
              meetInfo = JSON.parse(fs.readFileSync(meetInfoPath, 'utf8'));
            } catch {}
          }

          let eventFiles: string[] = [];
          if (fs.existsSync(eventsDir)) {
            eventFiles = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'));
          }

          meetsList.push({
            folderName: ent.name,
            displayName: meetInfo?.name || ent.name.replace(/_/g, ' '),
            date: meetInfo?.date || '',
            location: meetInfo?.location || '',
            poolType: meetInfo?.poolType || '50m',
            lanes: meetInfo?.lanes || 8,
            hasMeetInfo: !!meetInfo,
            eventFileCount: eventFiles.length,
            hasSwimmers: fs.existsSync(swimmersPath)
          });
        }
      }
      return meetsList;
    } catch (e) {
      log.error('Failed to list disk meets:', e);
      return [];
    }
  });

  ipcMain.handle('touchteck:read-disk-meet-events', async (_event, folderName: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const eventsDir = path.join(desktopDir, 'TouchTeck_Data', 'Meets', folderName, 'events');
      if (!fs.existsSync(eventsDir)) return [];
      const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'));
      const parsedEvents = [];
      for (const f of files) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(eventsDir, f), 'utf8'));
          parsedEvents.push(content);
        } catch {}
      }
      return parsedEvents;
    } catch (e) {
      log.error('Failed to read disk meet events:', e);
      return [];
    }
  });

  ipcMain.handle('touchteck:move-meet-to-recovery-bin', async (_event, meetName: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const baseDir = path.join(desktopDir, 'TouchTeck_Data');
      const cleanMeet = (meetName || 'Default_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sourceMeetDir = path.join(baseDir, 'Meets', cleanMeet);
      const recoveryBaseDir = path.join(baseDir, 'Recovery_Bin');

      if (!fs.existsSync(recoveryBaseDir)) {
        fs.mkdirSync(recoveryBaseDir, { recursive: true });
      }

      if (fs.existsSync(sourceMeetDir)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const targetRecoveryDir = path.join(recoveryBaseDir, `${cleanMeet}_deleted_${timestamp}`);
        fs.renameSync(sourceMeetDir, targetRecoveryDir);
        log.info(`[Recovery_Bin] Successfully moved deleted meet '${cleanMeet}' to '${targetRecoveryDir}'`);
        return targetRecoveryDir;
      }
      return null;
    } catch (e) {
      log.error('Failed to move meet to recovery bin:', e);
      return null;
    }
  });

  ipcMain.handle('touchteck:archive-deleted-results', async (_event, meetName: string, eventName: string, resultsJson: string) => {
    try {
      const desktopDir = app.getPath('desktop');
      const cleanMeet = (meetName || 'Championship').replace(/[^a-zA-Z0-9_-]/g, '_');
      const recoveryDir = path.join(desktopDir, 'TouchTeck_Data', 'Meets', cleanMeet, 'Recovery_Bin', 'Deleted_Results');
      if (!fs.existsSync(recoveryDir)) {
        fs.mkdirSync(recoveryDir, { recursive: true });
      }
      const cleanEvent = (eventName || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const targetFile = path.join(recoveryDir, `${cleanEvent}_deleted_${timestamp}.json`);
      fs.writeFileSync(targetFile, resultsJson, 'utf8');
      log.info(`[Recovery_Bin] Archived deleted results to: ${targetFile}`);
      return targetFile;
    } catch (e) {
      log.error('Failed to archive deleted results:', e);
      return null;
    }
  });

  ipcMain.handle('touchteck:write-batch-meet-files', async (_event, meetName: string, files: Array<{ subPath: string; content: string }>) => {
    try {
      const desktopDir = app.getPath('desktop');
      const cleanMeet = (meetName || 'Championship_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const meetDir = path.join(desktopDir, 'TouchTeck_Data', 'Meets', cleanMeet);

      for (const item of files) {
        const fullPath = path.join(meetDir, item.subPath);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, item.content, 'utf8');
      }
      return true;
    } catch (e) {
      log.error('Failed to write batch meet files:', e);
      return false;
    }
  });

  ipcMain.on('touchteck:sync', (event, message) => {
    for (const win of BrowserWindow.getAllWindows()) {
      // don't echo back to the window that sent it
      if (win.webContents.id === event.sender.id) continue;
      if (win.isDestroyed()) continue;
      win.webContents.send('touchteck:sync', message);
    }
  });
}

app.whenReady().then(() => {
  setAppMenu();
  startBridge();
  wireWindowIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBridge();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBridge();
});
