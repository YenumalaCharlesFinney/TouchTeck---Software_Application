# TouchTeck Omega Timing — ARES 21 & Starter Protocol Master Technical Documentation

---

## 1. System Architecture Overview

The TouchTeck Omega Timing platform uses a dual-transport driver architecture to connect the web-based Operator Console with physical **Omega StartTime / ARES 21** swimming timing hardware.

```
┌─────────────────────────────────────────────────────────────┐
│                 Physical ARES 21 Console                    │
│            (CH340 USB-to-Serial, VID 1A86 / PID 7523)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ RS-232 / USB (9600 Baud 8N1)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           Node.js Serial Bridge (`serial-bridge.js`)        │
│          WebSocket Server listening on ws://localhost:8787  │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket Binary Stream (<10ms)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             TouchTeck React Web Application (`App.tsx`)     │
│             `serialDriver.ts` Protocol Decoding Engine      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Advantages of the Node.js WebSocket Bridge:
1. **Instant Page Refresh Reconnect**: Browser reloads do not close or release the Windows COM port driver (`COM1`). The Node.js process keeps COM1 open continuously, allowing the web client to reconnect via WebSocket in **< 10ms**.
2. **Multi-Tab Synchronization**: Multiple browser tabs (Operator Desk, Scoreboard, Reports) can share the live serial data feed simultaneously.
3. **Web Serial API Fallback**: If the Node bridge is not running, `serialDriver.ts` automatically falls back to native Chrome Web Serial API.

---

## 2. Reverse-Engineered Secret Hardware Command Codes

The Omega StartTime & ARES 21 timing system communicates using a 9600 baud binary protocol structured with STX (`0x01`), Command Byte, Length Byte, Payload Bytes, and Checksum Byte.

Below are the exact secret command byte hex codes decoded from real hardware captures:

| Command Hex | Command Name | Hex Byte Sequence | Physical Hardware Effect & Operation |
| :--- | :--- | :--- | :--- |
| **`0x16`** | **Arm Lanes / Green Light ON** | `01 16 03 E5 00 00 FF` | **Turns ON physical Green Ready Light** on Omega StartTime Box. Arms lanes 1–8 for touchpad touches. |
| **`0x25`** | **Disarm Hardware / Live Mode** | `01 25 02 ...` | Disarms ready mode during live race. **Extinguishes Green Ready Light**, illuminates Red RUNNING LED on hardware. |
| **`0x31`** | **Mode Enable Handshake** | `01 31 02 CB 01 FE` | Prepares ARES 21 internal registers for heat configuration and lane arming. |
| **`0x14`** | **Timer Configuration** | `01 14 03 E7 6F EF A1` | Configures 1/1000th-second precision timer mode on console motherboard. |
| **`0x15`** | **Lane Mapping** | `01 15 0B DE 01 02 03 04 05 06 07 08 FF FF DD` | Assigns physical touchpads T1 & backup buttons T2 to Lanes 1 through 8. |
| **`0x40` / `0x41`** | **Hardware Starter Gun Trigger** | Incoming bytes `CMD 0x40 / 0x41` | Physical signal received from Bang / Optic starter gun triggering race start. |
| **`0x32`** | **Uptime Clock Drop (Gun Trigger)** | `CMD 0x32` packet sequence | Detects hardware clock reset from high-water mark (> 1.0s drop) indicating gun fire start. |
| **`0x02`** | **Mode Setup** | `01 02 05 F7 05 08 07 EA 01` | Sets SWIMM.EXE mode setup parameters. |
| **`0x03`** | **Start Mode Setup** | `01 03 03 F8 02 02 FB` | Configures acoustic/optical start mode triggers. |
| **`0xF3`** | **Clock Synchronization** | `01 F3 03 08 04 43 B8` / `01 F3 03 08 01 43 BB` | Resets and synchronizes internal hardware clock counters. |
| **`0xF7`** | **Status Poll Keepalive** | `01 F7 02 05 04 FB` | Periodic status poll sent every 3.5 seconds to keep console in Online Active state. |

---

## 3. Exact 14-Step Hardware Handshake Sequence

When connecting or refreshing, `serialDriver.ts` executes the exact 14-step handshake sequence required by official Omega v2.06 timing software:

```javascript
// Step 1: Initial Status Poll
01 F7 02 05 04 FB

// Step 2: Firmware Query F0
01 F0 00 0E

// Step 3: Software ID Query F8 ("SWU")
01 F8 03 03 53 57 55

// Step 4: Secondary Firmware Query F1
01 F1 00 0D

// Step 5: Config 14 (Timer Precision)
01 14 03 E7 6F EF A1

// Step 6: Config 16 (Arm Lanes — Green Light ON)
01 16 03 E5 00 00 FF

