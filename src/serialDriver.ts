// ============================================================
//  TouchTeck – Omega / Swiss Timing ARES 21 Serial Driver
//
//  Protocol source: DMS (Device Monitoring Studio) kernel-level
//  capture of official ARES v2.06 (SWIMM.EXE) communication.
//
//  Baud rate: 9600 8N1 (No flow control, RTS/DTR cleared)
//
//  Binary packet structure (PC -> ARES 21):
//    01 | cmd | len | hCheck | payload... | dCheck
//    hCheck = (0xFE - cmd - len) & 0xFF
//    dCheck = (0xFF - sum(payload)) & 0xFF
//
//  Exact 14-Step Write Sequence sent by ARES v2.06 (SWIMM.EXE):
//    1.  01 F7 02 05 04 FB                             (Poll)
//    2.  01 F0 00 0E                                   (Req FW Info)
//    3.  01 F8 03 03 53 57 55                         ("SWU")
//    4.  01 F1 00 0D                                   (Req SW Info)
//    5.  01 14 03 E7 6F EF A1                         (Cfg 14)
//    6.  01 16 03 E5 00 00 FF                         (ARM LANES -> LED BLINKS!)
//    7.  01 15 0B DE 01 02 03 04 05 06 07 08 FF FF DD (Lanes 1-8)
//    8.  01 02 05 F7 01 08 07 EA 05                   (Cfg 02)
//    9.  01 03 03 F8 02 02 FB                         (Cfg 03)
//    10. 01 84 02 78 08 F7                             (Cfg 84)
//    11. 01 9F 02 5D 00 FF                             (Cfg 9F)
//    12. 01 F3 03 08 04 43 B8                         (Clock Sync 1)
//    13. 01 F3 03 08 01 43 BB                         (Clock Sync 2)
//    14. 01 F7 02 05 04 FB                             (Poll - Keepalive)
// ============================================================

export interface TimingEvent {
  type: 'START' | 'SPLIT' | 'FINISH' | 'RUNNING_TIME';
  lane?: number;
  lap?: number;
  time: number;
  timingMethod?: 'T1' | 'T2';
  raw: string;
}

export type TimingCallback = (event: TimingEvent) => void;

class SerialTimingDriver {
  private port: any = null;
  private reader: ReadableStreamDefaultReader<any> | null = null;
  private isReading = false;
  private callbacks: Set<TimingCallback> = new Set();
  private keepaliveId: any = null;
  private lastByteTimestamp = 0;
  private rawBuf: number[] = [];
  private lastUptimeSecs = 0; // Track CMD 0x32 uptime for gun-fire clock-reset detection
  private isArmed = false;   // Guards arm/disarm to prevent multiple firings per state change
  private isRaceActive = false; // Strictly tracks active race running state
  private lastArmTimestamp = 0; // Cooldown timer between arm commands
  // The 14-step init handshake and every arm command intentionally reset the console's
  // internal clock. That reset looks byte-for-byte identical to a real starter-gun clock
  // reset on CMD 0x32, so the gun-fire heuristic must be suppressed for a short grace
  // window after any command we know will touch the clock — otherwise connecting or
  // resetting self-triggers a phantom race start.
  private suppressGunDetectUntil = 0;
  private static readonly GUN_DETECT_GRACE_MS = 1200;
  private writeQueue: Promise<boolean> = Promise.resolve(true); // Serializes write operations

  constructor() {
    if (typeof window !== 'undefined') {
      (navigator as any).serial?.addEventListener('disconnect', () => this.disconnect());
      window.addEventListener('beforeunload', () => {
        this.stopKeepalive();
        this.isReading = false;
        this.disarmAresSync();
        try { this.reader?.cancel(); } catch {}
      });
    }
  }

