// ============================================================
//  TouchTeck – Local Serial Bridge for the Omega / Swiss Timing ARES 21
//
//  Runs as a plain Node.js process on the same machine as the ARES 21's
//  USB-serial cable. It opens the COM port ONCE and keeps it open for as
//  long as this process runs — completely independent of the browser tab.
//  The website talks to this bridge over a local WebSocket instead of
//  talking to the serial port directly, so refreshing/closing the browser
//  tab never touches the actual hardware connection.
//
//  Run with: npm run bridge   (or automatically alongside the site via
//  npm run dev, which starts this and the Vite dev server together).
// ============================================================

import { SerialPort } from 'serialport';
import { WebSocketServer } from 'ws';

const WS_PORT = 8787;
const BAUD_RATE = 9600;

// CH340 USB-SERIAL adapter identifiers, confirmed from a real kernel-level capture of this
// exact ARES 21 setup ("USB#VID_1A86&PID_7523..."). Used to auto-detect the right COM port
// without the operator ever having to pick it from a list.
const TARGET_VID = '1a86';
const TARGET_PID = '7523';

let serialPort = null;
let reconnectTimer = null;
let disarmGraceTimer = null;
const clients = new Set();

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function broadcastStatus(deviceConnected) {
  const msg = JSON.stringify({ type: 'status', deviceConnected });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function broadcastData(bytes) {
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(bytes);
  }
}

async function findTargetPort() {
  const ports = await SerialPort.list();
  return ports.find(
    (p) =>
      ((p.vendorId || '').toLowerCase() === TARGET_VID &&
      (p.productId || '').toLowerCase() === TARGET_PID) ||
      (p.manufacturer || '').toLowerCase().includes('wch') ||
      (p.manufacturer || '').toLowerCase().includes('qinheng') ||
      (p.friendlyName || '').toLowerCase().includes('ch340') ||
      (p.friendlyName || '').toLowerCase().includes('usb-serial')
  );
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerial();
  }, 1000);
}

async function openSerial() {
  if (serialPort?.isOpen) return;

  const target = await findTargetPort();
  if (!target) {
    log('ARES 21 (CH340, VID 1A86 / PID 7523) not found. Retrying in 3s... (plug it in / power it on)');
    scheduleReconnect();
    return;
  }

  log(`Found ARES 21 on ${target.path}. Opening at ${BAUD_RATE} baud...`);
  serialPort = new SerialPort(
    {
      path: target.path,
      baudRate: BAUD_RATE,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      rtscts: false,
      autoOpen: false,
    },
    (err) => {
      if (err) {
        log(`Failed to construct port for ${target.path}: ${err.message}`);
        scheduleReconnect();
      }
    }
  );

  serialPort.open((err) => {
    if (err) {
      log(`Failed to open ${target.path}: ${err.message}`);
      serialPort = null;
      scheduleReconnect();
      return;
    }
    log(`Connected to ARES 21 on ${target.path}.`);
    // Protocol requires RTS/DTR held LOW — see src/serialDriver.ts header comment.
    serialPort.set({ dtr: false, rts: false }, () => {});
    broadcastStatus(true);
  });

  serialPort.on('data', (chunk) => {
    broadcastData(chunk);
  });

  serialPort.on('close', () => {
    log('ARES 21 disconnected.');
    broadcastStatus(false);
    serialPort = null;
    scheduleReconnect();
  });

  serialPort.on('error', (err) => {
    log(`Serial error: ${err.message}`);
  });
}

const wss = new WebSocketServer({ port: WS_PORT });
log(`TouchTeck serial bridge listening on ws://localhost:${WS_PORT}`);
log('Keep this window open while using TouchTeck with real ARES 21 hardware.');

wss.on('connection', (ws) => {
  clients.add(ws);
  log(`Browser tab connected (${clients.size} active).`);
  if (disarmGraceTimer) { clearTimeout(disarmGraceTimer); disarmGraceTimer = null; }
  ws.send(JSON.stringify({ type: 'status', deviceConnected: !!serialPort?.isOpen }));

  ws.on('message', async (data) => {
    try {
      const text = typeof data === 'string' ? data : (Buffer.isBuffer(data) ? data.toString('utf8') : '');
      if (text.startsWith('{')) {
        const json = JSON.parse(text);
        if (json.action === 'reconnect' || json.action === 'rehandshake') {
          log('Received explicit COM port reconnect request from browser UI.');
          if (serialPort) {
            try { serialPort.close(); } catch {}
            serialPort = null;
          }
          await openSerial();
          ws.send(JSON.stringify({ type: 'status', deviceConnected: !!serialPort?.isOpen }));
          return;
        }
      }
    } catch {}

    if (serialPort?.isOpen) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      serialPort.write(buf);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    log(`Browser tab disconnected (${clients.size} active).`);
    if (clients.size === 0 && serialPort?.isOpen) {
      // Grace period in case this was just a page refresh reconnecting a moment later.
      // If truly nobody is driving the console anymore, disarm it so it isn't left hanging.
      disarmGraceTimer = setTimeout(() => {
        disarmGraceTimer = null;
        if (clients.size === 0 && serialPort?.isOpen) {
          log('No browser tabs connected — disarming console.');
          serialPort.write(
            Buffer.from([
              0x01, 0x26, 0x02, 0xd6, 0x00, 0xff, // CMD 0x26 disarm step 1
              0x01, 0x31, 0x02, 0xcb, 0x00, 0xff, // CMD 0x31 mode disable
              0x01, 0x26, 0x00, 0xd8, // CMD 0x26 disarm confirm
              0x01, 0x31, 0x00, 0xcd, // CMD 0x31 mode disable short
            ])
          );
        }
      }, 3000);
    }
  });
});

openSerial();