// Step 7: Config 15 (Lane Assignment 1-8)
01 15 0B DE 01 02 03 04 05 06 07 08 FF FF DD

// Step 8: Config 02 (Mode Setup)
01 02 05 F7 05 08 07 EA 01

// Step 9: Config 03 (Start Mode)
01 03 03 F8 02 02 FB

// Step 10: Config 84 (Display Mode)
01 84 02 78 08 F7

// Step 11: Config 9F (ARES Config)
01 9F 02 5D 07 F8

// Step 12: Clock Sync 1 (F3)
01 F3 03 08 04 43 B8

// Step 13: Clock Sync 2 (F3)
01 F3 03 08 01 43 BB

// Step 14: Confirm Status Poll (F7)
01 F7 02 05 04 FB

// Final Step: Trailing Force Arm
armLanes(true) -> CMD 0x31 + 0x14 + 0x16 + 0x13 + 0x23
```

---

## 4. Hardware Fixes & Protocol Solutions

### Issue 1: Physical Starter Green Light Turning Off After Refresh
- **Root Cause**: Step 12 & 13 (`01 F3 ...` Clock Sync) reset the ARES 21 internal clock counter. Resetting the internal clock disarmed the hardware, turning OFF the physical Green Ready Light.
- **Solution**: Added explicit trailing `this.isArmed = false; await this.armLanes(true);` at the end of `sendAresInit()`. This forcefully transmits `CMD 0x16` (Arm Lanes / Green Light ON) AFTER the clock sync steps, guaranteeing the physical Green Ready Light illuminates and stays ON after every refresh.

### Issue 2: Phantom Gun Fire During Initialization
- **Root Cause**: During the 14-step handshake, ARES 21 returns startup status packets containing `0x4C` status flags, which could be misidentified as starter gun fire.
- **Solution**: Implemented `this.suppressGunDetectUntil = Date.now() + 2500` grace window. Any gun trigger packets received during handshake initialization are ignored.

### Issue 3: Touchpad Time Drift Spikes (e.g., 03:59.79 / 239.79s)
- **Root Cause**: When starting a race manually or after refresh, ARES 21 touchpad packets contain absolute console uptime (`239.79s`). If the start offset was `0`, the raw uptime was recorded instead of live race time.
- **Solution**: Added active race clock synchronization and drift protection in `App.tsx`:
  ```typescript
  if (timerStatusRef.current === 'RUNNING' && timerStartRef.current > 0) {
    const currentRaceElapsed = (now - timerStartRef.current) / 1000;
    if (Math.abs(touchTime - currentRaceElapsed) > 10.0) {
      touchTime = Number(currentRaceElapsed.toFixed(2));
    }
  }
  ```

---

## 5. Raw Serial Feed Color-Coding Specifications

Log lines in the **Raw Serial Feed** terminal box are styled with high-visibility color coding:

| Log Type | Trigger String | Text Color | Font Weight / Style | Visual Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Race Start / Stop** | `Started race clock.` / `Stopped race clock.` | **`#ef4444`** (Red) | 900 Font Weight | Glowing Red Text Shadow (`0 0 12px rgba(239, 68, 68, 0.7)`) |
| **System Sync / Ready** | `100% READY` / `Synchronized with ARES` | **`#fbbf24`** (Amber) | 800 Font Weight | Glowing Amber Text Shadow (`0 0 10px rgba(251, 191, 36, 0.6)`) |
| **Touchpad Event** | `[TOUCHPAD` / `TOUCH (` | **`#38bdf8`** (Cyan) | 600 Font Weight | Clean Cyan Monospace |
| **Default Log** | Status / Keepalive packets | **`#a7f3d0`** (Emerald) | 400 Font Weight | Soft Emerald Terminal Monospace |

---

## 6. Standard Operating Procedure (SOP)

### How to Run the Node Serial Bridge & Application:
1. Open PowerShell or Command Prompt in project directory:
   ```bash
   npm run bridge
   ```
   *Output*: `TouchTeck serial bridge listening on ws://localhost:8787. Connected to ARES 21 on COM1.`

2. In a second terminal window, launch the web app:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in Google Chrome.

4. Verify Raw Serial Feed in Operator Desk:
   - Amber log: `[SYSTEM] Synchronized with ARES 21 hardware port. Console 100% READY.`
   - Top Header Pill: `[● COM PORT CONNECTED]`
   - Physical Hardware: Green Ready Light ON on Omega StartTime Box.

5. Controls at Bottom of Raw Serial Feed Card:
   - **`Arm Start Light`**: Manually sends `CMD 0x16` to turn ON Green Ready Light.
   - **`Disarm Start Light`**: Manually sends disarm command to turn OFF Green Ready Light.
