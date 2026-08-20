import { contextBridge, ipcRenderer } from 'electron';

// The renderer talks to the ARES21 bridge over plain WebSocket (ws://localhost:8787),
// which works unchanged with nodeIntegration disabled, so no IPC surface is needed there.
//
// What does need IPC: opening a tab in its own window, and keeping every window
// in step. Timing state already travels on a BroadcastChannel, but that channel
// is scoped to an origin and the packaged app runs from file://, so the main
// process relays the same messages between windows instead.
contextBridge.exposeInMainWorld('touchteckApp', {
  versions: process.versions,

  // Which tab this window opened on, if it was opened as a secondary window.
  initialTab: (() => {
    const m = /(?:^|[#&])tab=([a-z-]+)/.exec(location.hash);
    return m ? m[1] : null;
  })(),

  openTabWindow: (tabId: string): Promise<boolean> =>
    ipcRenderer.invoke('touchteck:open-tab-window', tabId),

  printHtml: (html: string): Promise<boolean> =>
    ipcRenderer.invoke('touchteck:print-html', html),

  openDataFolder: (meetName?: string): Promise<string | null> =>
    ipcRenderer.invoke('touchteck:open-data-folder', meetName),

  writeEventFile: (meetName: string, fileName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('touchteck:write-event-file', meetName, fileName, content),

  // Send a sync message to every other window.
  sendSync: (message: unknown) => ipcRenderer.send('touchteck:sync', message),

  // Listen for sync messages from other windows. Returns an unsubscribe fn.
  onSync: (callback: (message: any) => void) => {
    const handler = (_event: unknown, message: any) => callback(message);
    ipcRenderer.on('touchteck:sync', handler);
    return () => ipcRenderer.removeListener('touchteck:sync', handler);
  },
});
