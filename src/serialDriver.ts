// ============================================================
//  TouchTeck – Omega / Swiss Timing ARES 21 Serial Driver
//
//  Transport: talks to the local bridge process (bridge/serial-bridge.js)
//  over a WebSocket (ws://localhost:8787) instead of the browser's Web
//  Serial API directly. The bridge owns the actual COM port continuously,
//  independent of the browser tab's lifecycle — so refreshing/closing the
//  page never drops the hardware connection the way a direct Web Serial
//  connection did. Every packet-level detail below (framing, checksums,
//  arm/disarm sequences, touch/start decoding) is unchanged; only how the
//  bytes physically get in and out changed.
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
//    8.  01 02 05 F7 05 08 07 EA 01                   (Cfg 02)
//    9.  01 03 03 F8 02 02 FB                         (Cfg 03)
//    10. 01 84 02 78 08 F7                             (Cfg 84)
//    11. 01 9F 02 5D 07 F8                             (Cfg 9F)
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
  // Wall-clock (Date.now()) estimate of the instant the race actually started, translated
  // from the ARES hardware clock domain. Only present on hardware-gun-triggered START events —
  // lets the UI's local race clock start from the TRUE fire moment instead of whenever this
  // packet happened to be processed, keeping it in sync with touch times (which are always
  // computed in the ARES clock domain).
  startTimestamp?: number;
}

export type TimingCallback = (event: TimingEvent) => void;

