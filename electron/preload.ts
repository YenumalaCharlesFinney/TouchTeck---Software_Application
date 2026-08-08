import { contextBridge } from 'electron';

// The renderer talks to the ARES21 bridge over plain WebSocket (ws://localhost:8787),
// which works unchanged with nodeIntegration disabled, so no IPC surface is needed there.
// This bridge only exposes read-only app metadata for a future About/diagnostics panel.
contextBridge.exposeInMainWorld('touchteckApp', {
  versions: process.versions,
});