  // Synchronous emergency disarm frame write on page unload
  private disarmAresSync() {
    if (this.port?.writable) {
      try {
        const writer = this.port.writable.getWriter();
        writer.write(new Uint8Array([0x01, 0x16, 0x03, 0xE5, 0x00, 0x00, 0x00]));
        writer.releaseLock();
      } catch {}
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'serial' in navigator;
  }

  isConnected(): boolean {
    return this.port !== null;
  }

  getHardwareState(): 'DISCONNECTED' | 'CABLE_ONLY' | 'ARES_ONLINE' {
    if (!this.port) return 'DISCONNECTED';
    if (Date.now() - this.lastByteTimestamp < 8000) return 'ARES_ONLINE';
    return 'CABLE_ONLY';
  }

  onData(callback: TimingCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private lastTouchTimestampByLane: { [lane: number]: number } = {};
  private lastHardwareTime: number = 0;
  private raceStartHardwareTime: number = 0;
  private lastStartSignalTimestamp: number = 0;
  private pinSignalInterval: any = null;
  private lastPinState = { cts: false, dsr: false, dcd: false, ri: false };

  // T2 backup pairs: even packet holds time, odd companion holds lane.
  // Buffer until the pair is complete then emit.
  private pendingT2: { index: number; secs: number } | null = null;

  markRaceStarted(isHardwareGun: boolean = false) {
    this.isRaceActive = true;
    if (isHardwareGun) {
      this.raceStartHardwareTime = 0;
    } else {
      this.raceStartHardwareTime = this.lastHardwareTime;
    }
    console.log(`[ARES21] Race START captured (hardwareGun=${isHardwareGun}) — start offset: ${this.raceStartHardwareTime}s`);
    // Instantly emit 0.00s running time for zero latency
    this.emit({ type: 'RUNNING_TIME', time: 0, raw: 'TIMER: 00.00' });
    // Switch hardware to live/disarm mode (turns OFF Green Ready Light, activates Red LED while clock runs)
    this.disarmAres();
  }

  resetRaceStartHardwareTime() {
    this.isRaceActive = false;
    this.raceStartHardwareTime = 0;
    this.lastStartSignalTimestamp = 0;
    this.lastUptimeSecs = 0; // Clear stale high-water mark so the post-reset console clock isn't read as a "drop"
    this.suppressGunDetectUntil = Date.now() + SerialTimingDriver.GUN_DETECT_GRACE_MS; // Guard immediately, before armLanes()'s own await resolves
    this.lastTouchTimestampByLane = {};
    this.lastTouchTimestampByLaneAndMethod = {};
    this.pendingT2 = null; // discard any half-received T2 pair
    this.armLanes(true); // Force re-arm sequence on reset
  }

  async armLanes(force: boolean = false) {
    if (this.isArmed && !force) return; // Already armed — skip duplicate call
    const now = Date.now();
    if (now - this.lastArmTimestamp < 400 && !force) {
      console.log('[ARES21] Arm command suppressed due to 400ms cooldown protection');
      return;
    }
    this.lastArmTimestamp = now;

    if (this.port?.writable) {
      try {
        console.log('[ARES21] Arming console — sending official arm sequence...');
        const armPacket = new Uint8Array([
          0x01, 0x24, 0x02, 0xD8, 0x7F, 0x80,           // CMD 0x24 relay step 1
          0x01, 0x24, 0x02, 0xD8, 0xFF, 0x00,           // CMD 0x24 relay step 2
          0x01, 0x31, 0x02, 0xCB, 0x01, 0xFE,           // CMD 0x31 mode enable
          0x01, 0x14, 0x03, 0xE7, 0x6F, 0xEF, 0xA1,    // CMD 0x14 timer config
          0x01, 0x16, 0x03, 0xE5, 0x00, 0x00, 0xFF,    // CMD 0x16 ARM LANES → Green Light ON
          0x01, 0x13, 0x04, 0xE7, 0x00, 0x01, 0x01, 0xFD, // CMD 0x13
          0x01, 0x10, 0x04, 0xEA, 0x01, 0x00, 0x00, 0xFE, // CMD 0x10
          0x01, 0x10, 0x04, 0xEA, 0x00, 0x00, 0x01, 0xFE, // CMD 0x10
          0x01, 0x13, 0x04, 0xE7, 0x00, 0x01, 0x01, 0xFD, // CMD 0x13
          0x01, 0x12, 0x03, 0xE9, 0x44, 0x00, 0xBB,    // CMD 0x12
          0x01, 0x25, 0x02, 0xD7, 0x00, 0xFF,           // CMD 0x25 READY SIGNAL → Green LED ON!
          0x01, 0x11, 0x04, 0xE9, 0x00, 0x11, 0x28, 0xC6, // CMD 0x11
          0x01, 0x11, 0x04, 0xE9, 0x01, 0x28, 0x28, 0xAE, // CMD 0x11
        ]);
        const ok = await this.safeWrite(armPacket);
        if (ok) {
          this.isArmed = true;
          // Never shrink an existing (longer) grace window — only extend it.
          this.suppressGunDetectUntil = Math.max(this.suppressGunDetectUntil, Date.now() + SerialTimingDriver.GUN_DETECT_GRACE_MS);
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Ready Green Light ON (CMD 0x25 + CMD 0x16)' });
          console.log('[ARES21] Sent Arm command — Green Ready Light ON.');
        }
      } catch (e) {
        console.warn('[ARES21] Arm error:', e);
      }
    }
  }

  async disarmAres() {
    if (!this.isArmed) return; // Already disarmed — skip duplicate call
    if (this.port?.writable) {
      try {
        console.log('[ARES21] Disarming console...');
        const disarmPacket = new Uint8Array([
          0x01, 0x26, 0x02, 0xD6, 0x00, 0xFF,   // CMD 0x26 disarm step 1
          0x01, 0x31, 0x02, 0xCB, 0x00, 0xFF,   // CMD 0x31 mode disable
          0x01, 0x26, 0x00, 0xD8,               // CMD 0x26 disarm confirm
          0x01, 0x31, 0x00, 0xCD,               // CMD 0x31 mode disable short
        ]);
        const ok = await this.safeWrite(disarmPacket);
        if (ok) {
          this.isArmed = false;
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Green Ready Light OFF (disarmed)' });
        }
      } catch (e) {
        console.warn('[ARES21] Disarm error:', e);
      }
    }
  }

  private lastTouchTimestampByLaneAndMethod: { [key: string]: number } = {};

  private emit(event: TimingEvent) {
    if (event.type === 'SPLIT' || event.type === 'FINISH') {
      const lane = event.lane;
      const method = event.timingMethod || 'T1';
      if (lane && lane >= 1 && lane <= 8) {
        const now = Date.now();
        const key = `${lane}_${method}`;
        const lastTouch = this.lastTouchTimestampByLaneAndMethod[key] || 0;
        // Debounce mechanical contact vibration touches on the same sensor/method within 400ms
        if (now - lastTouch < 400) {
          console.log(`[ARES21] Debounced mechanical vibration touch on Lane ${lane} (${method}, ${now - lastTouch}ms since last touch)`);
          return;
        }
        this.lastTouchTimestampByLaneAndMethod[key] = now;
      }
    }
    this.callbacks.forEach(cb => cb(event));
  }

  stopRace() {
    this.isRaceActive = false;
  }

  private async safeWrite(data: Uint8Array): Promise<boolean> {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.port?.writable) return false;
      let retries = 0;
      while (this.port.writable.locked && retries < 15) {
        await new Promise(r => setTimeout(r, 20));
        retries++;
      }
      if (this.port.writable.locked) {
        console.warn('[ARES21] Writable port locked, write skipped');
        return false;
      }
      try {
        const writer = this.port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return true;
      } catch (e) {
        console.warn('[ARES21] safeWrite write error:', e);
        return false;
      }
    });
    return this.writeQueue;
  }

  private async clearSignals() {
    try {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {}
  }


  async rearmAres() {
    if (this.port?.writable) {
      console.log('[ARES21] Re-arm / re-initializing console...');
      await this.sendAresInit();
    }
  }

  // ─── Exact ARES v2.06 Initialization Sequence ─────────────
  private async sendAresInit() {
    if (!this.port?.writable) return;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    console.log('[ARES21] Executing 14-step ARES 21 initialization...');
    this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[HARDWARE] Initializing ARES 21 console...' });
    // Step 6 below (Config 16) arms the lanes as part of the handshake itself, so the
    // clock-reset grace window must cover the whole sequence, not just the trailing armLanes() call.
    this.suppressGunDetectUntil = Math.max(this.suppressGunDetectUntil, Date.now() + 2500);

    try {
      // 1. Initial status poll
      await this.safeWrite(new Uint8Array([0x01, 0xF7, 0x02, 0x05, 0x04, 0xFB]));
      await delay(60);

      // 2. Query firmware identity (F0)
      await this.safeWrite(new Uint8Array([0x01, 0xF0, 0x00, 0x0E]));
      await delay(150);

      // 3. Software ID query F8 ("SWU")
      await this.safeWrite(new Uint8Array([0x01, 0xF8, 0x03, 0x03, 0x53, 0x57, 0x55]));
      await delay(60);

      // 4. Secondary software query F1
      await this.safeWrite(new Uint8Array([0x01, 0xF1, 0x00, 0x0D]));
      await delay(150);

      // 5. Config 14
      await this.safeWrite(new Uint8Array([0x01, 0x14, 0x03, 0xE7, 0x6F, 0xEF, 0xA1]));
      await delay(60);

      // 6. Config 16: ARM LANES (Turns ON Green Ready Light on Omega StartTime box)
      await this.safeWrite(new Uint8Array([0x01, 0x16, 0x03, 0xE5, 0x00, 0x00, 0xFF]));
      await delay(80);

      // 7. Config 15: Lane Assignment (Lanes 1 to 8)
      await this.safeWrite(new Uint8Array([0x01, 0x15, 0x0B, 0xDE, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0xFF, 0xFF, 0xDD]));
      await delay(60);

      // 8. Config 02: Mode setup
      await this.safeWrite(new Uint8Array([0x01, 0x02, 0x05, 0xF7, 0x01, 0x08, 0x07, 0xEA, 0x05]));
      await delay(60);

      // 9. Config 03: Start mode
      await this.safeWrite(new Uint8Array([0x01, 0x03, 0x03, 0xF8, 0x02, 0x02, 0xFB]));
      await delay(60);

      // 10. Config 84: Display mode
      await this.safeWrite(new Uint8Array([0x01, 0x84, 0x02, 0x78, 0x08, 0xF7]));
      await delay(60);

      // 11. Config 9F
      await this.safeWrite(new Uint8Array([0x01, 0x9F, 0x02, 0x5D, 0x00, 0xFF]));
      await delay(60);

      // 12. Clock Sync 1 (F3)
      await this.safeWrite(new Uint8Array([0x01, 0xF3, 0x03, 0x08, 0x04, 0x43, 0xB8]));
      await delay(60);

      // 13. Clock Sync 2 (F3)
      await this.safeWrite(new Uint8Array([0x01, 0xF3, 0x03, 0x08, 0x01, 0x43, 0xBB]));
      await delay(60);

      // 14. Confirm Status Poll (F7)
      await this.safeWrite(new Uint8Array([0x01, 0xF7, 0x02, 0x05, 0x04, 0xFB]));
      await delay(60);

      this.emit({
        type: 'RUNNING_TIME', time: 0,
        raw: '[HARDWARE] ARES 21 online. Red LED blinking.'
      });
      console.log('[ARES21] Initialization complete — automatically arming lanes for Green Ready Light...');
      await this.armLanes();

      // Start periodic status poll keepalive
      this.startKeepalive();

    } catch (e) {
      console.warn('[ARES21] Handshake error:', e);
    }
  }

  // ─── Periodic Status Poll Keepalive ───────────────────────
  //  Official ARES v2.06 sends 01 F7 02 05 04 FB every 3-4 seconds
  //  to keep the ARES 21 console in Online Mode.
  private async sendKeepalive() {
    if (!this.port?.writable) return;
    try {
      await this.safeWrite(new Uint8Array([0x01, 0xF7, 0x02, 0x05, 0x04, 0xFB]));
    } catch (e) {
      console.warn('[ARES21] Keepalive error:', e);
    }
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveId = setInterval(() => {
      if (this.isReading) this.sendKeepalive();
    }, 3500); // Poll every 3.5 seconds
  }

  private stopKeepalive() {
    if (this.keepaliveId) { clearInterval(this.keepaliveId); this.keepaliveId = null; }
  }

  // ─── Connect ───────────────────────────────────────────────
  private async openPort(port: any): Promise<boolean> {
    if (!port) return false;
    
    // If stream is already readable and active, it's open!
    if (port.readable && this.isReading) {
      console.log('[ARES21] Port is already open and active.');
      return true;
    }

    // Attempt up to 3 times with delays to handle Windows CH340 driver settling after F5 refresh
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!port.readable) {
          await port.open({ baudRate: 9600 });
          console.log(`[ARES21] Port successfully opened at 9600 baud (attempt ${attempt}).`);
          return true;
        } else {
          return true;
        }
      } catch (e: any) {
        const name = e?.name || '';
        const msg = e?.message || String(e);
        console.warn(`[ARES21] openPort attempt ${attempt}/3 error [${name}]: ${msg}`);

        // Recover from stale/busy port handles
        try {
          if (port.readable) {
            const r = port.readable.getReader();
            await r.cancel();
            r.releaseLock();
          }
        } catch {}

        try {
          await port.close();
        } catch {}

        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 600));
        }
      }
    }

    return false;
  }

  // Silent auto-connect for previously granted ports (no popup dialogs)
  async autoConnect(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.port?.readable && this.isReading) return true;

    try {
      const granted: any[] = await (navigator as any).serial.getPorts();
      if (!granted || granted.length === 0) return false;

      for (const p of granted) {
        // Try to close it first in case the page reload left it in a stale open state
        try { if (p.readable) await p.close(); } catch {}

        const opened = await this.openPort(p);
        if (opened) {
          this.port = p;
          await this.clearSignals();
          this.startReading();
          return true;
        }
      }
    } catch (e) {
      console.warn('[ARES21] Silent auto-connect error:', e);
    }
    return false;
  }

  async connect(baudRate: number = 9600): Promise<boolean> {
    if (!this.isSupported()) throw new Error('Web Serial API not supported. Use Chrome or Edge.');

    this.stopKeepalive();

    // 1. If port is ALREADY readable and active, reuse it immediately!
    if (this.port?.readable && this.isReading) {
      return true;
    }

    // 2. Check previously-granted ports first
    try {
      const granted: any[] = await (navigator as any).serial.getPorts();
      if (granted.length > 0) {
        for (const p of granted) {
          if (await this.openPort(p)) {
            this.port = p;
            await this.clearSignals();
            this.startReading();
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[ARES21] Error checking granted ports:', e);
    }

    // 3. Request port via browser dialog if no granted port opened
    try {
      const p = await (navigator as any).serial.requestPort();
      if (!p) throw new Error('No port selected.');

      const opened = await this.openPort(p);
      if (!opened) {
        this.port = null;
        throw new Error('Failed to open serial port. Please try clicking Detect COM Port once more.');
      }

      this.port = p;
      await this.clearSignals();
      this.startReading();
      return true;
    } catch (err: any) {
      this.port = null;
      throw err;
    }
  }

  async disconnect() {
    this.stopKeepalive();
    await this.disarmAres();
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        console.warn('[ARES21] Reader cancel error:', e);
      }
      try {
        this.reader.releaseLock();
      } catch (e) {
        console.warn('[ARES21] Reader releaseLock error:', e);
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        if (this.port.readable || this.port.writable) {
          await this.port.close();
        }
      } catch (e) {
        console.warn('[ARES21] Port close error:', e);
      }
      this.port = null;
    }

    if (this.pinSignalInterval) {
      clearInterval(this.pinSignalInterval);
      this.pinSignalInterval = null;
    }
    this.rawBuf = [];
    this.lastTouchTimestampByLane = {};
    this.emit({ type: 'FINISH', time: 0, raw: 'SYSTEM: DISCONNECTED', lane: 0 });
  }

  // ─── Main Read Loop ────────────────────────────────────────
  private async startReading() {
    if (!this.port?.readable) return;
    this.isReading = true;
    this.rawBuf = [];

    setTimeout(() => this.sendAresInit(), 250);

    this.reader = this.port.readable.getReader();
    const activeReader = this.reader;

    try {
      while (this.isReading && activeReader) {
        const { value, done } = await activeReader.read();
        if (done) break;
        if (!value?.length) continue;

        this.lastByteTimestamp = Date.now();

        const hexStr = Array.from(value as Uint8Array)
          .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');
        console.log('[ARES21] RAW:', hexStr);

        // Direct raw byte scan for ASCII START trigger from starter gun
        const chunkTxt = Array.from(value as Uint8Array)
          .map((b: number) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ' '))
          .join('');
        if (/START/i.test(chunkTxt)) {
          console.log('[ARES21] Direct raw chunk START detected:', chunkTxt);
          this.parseAsciiEvent('START');
        }

        for (const b of value as Uint8Array) {
          this.rawBuf.push(b);
        }
        this.processBinaryBuffer();
      }
    } catch (err) {
      console.error('[ARES21] Read error:', err);
      this.disconnect();
    }
  }

  // ─── Binary Packet Parser ──────────────────────────────────
  //  Incoming framing from ARES 21:
  //  01 | cmd | len | hCheck | data...
  private processBinaryBuffer() {
    while (this.rawBuf.length >= 4) {
      if (this.rawBuf[0] !== 0x01) {
        this.rawBuf.shift();
        continue;
      }

      const cmd  = this.rawBuf[1];
      const len  = this.rawBuf[2];
      const hChk = this.rawBuf[3];
      const expHChk = (0xFE - cmd - len) & 0xFF;

      if (hChk !== expHChk) {
        this.rawBuf.shift();
        continue;
      }

      const totalLen = 4 + len;
      if (this.rawBuf.length < totalLen) return;

      const packet = this.rawBuf.splice(0, totalLen);
      const data   = packet.slice(4);

      const cmdHex  = cmd.toString(16).toUpperCase().padStart(2, '0');
      const dataHex = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      console.log(`[ARES21] PKT CMD=0x${cmdHex} len=${len} data=[${dataHex}]`);

      this.dispatchPacket(cmd, data);
    }
  }

  // ─── Dispatch Incoming ARES 21 Packets ─────────────────────
  private dispatchPacket(cmd: number, data: number[]) {
    switch (cmd) {
      // CMD 0x30 – Active Race Running Clock Frame
      case 0x30: {
        if (data.length >= 4) {
          const secsHi = data[2] || 0;
          const secsLo = data[3] || 0;
          const secs = secsHi + (secsLo / 100);
          this.lastHardwareTime = secs;

          // Only stream live running time if race is ALREADY RUNNING
          if (this.isRaceActive) {
            if (this.raceStartHardwareTime > 0 && secs < this.raceStartHardwareTime) {
              this.raceStartHardwareTime = secs;
            }
            const netSecs = Math.max(0, secs - this.raceStartHardwareTime);
            this.emit({ type: 'RUNNING_TIME', time: netSecs, raw: `TIMER: ${this.formatTime(netSecs)}` });
          }
        }
        break;
      }

      // CMD 0x32 – Running Timer Heartbeat (every ~100 ms)
      case 0x32: {
        if (data.length >= 5) {
          // Packet format: 01 32 05 [C7] [00] [hi] [mid] [lo] [checksum]
          // data[0] = 0xC7 (status byte)
          // data[1] = 0x00
          // ticks = 24-bit big endian integer in data[2], data[3], data[4]
          const ticks = ((data[2] << 16) | (data[3] << 8) | data[4]) >>> 0;
          const rawSecs = ticks / 1000;
          this.lastHardwareTime = rawSecs;

          // ── Gun-fire detection via clock RESET ───────────────────────────
          // When the starter gun fires, ARES 21 resets its internal clock to 0
          // and starts counting uptime from scratch. This causes a sudden DROP
          // in the rawSecs value from CMD 0x32 (e.g. 12.0 → 0.2).
          if (
            !this.isRaceActive &&                       // Race not yet started
            Date.now() >= this.suppressGunDetectUntil && // Not within a connect/arm/reset-induced clock reset window
            this.lastUptimeSecs > 1.0 &&                // Had a meaningful uptime
            rawSecs < this.lastUptimeSecs - 0.5         // Clock reset backward!
          ) {
            const now = Date.now();
            if (now - this.lastStartSignalTimestamp >= 2000) {
              console.log(`[ARES21] STARTER GUN TRIGGERED via clock reset! (${this.lastUptimeSecs.toFixed(2)}s → ${rawSecs.toFixed(2)}s)`);
              this.lastStartSignalTimestamp = now;
              this.markRaceStarted(true);
              this.emit({ type: 'START', time: 0, raw: 'HARDWARE STARTER GUN (clock reset)' });
            }
          }
          this.lastUptimeSecs = rawSecs;

          if (this.isRaceActive) {
            if (this.raceStartHardwareTime > 0 && rawSecs < this.raceStartHardwareTime) {
              this.raceStartHardwareTime = rawSecs;
            }
            const displayTime = Math.max(0, rawSecs - this.raceStartHardwareTime);
            this.emit({ type: 'RUNNING_TIME', time: displayTime, raw: `TIMER: ${this.formatTime(displayTime)}` });
          }
          // Console Uptime emission removed to keep UI log clean and concise
        }
        break;
      }

      // CMD 0x40 / CMD 0x41 – Touchpad T1 Event OR Starter Gun Hardware Trigger
      case 0x40:
      case 0x41: {
        // ── Starter Gun Signature (confirmed from test 2 + Perfect start record) ───
        // Packet: 01 40 11 AD [data]
        // data = packet.slice(4), so:
        //   data[1] = device ID: 0x01 or 0x02 = GUN inputs; 0x05+ = lane touchpads
        //   data[2] = 0x4C means "valid timing data" flag
        // Gun fires: data[1] <= 0x03 AND data[2] === 0x4C
        // Touchpad:  data[1] >= 0x05 AND data[2] === 0x4C (handled by parseCmd40)
        const isGunDevice = data.length >= 3 && data[2] === 0x4C && data[1] >= 0x01 && data[1] <= 0x03;

        if (isGunDevice) {
          if (!this.isRaceActive) {
            const now = Date.now();
            if (now - this.lastStartSignalTimestamp >= 2000) {
              console.log(`[ARES21] STARTER GUN TRIGGERED (CMD 0x40, device=0x${data[1].toString(16).padStart(2,'0')})!`);
              this.lastStartSignalTimestamp = now;
              this.markRaceStarted(true);
              this.emit({ type: 'START', time: 0, raw: 'HARDWARE STARTER GUN' });
            }
          }
          break;
        }
        this.parseCmd40(data);
        break;
      }

      // CMD 0x42 / 0x43 – Backup Hand Button T2 Timing Event
      case 0x42:
      case 0x43: {
        this.parseCmd40(data, 'T2');
        break;
      }

      // CMD 0x81 – ASCII Event Wrapper (START, SLH|, TLH|…)
      case 0x81: {
        if (data.length > 0) this.parseCmd81(data);
        break;
      }

      // CMD 0xF7 – Status Poll Response ACK
      case 0xF7: {
        this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Status OK' });
        break;
      }

      // CMD 0xF0 – Firmware Version Info Response
      case 0xF0: {
        if (data.length > 1) {
          const payload = data.slice(0, data.length - 1);
          const txt = payload.map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: `[ARES21] FW: ${txt}` });
        }
        break;
      }

      // CMD 0xF1 – Software Version Info Response
      case 0xF1: {
        if (data.length > 1) {
          const payload = data.slice(0, data.length - 1);
          const txt = payload.map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: `[ARES21] SW: ${txt}` });
        }
        break;
      }

      // CMD 0xFE – Status Response Packet (Not a starter gun trigger)
      case 0xFE: {
        break;
      }

      // CMD 0xFF – NAK / Frame Rejection Notification
      case 0xFF: {
        console.warn('[ARES21] NAK received from ARES 21 (frame rejected)');
        break;
      }

      default: {
        const cmdHex  = cmd.toString(16).toUpperCase().padStart(2, '0');
        const dataHex = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        this.emit({ type: 'RUNNING_TIME', time: 0, raw: `[ARES21] 0x${cmdHex} [${dataHex}]` });
        break;
      }
    }
  }

  // ─── CMD 0x40 – Touchpad / Backup Button Timing Event ─────────────
  //
  // T1 Primary Touchpad:
  //   data[2] = 0x40–0x47  →  Lane = (data[2] & 0x07) + 1
  //   data[8..11] = time in ms (big-endian)
  //
  // T2 Backup Hand Button:
  //   data[2] = 0x20–0x27  →  Lane = (data[2] & 0x07) + 1
  //   data[8..11] = time in ms (big-endian)
  //   (ODD companion metadata packets use 0xa0-0xa7 for the same lane and are ignored)
  //
  private parseCmd40(data: number[], forceMethod?: 'T1' | 'T2') {
    if (data.length < 12) return;

    const b1 = data[1];
    const b2 = data[2];
    const b3 = data[3];
    const dataHex = data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // ══ T1 PRIMARY TOUCHPAD (0x40–0x47) ════════════════════════════════
    if (b2 >= 0x40 && b2 <= 0x47) {
      const lane = (b2 & 0x07) + 1;
      const ticks = ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
      const secs = (ticks > 500 && ticks < 36000000) ? ticks / 1000 : 0;
      if (secs <= 0) return;
      this.emitTiming('T1', lane, secs);
      return;
    }

    // Alternate T1 lane encoding in b3 (kept for compatibility)
    if (!forceMethod && b3 >= 0x40 && b3 <= 0x47) {
      const lane = (b3 & 0x07) + 1;
      const ticks = ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
      const secs = (ticks > 500 && ticks < 36000000) ? ticks / 1000 : 0;
      if (secs <= 0) return;
      this.emitTiming('T1', lane, secs);
      return;
    }

    // ══ T2 BACKUP HAND BUTTON (0x20–0x27) ═════════════════════════════
    if (b2 >= 0x20 && b2 <= 0x27) {
      const lane = (b2 & 0x07) + 1;
      const ticks = ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
      const secs = (ticks > 500 && ticks < 36000000) ? ticks / 1000 : 0;
      if (secs <= 0) return;
      this.emitTiming('T2', lane, secs);
      return;
    }

    // ══ T2 BACKUP ODD METADATA PACKET (0xa0–0xa7) ══════════════════════
    // Ignore companion metadata frame as time was processed in 0x20-0x27 frame
    if (b2 >= 0xa0 && b2 <= 0xa7) {
      return;
    }

    // ── Alternate T2 firmware variants (legacy / extra banks) ───────────
    let lane = -1;
    if (b2 >= 0x81 && b2 <= 0x88)       { lane = b2 - 0x80; }
    else if (b2 === 0x80)                 { lane = 8; }
    else if (b2 >= 0x82 && b2 <= 0x8F)  { lane = (b2 & 0x07) + 1; }
    else if (b2 >= 0xC0 && b2 <= 0xC7)  { lane = (b2 & 0x07) + 1; }
    else if (forceMethod === 'T2')        { const g = (b2 & 0x07) + 1; if (g >= 1 && g <= 8) lane = g; }

    if (lane >= 1 && lane <= 8) {
      const ticks = ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
      const secs = (ticks > 500 && ticks < 36000000) ? ticks / 1000 : 0;
      if (secs > 0) this.emitTiming('T2', lane, secs);
    } else {
      console.log(`[ARES21] parseCmd40: skipped unrecognised packet b1=0x${b1.toString(16).toUpperCase()} b2=0x${b2.toString(16).toUpperCase()}`);
    }
  }

  // ── shared timing emit helper ────────────────────────────────────────
  private emitTiming(timingMethod: 'T1' | 'T2', lane: number, secs: number) {
    let netSecs = secs;
    if (this.raceStartHardwareTime > 0 && secs >= this.raceStartHardwareTime) {
      netSecs = secs - this.raceStartHardwareTime;
    } else if (this.raceStartHardwareTime > 0 && this.lastHardwareTime > 0) {
      netSecs = this.lastHardwareTime - this.raceStartHardwareTime;
    } else if (this.raceStartHardwareTime === 0 && this.lastHardwareTime > 0) {
      // Auto-recover start timestamp if start pulse was missed
      this.raceStartHardwareTime = Math.max(0, this.lastHardwareTime - secs);
      netSecs = secs;
      console.log(`[ARES21] Auto-recovered race start hardware time: ${this.raceStartHardwareTime}s`);
    }
    const timeStr = this.formatTime(netSecs);
    console.log(`[ARES21] ${timingMethod} Lane=${lane} NetTime=${timeStr} (raw=${secs}s)`);
    this.emit({
      type: 'SPLIT',
      lane,
      lap: 1,
      time: netSecs,
      timingMethod,
      raw: `TOUCH (${timingMethod}) Lane${lane} ${timeStr}`,
    });
  }

  // ─── CMD 0x81 – ASCII Event Wrapper Parser ─────────────────
  private parseCmd81(data: number[]) {
    if (data.length < 3) return;
    // Extract printable ASCII characters (skipping SOH, STX, EOT control bytes)
    const ascii = data
      .map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '')
      .join('');

    console.log('[ARES21] CMD81 ASCII string:', ascii);
    if (ascii) {
      this.emit({ type: 'RUNNING_TIME', time: 0, raw: `SERIAL: ${ascii}` });
      this.parseAsciiEvent(ascii);
    }
  }

  // ─── ASCII Event Parser ─────────────────────────────────────
  private parseAsciiEvent(raw: string) {
    const line = raw.trim();
    if (!line) return;

    if (/START/i.test(line)) {
      const now = Date.now();
      if (now - this.lastStartSignalTimestamp < 3000) {
        console.log(`[ARES21] Ignored duplicate START pulse (${line}) within 3s window`);
        return;
      }
      this.lastStartSignalTimestamp = now;
      this.markRaceStarted();
      this.emit({ type: 'START', time: 0, raw: line });
      return;
    }

    const slh = line.match(/^SLH\|\s*(\d+)\|\s*(-?\d+)\|\s*(\d+)\|\s*([\d:. ]*)\|/);
    if (slh) {
      const lane  = parseInt(slh[2], 10);
      const split = parseInt(slh[3], 10);
      const time  = slh[4].trim() ? this.parseTime(slh[4].trim()) : 0;
      if (lane >= 1 && lane <= 8 && time > 0) {
        let netTime = time;
        if (this.raceStartHardwareTime > 0 && time >= this.raceStartHardwareTime) {
          netTime = time - this.raceStartHardwareTime;
        }
        this.emit({ type: 'SPLIT', lane, lap: split || 1, time: netTime, raw: line });
      }
      return;
    }

    const tlh = line.match(/^TLH\|\s*(\d+)\|\s*(-?\d+)\|\s*(\d+)\|\s*([\d:. ]*)\|\s*([\d:. ]*)\|/);
    if (tlh) {
      const lane  = parseInt(tlh[2], 10);
      const split = parseInt(tlh[3], 10);
      const tStr  = tlh[4].trim() || tlh[5].trim();
      const time  = tStr ? this.parseTime(tlh[4].trim()) : 0;
      if (lane >= 1 && lane <= 8 && time > 0) {
        let netTime = time;
        if (this.raceStartHardwareTime > 0 && time >= this.raceStartHardwareTime) {
          netTime = time - this.raceStartHardwareTime;
        }
        this.emit({ type: 'FINISH', lane, lap: split || 1, time: netTime, timingMethod: 'T1', raw: line });
      }
      return;
    }

    // Compact Finish: e.g. "TF 01 02.48" or "TF 1 00:02.48"
    const compactFinish = line.match(/^TF\s+0?(\d+)\s+([\d:.]+)/i);
    if (compactFinish) {
      const lane = parseInt(compactFinish[1], 10);
      const time = this.parseTime(compactFinish[2]);
      if (lane >= 1 && lane <= 8 && time > 0) {
        this.emit({ type: 'FINISH', lane, lap: 1, time, timingMethod: 'T1', raw: `TOUCH (T1) Lane${lane} ${this.formatTime(time)}` });
        return;
      }
    }

    // Compact Split: e.g. "01 1 02.48" or "1 1 00:02.48"
    const compactSplit = line.match(/^0?(\d+)\s+(\d+)\s+([\d:.]+)/);
    if (compactSplit) {
      const lane = parseInt(compactSplit[1], 10);
      const lap = parseInt(compactSplit[2], 10);
      const time = this.parseTime(compactSplit[3]);
      if (lane >= 1 && lane <= 8 && time > 0) {
        this.emit({ type: 'SPLIT', lane, lap, time, timingMethod: 'T1', raw: `TOUCH (T1) Lane${lane} ${this.formatTime(time)}` });
        return;
      }
    }

    this.emit({ type: 'RUNNING_TIME', time: 0, raw: `?: ${line}` });
  }

  // ─── Public API ────────────────────────────────────────────
  parseAsciiLine(line: string) { this.parseAsciiEvent(line); }
  injectRawLine(line: string)  { this.parseAsciiEvent(line); }

  async sendSerialData(data: string): Promise<boolean> {
    if (data === 'START') {
      return await this.sendRaceStartSignal();
    } else if (data === 'RESET') {
      return await this.sendRaceResetSignal();
    }
    // Send status poll to ARES 21 console
    await this.safeWrite(new Uint8Array([0x01, 0xF7, 0x02, 0x05, 0x04, 0xFB]));
    return true;
  }

  async sendRaceStartSignal(): Promise<boolean> {
    console.log('[ARES21] Manual Start signal — disarming console for live race.');
    this.markRaceStarted(false);
    return true;
  }

  async sendRaceResetSignal(): Promise<boolean> {
    console.log('[ARES21] Resetting race state — re-arming console.');
    this.resetRaceStartHardwareTime();
    return true;
  }

  async blinkHardwareLed(): Promise<boolean> {
    console.log('[ARES21] Hardware test — re-arming console.');
    await this.armLanes(true);
    return true;
  }

  private parseTime(t: string): number {
    const colons = (t.match(/:/g) || []).length;
    if (colons === 2) { const [h, m, s] = t.split(':'); return +h * 3600 + +m * 60 + parseFloat(s); }
    if (colons === 1) { const [m, s] = t.split(':'); return +m * 60 + parseFloat(s); }
    return parseFloat(t) || 0;
  }

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = (sec - m * 60).toFixed(2).padStart(5, '0');
    return m > 0 ? `${m}:${s}` : s;
  }
}