class SerialTimingDriver {
  private ws: WebSocket | null = null;
  private readonly bridgeUrl = 'ws://localhost:8787';
  private bridgeReportsDeviceConnected = false; // status reported by the bridge process itself
  private isReading = false;
  private callbacks: Set<TimingCallback> = new Set();
  private keepaliveId: any = null;
  private lastByteTimestamp = 0;
  private rawBuf: number[] = [];
  private lastUptimeSecs = 0;        // Last CMD 0x32 value (gun-fire clock-reset detection)
  private lastUptimeReceivedMs = 0;  // Wall-clock ms when lastUptimeSecs was last updated (for sub-second interpolation)
  private isArmed = false;   // Guards arm/disarm to prevent multiple firings per state change
  private isRaceActive = false; // Strictly tracks active race running state
  private lastArmTimestamp = 0; // Cooldown timer between arm commands
  private lastResetTimestamp = 0; // Cooldown timer between reset commands (see sendRaceResetSignal)
  // The 14-step init handshake and every arm command intentionally reset the console's
  // internal clock. That reset looks byte-for-byte identical to a real starter-gun clock
  // reset on CMD 0x32, so the gun-fire heuristic must be suppressed for a short grace
  // window after any command we know will touch the clock — otherwise connecting or
  // resetting self-triggers a phantom race start.
  private suppressGunDetectUntil = 0;
  private static readonly GUN_DETECT_GRACE_MS = 1200;
  private writeQueue: Promise<boolean> = Promise.resolve(true); // Serializes write operations
  private port: any = null;
  private reader: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.stopKeepalive();
        this.isReading = false;
        this.disarmAresSync();
        // No explicit socket close here — the browser tears the WebSocket down on its own as
        // the page unloads. The bridge process (which owns the real serial connection) detects
        // the disconnect and disarms the console itself after a grace period if no other tab
        // reconnects — see bridge/serial-bridge.js. This is just a fast best-effort attempt.
      });
    }
  }

  // Best-effort emergency disarm write on page unload. The bridge process is the reliable
  // backstop for this (see bridge/serial-bridge.js's disarm-on-last-client-disconnect), but
  // this gives an instant disarm attempt too since it costs nothing extra to try.
  private disarmAresSync() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(new Uint8Array([
          0x01, 0x26, 0x02, 0xD6, 0x00, 0xFF, // CMD 0x26 disarm step 1
          0x01, 0x31, 0x02, 0xCB, 0x00, 0xFF, // CMD 0x31 mode disable
          0x01, 0x26, 0x00, 0xD8,             // CMD 0x26 disarm confirm
          0x01, 0x31, 0x00, 0xCD,             // CMD 0x31 mode disable short
        ]));
      } catch {}
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'WebSocket' in window;
  }

  isConnected(): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;
    if (this.port && (this.port.readable || this.port.writable)) return true;
    return false;
  }

  getHardwareState(): 'DISCONNECTED' | 'CABLE_ONLY' | 'ARES_ONLINE' {
    if (!this.isConnected()) return 'DISCONNECTED';
    if (this.ws) {
      return this.bridgeReportsDeviceConnected ? 'ARES_ONLINE' : 'CABLE_ONLY';
    }
    return 'ARES_ONLINE';
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

  /**
   * Estimate the ARES absolute hardware time at the exact moment the gun fired.
   *
   * CMD 0x32 heartbeats arrive every ~1 second. If the gun fires 0.8s after a
   * heartbeat, lastUptimeSecs is still the old value. We add the wall-clock
   * elapsed time since the last heartbeat to get sub-second accuracy.
   *
   * Example: heartbeat shows 0.00s at T=0ms. Gun fires at T=2670ms.
   *   → interpolatedGunTime = 0.00 + 2670/1000 = 2.67s  ✓
   *   → touch at ARES absolute 7.67s → netSecs = 7.67 - 2.67 = 5.00s  ✓
   */
  private interpolateGunTime(): number {
    if (this.lastUptimeReceivedMs === 0) {
      // No heartbeat seen yet — fall back to lastUptimeSecs (likely 0)
      return this.lastUptimeSecs;
    }
    const msSinceHeartbeat = Date.now() - this.lastUptimeReceivedMs;
    const estimated = this.lastUptimeSecs + msSinceHeartbeat / 1000;
    console.log(`[ARES21] Gun time interpolated: lastUptime=${this.lastUptimeSecs.toFixed(3)}s + ${msSinceHeartbeat}ms = ${estimated.toFixed(3)}s`);
    return estimated;
  }

  /**
   * @returns the wall-clock (Date.now()) instant the race actually started, in the same
   * time domain the UI's local race clock runs in — see startWallClockMs below for why.
   */
  markRaceStarted(isHardwareGun: boolean = false, gunHardwareTime?: number): number {
    if (this.isRaceActive) {
      // Should be unreachable — every caller gates on !isRaceActive before calling this.
      // If this ever fires, something is detecting a start twice for the same race, and the
      // second call's disarm/offset overwrite is likely why the clock or touch times misbehave.
      this.emit({ type: 'RUNNING_TIME', time: 0, raw: `[ARES21] WARNING: markRaceStarted called again while already active (hardwareGun=${isHardwareGun}) — investigate double-detection` });
    }
    this.isRaceActive = true;
    let startWallClockMs = Date.now();
    if (isHardwareGun) {
      // Use the gun's own absolute ARES hardware timestamp as the race start offset.
      // Touch timestamps are absolute ARES console uptime, so subtracting the gun's
      // timestamp gives the correct elapsed race time. Never use 0 — that would make
      // touch times equal the raw ARES uptime (e.g. 14s shown instead of 9s).
      this.raceStartHardwareTime = gunHardwareTime ?? this.lastHardwareTime;

      // Translate that ARES-domain timestamp into a wall-clock instant using the most
      // recent heartbeat as the shared anchor between the two clock domains. Without this,
      // the on-screen race clock (driven by Date.now() at whenever this packet happened to
      // be PROCESSED) and touch times (always computed purely in the ARES clock domain) can
      // permanently drift apart by however long USB/serial buffering or detection latency
      // added — e.g. the displayed clock reading 8.94s while a touch correctly shows 11.24s.
      if (this.lastUptimeReceivedMs > 0 && this.raceStartHardwareTime > 0) {
        const aresSecsSinceHeartbeat = this.raceStartHardwareTime - this.lastUptimeSecs;
        const estimated = this.lastUptimeReceivedMs + aresSecsSinceHeartbeat * 1000;
        // Clamp to sane bounds — never in the future, never absurdly far in the past —
        // in case the heartbeat anchor is stale or the interpolation is off.
        startWallClockMs = Math.min(Date.now(), Math.max(Date.now() - 5000, estimated));
      }
    } else {
      this.raceStartHardwareTime = this.lastHardwareTime;
    }
    this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[SYSTEM] Started race clock.' });
    // Instantly emit 0.00s running time for zero latency
    this.emit({ type: 'RUNNING_TIME', time: 0, raw: 'TIMER: 00.00' });
    // Switch hardware to live/disarm mode (turns OFF Green Ready Light, activates Red LED while clock runs)
    this.disarmAres();
    return startWallClockMs;
  }

  async resetRaceStartHardwareTime() {
    this.isRaceActive = false;
    this.raceStartHardwareTime = 0;
    this.lastStartSignalTimestamp = 0;
    this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[SYSTEM] Stopped race clock.' });
    // NOTE: Do NOT clear lastUptimeSecs here — the CMD 0x32 clock-drop gun detection
    // needs the pre-reset high-water mark to be > 1.0 so the heuristic fires correctly
    // on the next race. Clearing it makes rawSecs < lastUptimeSecs - 0.5 always false.
    this.suppressGunDetectUntil = Date.now() + 2500; // Guard during full initialization + settling time
    this.lastTouchTimestampByLane = {};
    this.lastTouchTimestampByLaneAndMethod = {};
    this.pendingT2 = null; // discard any half-received T2 pair
    await this.sendAresInit();
  }

  async armLanes(force: boolean = false) {
    if (this.isArmed && !force) return; // Already armed — skip duplicate call
    const now = Date.now();
    if (now - this.lastArmTimestamp < 400 && !force) {
      console.log('[ARES21] Arm command suppressed due to 400ms cooldown protection');
      return;
    }
    this.lastArmTimestamp = now;
    this.isArmed = true; // Optimistic lock: prevent concurrent arm calls immediately

    if (this.isConnected()) {
      try {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

        console.log('[ARES21] Arming console — sending paced arm sequence to prevent buffer overflow...');

        const armSteps: Uint8Array[] = [
          // Clean arm sequence (no CMD 0x24 relay flip-flop)
          new Uint8Array([0x01, 0x31, 0x02, 0xCB, 0x01, 0xFE]),           // CMD 0x31 mode enable
          new Uint8Array([0x01, 0x14, 0x03, 0xE7, 0x6F, 0xEF, 0xA1]),    // CMD 0x14 timer config
          new Uint8Array([0x01, 0x16, 0x03, 0xE5, 0x00, 0x00, 0xFF]),    // CMD 0x16 ARM LANES → Green Light ON
          new Uint8Array([0x01, 0x13, 0x04, 0xE7, 0x00, 0x01, 0x01, 0xFD]), // CMD 0x13
          // Per-lane arm loop (CMD 0x23), two writes per lane for lanes 1-8:
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x70, 0x8F]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF0, 0x0F]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x71, 0x8E]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF1, 0x0E]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x72, 0x8D]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF2, 0x0D]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x73, 0x8C]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF3, 0x0C]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x74, 0x8B]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF4, 0x0B]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x75, 0x8A]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF5, 0x0A]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x76, 0x89]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF6, 0x09]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0x77, 0x88]),
          new Uint8Array([0x01, 0x23, 0x02, 0xD9, 0xF7, 0x08]),
          new Uint8Array([0x01, 0x10, 0x04, 0xEA, 0x01, 0x00, 0x00, 0xFE]), // CMD 0x10
          new Uint8Array([0x01, 0x10, 0x04, 0xEA, 0x00, 0x00, 0x01, 0xFE]), // CMD 0x10
          new Uint8Array([0x01, 0x13, 0x04, 0xE7, 0x00, 0x01, 0x01, 0xFD]), // CMD 0x13
          new Uint8Array([0x01, 0x12, 0x03, 0xE9, 0x44, 0x00, 0xBB]),    // CMD 0x12
          new Uint8Array([0x01, 0x25, 0x02, 0xD7, 0x00, 0xFF]),           // CMD 0x25 READY SIGNAL → Green LED ON!
          new Uint8Array([0x01, 0x11, 0x04, 0xE9, 0x00, 0x11, 0x28, 0xC6]), // CMD 0x11
          new Uint8Array([0x01, 0x11, 0x04, 0xE9, 0x01, 0x28, 0x28, 0xAE]), // CMD 0x11
        ];

        let allOk = true;
        for (const step of armSteps) {
          const stepOk = await this.safeWrite(step);
          if (!stepOk) allOk = false;
          await delay(20); // 20ms pacing between sub-packets
        }

        if (allOk) {
          this.suppressGunDetectUntil = 0; // Arming complete & Green Light ON — unblock gun detection immediately!
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Ready Green Light ON (CMD 0x25 + CMD 0x16)' });
          console.log('[ARES21] Sent Arm command — Green Ready Light ON.');
        } else {
          this.isArmed = false; // Rollback if write failed
        }
      } catch (e) {
        this.isArmed = false; // Rollback on error
        console.warn('[ARES21] Arm error:', e);
      }
    } else {
      this.isArmed = false; // Rollback: no port
    }
  }

  async disarmAres() {
    if (!this.isArmed) return; // Already disarmed — skip duplicate call
    this.isArmed = false; // Optimistic lock: prevent concurrent disarm calls immediately
    if (this.isConnected()) {
      try {
        console.log('[ARES21] Disarming console...');
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        const disarmSteps: Uint8Array[] = [
          new Uint8Array([0x01, 0x26, 0x02, 0xD6, 0x00, 0xFF]),       // CMD 0x26 disarm step 1
          new Uint8Array([0x01, 0x31, 0x02, 0xCB, 0x00, 0xFF]),       // CMD 0x31 mode disable
          new Uint8Array([0x01, 0x16, 0x03, 0xE5, 0x00, 0x00, 0x00]),   // CMD 0x16 disarm lanes → Green Light OFF
        ];
        let allOk = true;
        for (const step of disarmSteps) {
          const ok = await this.safeWrite(step);
          if (!ok) allOk = false;
          await delay(20);
        }
        if (allOk) {
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Green Ready Light OFF (disarmed)' });
          this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[ARES21] Sent Disarm command — Green Ready Light OFF.' });
        } else {
          this.isArmed = true; // Rollback if write failed
        }
      } catch (e) {
        this.isArmed = true; // Rollback on error
        console.warn('[ARES21] Disarm error:', e);
      }
    } else {
      this.isArmed = true; // Rollback: no port
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
      // 1. WebSocket bridge transport
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(data);
          return true;
        } catch (e) {
          console.warn('[ARES21] safeWrite ws error:', e);
          return false;
        }
      }
      // 2. Direct Web Serial transport
      if (this.port?.writable) {
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
          console.warn('[ARES21] safeWrite port write error:', e);
          return false;
        }
      }
      return false;
    });
    return this.writeQueue;
  }

  async rearmAres() {
    if (this.isConnected()) {
      console.log('[ARES21] Re-arm / re-initializing console...');
      await this.sendAresInit();
    }
  }

  // ─── Exact ARES v2.06 Initialization Sequence ─────────────
  private async sendAresInit() {
    if (!this.isConnected()) return;
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

      // 8. Config 02: Mode setup (byte order verified against real SWIMM.EXE capture: 05 08 07 EA 01)
      await this.safeWrite(new Uint8Array([0x01, 0x02, 0x05, 0xF7, 0x05, 0x08, 0x07, 0xEA, 0x01]));
      await delay(60);

      // 9. Config 03: Start mode
      await this.safeWrite(new Uint8Array([0x01, 0x03, 0x03, 0xF8, 0x02, 0x02, 0xFB]));
      await delay(60);

      // 10. Config 84: Display mode
      await this.safeWrite(new Uint8Array([0x01, 0x84, 0x02, 0x78, 0x08, 0xF7]));
      await delay(60);

      // 11. Config 9F (payload byte verified against real SWIMM.EXE capture: 07, not 00)
      await this.safeWrite(new Uint8Array([0x01, 0x9F, 0x02, 0x5D, 0x07, 0xF8]));
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

      this.isArmed = false;
      await this.armLanes(true);

      this.emit({
        type: 'RUNNING_TIME', time: 0,
        raw: '[HARDWARE] ARES 21 online. Red LED blinking.'
      });
      this.emit({
        type: 'RUNNING_TIME', time: 0,
        raw: '[ARES21] Ready Green Light ON — Lanes armed.'
      });
      this.emit({
        type: 'RUNNING_TIME', time: 0,
        raw: '[SYSTEM] Synchronized with ARES 21 hardware port. Console 100% READY.'
      });

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
    if (!this.isConnected()) return;
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

  // ─── Direct Web Serial Port Handler ───────────────────────
  private async openPort(port: any): Promise<boolean> {
    if (!port) return false;
    if (port.readable && this.isReading) return true;

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!port.readable) {
          await port.open({ baudRate: 9600 });
          return true;
        }
        return true;
      } catch (e: any) {
        try {
          if (port.readable) {
            const r = port.readable.getReader();
            await r.cancel();
            r.releaseLock();
          }
        } catch {}
        try { await port.close(); } catch {}
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    return false;
  }

  private async startReadingWebSerial() {
    if (!this.port?.readable) return;
    this.isReading = true;
    this.rawBuf = [];

    setTimeout(() => this.sendAresInit(), 250);

    try {
      this.reader = this.port.readable.getReader();
      const activeReader = this.reader;

      while (this.isReading && activeReader) {
        const { value, done } = await activeReader.read();
        if (done) break;
        if (!value?.length) continue;

        this.processIncomingBytes(value as Uint8Array);
      }
    } catch (err) {
      console.error('[ARES21] Direct Web Serial read error:', err);
    }
  }

  private processIncomingBytes(value: Uint8Array) {
    this.lastByteTimestamp = Date.now();
    const hexStr = Array.from(value)
      .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    console.log('[ARES21] RAW:', hexStr);

    // Direct raw byte scan for ASCII START trigger from starter gun (guarded against startup banner text)
    const chunkTxt = Array.from(value)
      .map((b: number) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ' '))
      .join('');
    if (!this.isRaceActive && Date.now() >= this.suppressGunDetectUntil && /START/i.test(chunkTxt)) {
      console.log('[ARES21] Direct raw chunk START detected:', chunkTxt);
      this.parseAsciiEvent('START');
    }

    for (const b of value) {
      this.rawBuf.push(b);
    }
    this.processBinaryBuffer();
  }

  // ─── WebSocket Bridge Handler ─────────────────────────────
  private connectToBridge(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      let settled = false;
      const socket = new WebSocket(this.bridgeUrl);
      socket.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { socket.close(); } catch {}
        resolve(false);
      }, 1500);

      socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.ws = socket;
        this.wireSocketHandlers(socket);
        this.isReading = true;
        this.rawBuf = [];
        this.emit({ type: 'RUNNING_TIME', time: 0, raw: '[SYSTEM] Connected to CH340 USB Adapter at 9600 baud via Node bridge.' });
        this.startKeepalive();
        setTimeout(() => this.sendAresInit(), 250);
        resolve(true);
      };

      socket.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(false);
      };
    });
  }

  // Dual-transport auto-connect: tries WebSocket bridge first (persistent background COM port across refreshes),
  // then falls back to direct Web Serial in Chrome.
  async autoConnect(): Promise<boolean> {
    if (this.port?.readable && this.isReading) return true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;

    // 1. Try WebSocket bridge first (instant reconnect across page refreshes without touching COM port)
    const bridgeOk = await this.connectToBridge();
    if (bridgeOk) {
      console.log('[ARES21] Auto-connected via persistent Node.js WebSocket bridge.');
      return true;
    }

    // 2. Fallback to direct Chrome Web Serial for previously-granted ports
    if (typeof window !== 'undefined' && 'serial' in navigator) {
      try {
        const granted: any[] = await (navigator as any).serial.getPorts();
        if (granted && granted.length > 0) {
          for (const p of granted) {
            try { if (p.readable) await p.close(); } catch {}
            if (await this.openPort(p)) {
              this.port = p;
              try { await p.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch {}
              this.startReadingWebSerial();
              await this.sendAresInit();
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('[ARES21] Direct Web Serial auto-connect check:', e);
      }
    }

    return false;
  }

  // Unified Connect: Tries WebSocket bridge first, then opens Chrome's native Web Serial dialog.
  async connect(_baudRate: number = 9600): Promise<boolean> {
    this.stopKeepalive();

    // If already connected via direct Web Serial or WebSocket, return true
    if (this.port?.readable && this.isReading) return true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;

    // 1. Try WebSocket bridge first (persistent background process)
    const bridgeOk = await this.connectToBridge();
    if (bridgeOk) return true;

    // 2. Try Direct Native Chrome Web Serial dialog if bridge is not running
    if (typeof window !== 'undefined' && 'serial' in navigator) {
      try {
        const p = await (navigator as any).serial.requestPort();
        if (p) {
          const opened = await this.openPort(p);
          if (opened) {
            this.port = p;
            try { await p.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch {}
            this.startReadingWebSerial();
            await this.sendAresInit();
            return true;
          }
        }
      } catch (err: any) {
        if (err?.name !== 'NotFoundError') {
          console.warn('[ARES21] Native Web Serial dialog error:', err);
        }
      }
    }

    throw new Error(
      'Could not connect to ARES 21. Please select USB-SERIAL CH340 from the browser popup window or ensure the local bridge is running.'
    );
  }

  async disconnect() {
    this.stopKeepalive();
    await this.disarmAres();
    this.isReading = false;

    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      try { this.reader.releaseLock(); } catch {}
      this.reader = null;
    }

    if (this.port) {
      try {
        if (this.port.readable || this.port.writable) {
          await this.port.close();
        }
      } catch {}
      this.port = null;
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    if (this.pinSignalInterval) {
      clearInterval(this.pinSignalInterval);
      this.pinSignalInterval = null;
    }
    this.rawBuf = [];
    this.lastTouchTimestampByLane = {};
    this.bridgeReportsDeviceConnected = false;
    this.emit({ type: 'FINISH', time: 0, raw: 'SYSTEM: DISCONNECTED', lane: 0 });
  }

  // ─── WebSocket Message Handling ─────────────────────────────
  private wireSocketHandlers(socket: WebSocket) {
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'status') {
            const prevConnected = this.bridgeReportsDeviceConnected;
            this.bridgeReportsDeviceConnected = !!msg.deviceConnected;
            if (!prevConnected && this.bridgeReportsDeviceConnected) {
              console.log('[ARES21] Bridge device ready signal received — triggering ARES 21 initialization...');
              this.sendAresInit();
            }
          }
        } catch {}
        return;
      }

      const value = new Uint8Array(event.data as ArrayBuffer);
      if (!value.length) return;
      this.processIncomingBytes(value);
    };

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.isReading = false;
      this.stopKeepalive();
      this.ws = null;
      this.bridgeReportsDeviceConnected = false;
      this.emit({ type: 'FINISH', time: 0, raw: 'SYSTEM: DISCONNECTED', lane: 0 });
    };

    socket.onerror = () => {
      console.warn('[ARES21] Bridge WebSocket error');
    };
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
          // CMD 0x30 is used only for hardware timing reference (splits/finishes).
          // The race DISPLAY clock is driven by the local requestAnimationFrame loop in App.tsx.
        }
        break;
      }

      // CMD 0x32 – Running Timer Heartbeat (every ~1 second)
      case 0x32: {
        if (data.length >= 4) {
          // Packet format: 01 32 05 C7 [00] [hi] [mid] [lo] [checksum]
          // data = packet.slice(4), so:
          //   data[0] = 0x00  (always zero padding)
          //   data[1..3] = 24-bit big-endian millisecond tick counter
          // e.g. 01 32 05 c7 00 00 03 e8 14 → ticks = 0x0003E8 = 1000 → 1.000s
          const ticks = ((data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
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
            if (now - this.lastStartSignalTimestamp >= 1000) {
              console.log(`[ARES21] STARTER GUN TRIGGERED via clock reset! (${this.lastUptimeSecs.toFixed(2)}s → ${rawSecs.toFixed(2)}s)`);
              this.lastStartSignalTimestamp = now;
              // Interpolate the gun's absolute ARES time using the last heartbeat value plus
              // wall-clock elapsed — far more accurate than raw lastUptimeSecs when the gun
              // fires within the first second after a heartbeat.
              const startTs = this.markRaceStarted(true, this.interpolateGunTime());
              this.emit({ type: 'START', time: 0, startTimestamp: startTs, raw: 'HARDWARE STARTER GUN (clock reset)' });
            }
          }
          // Record when this heartbeat arrived for sub-second gun timestamp interpolation
          this.lastUptimeReceivedMs = Date.now();
          this.lastUptimeSecs = rawSecs;

          if (this.isRaceActive) {
            if (this.raceStartHardwareTime > 0 && rawSecs < this.raceStartHardwareTime) {
              this.raceStartHardwareTime = rawSecs;
            }
            const displayTime = Math.max(0, rawSecs - this.raceStartHardwareTime);
            // Log to console for debug, but do NOT emit RUNNING_TIME.
            // The race display clock is driven by the local requestAnimationFrame loop in App.tsx.
            console.log(`[ARES21] CMD 0x32 race elapsed: ${this.formatTime(displayTime)} (hardware uptime: ${this.formatTime(rawSecs)})`);
          }
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
        // Gun fires: data[2] === 0x4C (valid gun start timing marker)
        // Touchpad:  data[2] >= 0x40 (handled by parseCmd40)
        const isGunDevice = data.length >= 3 && data[2] === 0x4C;

        if (isGunDevice) {
          if (!this.isRaceActive && Date.now() >= this.suppressGunDetectUntil) {
            const now = Date.now();
            if (now - this.lastStartSignalTimestamp >= 1000) {
              console.log(`[ARES21] STARTER GUN TRIGGERED (CMD 0x40, device=0x${data[1].toString(16).padStart(2,'0')})!`);
              this.lastStartSignalTimestamp = now;
              // Extract the gun's own ARES hardware timestamp from the packet bytes [8..11].
              // This is the absolute ARES uptime at the moment the gun fired — used as the
              // race-start offset so touch times compute correctly: netTime = touchAbsTime - gunAbsTime.
              // If gunTicks is 0 (ARES just initialized / packet doesn't carry timing), fall back
              // to interpolateGunTime() which estimates the gun time from the last CMD 0x32 heartbeat
              // plus wall-clock elapsed since that heartbeat.
              const gunTicks = (data.length >= 12)
                ? (((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0)
                : 0;
              const gunTime = (gunTicks > 0) ? gunTicks / 1000 : this.interpolateGunTime();
              console.log(`[ARES21] Gun hardware timestamp: ${gunTime.toFixed(3)}s (ticks=${gunTicks})`);
              const startTs = this.markRaceStarted(true, gunTime);
              this.emit({ type: 'START', time: 0, startTimestamp: startTs, raw: 'HARDWARE STARTER GUN' });
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
      if (now - this.lastStartSignalTimestamp < 1000) {
        this.emit({ type: 'RUNNING_TIME', time: 0, raw: `[ARES21] Ignored duplicate START pulse ("${line}") within 1s window` });
        return;
      }
      this.lastStartSignalTimestamp = now;
      this.markRaceStarted();
      this.emit({ type: 'START', time: 0, raw: `ASCII START ("${line}")` });
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
    if (this.isRaceActive) {
      // markRaceStarted() was already invoked moments earlier by whatever actually detected
      // this start (the ASCII/manual START parser or a hardware gun-detection path) — that's
      // the sole source of truth for raceStartHardwareTime now. Re-running it here would
      // silently overwrite the correct (possibly hardware-timestamp-anchored) start offset
      // with a stale this.lastHardwareTime snapshot, corrupting every touch time computed
      // for the rest of the race, and would also re-send a redundant disarm write.
      console.log('[ARES21] sendRaceStartSignal: race already active — skipping redundant re-mark.');
      return true;
    }
    console.log('[ARES21] Manual Start signal — disarming console for live race.');
    this.markRaceStarted(false);
    return true;
  }

  async sendRaceResetSignal(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastResetTimestamp < 500) {
      // Guards against duplicate callers within the same click (this exact bug shipped once
      // already — see OperatorConsole.tsx's onResetRaceClick). Sending the full 13-command
      // arm sequence twice per reset is what causes the ARES 21 3-beep error lockout.
      console.log('[ARES21] sendRaceResetSignal: duplicate reset call within 500ms — skipping to avoid double-arm.');
      return true;
    }
    this.lastResetTimestamp = now;
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