export const serialDriver = new SerialTimingDriver();

// ─────────────────────────────────────────────────────────────
//  Swimming Meet Simulator
// ─────────────────────────────────────────────────────────────
export class SwimmingSimulator {
  private timerId: any = null;
  private startTime = 0;
  private running = false;
  private maxLaps = 2;
  private laneLaps: { [lane: number]: number } = {};
  private activeLanes: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  private speeds: { [lane: number]: number } = {};
  private finishedLanes = new Set<number>();

  constructor() { this.reset(); }

  reset() {
    this.running = false;
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    this.startTime = 0;
    this.finishedLanes.clear();
    for (let i = 1; i <= 8; i++) {
      this.laneLaps[i] = 0;
      this.speeds[i] = 23 + Math.random() * 8;
    }
  }

  startRace(eventLaps: number, lanesToRun: number[] = [1,2,3,4,5,6,7,8]) {
    this.reset();
    this.maxLaps = eventLaps;
    this.activeLanes = lanesToRun;
    this.running = true;
    this.startTime = Date.now();
    serialDriver.injectRawLine('START');
  }

  manualTouch(lane: number, overrideElapsed?: number) {
    const elapsed = overrideElapsed !== undefined && overrideElapsed >= 0
      ? overrideElapsed : (this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0);
    this.laneLaps[lane] = (this.laneLaps[lane] || 0) + 1;
    const t = this.fmt(elapsed);
    if (this.laneLaps[lane] >= this.maxLaps) {
      this.finishedLanes.add(lane);
      serialDriver.injectRawLine(`TF 0${lane} ${t}`);
    } else {
      serialDriver.injectRawLine(`0${lane} ${this.laneLaps[lane]} ${t}`);
    }
  }

  manualSplit(lane: number, overrideElapsed?: number) {
    const elapsed = overrideElapsed !== undefined && overrideElapsed >= 0
      ? overrideElapsed : (this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0);
    this.laneLaps[lane] = (this.laneLaps[lane] || 0) + 1;
    serialDriver.injectRawLine(`0${lane} ${this.laneLaps[lane]} ${this.fmt(elapsed)}`);
  }

  manualFinish(lane: number, overrideElapsed?: number) {
    const elapsed = overrideElapsed !== undefined && overrideElapsed >= 0
      ? overrideElapsed : (this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0);
    this.laneLaps[lane] = this.maxLaps;
    this.finishedLanes.add(lane);
    serialDriver.injectRawLine(`TF 0${lane} ${this.fmt(elapsed)}`);
  }

  stop() {
    this.running = false;
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  }

  private fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = (sec - m * 60).toFixed(2).padStart(5, '0');
    return m > 0 ? `${m}:${s}` : s;
  }
}

export const simulator = new SwimmingSimulator();
