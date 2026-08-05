# ARES 21 Timing System: T1 & T2 Decoding & Real-Time Arbitration Review

This document provides a technical review of the hardware signal decoding, debouncing, and real-time arbitration procedure for **T1 (Primary Touchpad)** and **T2 (Timekeeper Backup Button)** timing signals in TouchTeck Software.

---

## 1. Hardware Packet Structure & Byte Decoding

The ARES 21 electronic timing console sends timing events over USB serial using binary packets starting with command `0x40`.

### Serial Packet Byte Layout (`CMD 0x40`)
`01 40 11 ad 00 [b1] [b2] 3b 00 01 00 00 00 00 [TH] [TL] ...`

* **`b2` (`data[2]`)**: Hardware Sensor Identifier & Lane Number.
* **`TH TL` (`data[8..11]`)**: 32-bit Big-Endian Millisecond Timestamp (`ticks`).

| Sensor Type | `b2` (`data[2]`) Byte Range | Formula | Decoded Lane | Emitted Method |
|---|---|---|---|---|
| **T1 Primary Touchpad** | `0x40 .. 0x47` | `(data[2] & 0x07) + 1` | Lanes 1 – 8 | `T1` |
| **T2 Backup Hand Button** | `0x20 .. 0x27` | `(data[2] & 0x07) + 1` | Lanes 1 – 8 | `T2` |
| **T2 Companion Frame** | `0xa0 .. 0xa7` | *Ignored (metadata frame)* | N/A | Ignored |

### Driver Implementation (`src/serialDriver.ts`)

```typescript
private parseCmd40(data: number[], forceMethod?: 'T1' | 'T2') {
  if (data.length < 12) return;

  const b2 = data[2];

  // ══ T1 PRIMARY TOUCHPAD (0x40–0x47) ════════════════════════════════
  if (b2 >= 0x40 && b2 <= 0x47) {
    const lane = (b2 & 0x07) + 1;
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

  // Ignore T2 odd companion metadata frames (0xa0..0xa7)
  if (b2 >= 0xa0 && b2 <= 0xa7) return;
}
```

---

## 2. Sensor-Specific Contact Debouncing

Mechanical vibration contact chatter is debounced per sensor method (`T1` vs `T2`). This guarantees that a T1 touchpad hit is **never dropped** even if a timekeeper hits the T2 button immediately before or after.

```typescript
private lastTouchTimestampByLaneAndMethod: { [key: string]: number } = {};

private emit(event: TimingEvent) {
  if (event.type === 'SPLIT' || event.type === 'FINISH') {
    const lane = event.lane;
    const method = event.timingMethod || 'T1';
    if (lane && lane >= 1 && lane <= 8) {
      const now = Date.now();
      const key = `${lane}_${method}`;
      const lastTouch = this.lastTouchTimestampByLaneAndMethod[key] || 0;
      
      // Debounce contact chatter on SAME sensor method within 400ms
      if (now - lastTouch < 400) return;
      this.lastTouchTimestampByLaneAndMethod[key] = now;
    }
  }
  this.callbacks.forEach(cb => cb(event));
}
```

---

## 3. Real-Time T1 vs T2 Arbitration Procedure

The arbitration manager enforces the FINA/World Aquatics timing hierarchy using a **2-second priority window**.

```
                       [ Incoming Event ]
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
       [ T1 Touchpad ]                [ T2 Hand Button ]
             │                                 │
   Is pending T2 window active?       Was T1 hit <2.5s ago?
       ┌─────┴─────┐                     ┌─────┴─────┐
      YES          NO                   YES          NO
       │            │                    │            │
  Cancel T2     Record T1           Ignore T2     Tentative T2
  Override      directly             (Keep T1)     display & start
  T2 time &                                       2.0s window
  badge                                               │
                                             Wait 2.0s for T1
                                                 ┌────┴────┐
                                                T1        No T1
                                              Arrives    Arrives
                                                 │          │
                                             Override    Confirm
                                              with T1    T2 official
```

### Main Arbitration Implementation (`src/App.tsx`)

```typescript
// ── Arbitration Rule 1: T1 touchpad hit arrived ──
let isT2PendingWindowActive = false;
if (timingMethod === 'T1') {
  // If there is a pending T2 timer for this lane, clear it and note window status
  if (pendingT2TimeoutsRef.current[laneNum]) {
    isT2PendingWindowActive = true;
    clearTimeout(pendingT2TimeoutsRef.current[laneNum].timeoutId);
    delete pendingT2TimeoutsRef.current[laneNum];
  }
  lastTouchByLaneRef.current[laneNum] = { method: 'T1', time: event.time, timestamp: now };
}

// ── Arbitration Rule 2: T2 hand button arrived ──
if (timingMethod === 'T2') {
  // If T1 was already recorded first within last 2.5s, ignore T2
  if (lastTouch && lastTouch.method === 'T1' && (now - lastTouch.timestamp < 2500)) {
    return;
  }

  // Register 2.0-second window waiting for T1
  if (pendingT2TimeoutsRef.current[laneNum]) {
    clearTimeout(pendingT2TimeoutsRef.current[laneNum].timeoutId);
  }
  const timeoutId = setTimeout(() => {
    delete pendingT2TimeoutsRef.current[laneNum];
    console.log(`[Arbitration] 2s window expired on Lane ${laneNum} — T2 confirmed official`);
  }, 2000);
  pendingT2TimeoutsRef.current[laneNum] = { time: event.time, timestamp: now, timeoutId };
  lastTouchByLaneRef.current[laneNum] = { method: 'T2', time: event.time, timestamp: now };
}
```

### Lane State & Badge Updates (`src/App.tsx`)

```typescript
setLanes(prev => {
  const currentLanes = prev.map(l => {
    if (l.laneNumber === laneNum) {
      // 1. If lane already finished with T1, ignore any subsequent touch
      if (l.finalTime > 0 && l.timingMethod === 'T1') return l;

      // 2. If lane finished with T2, allow T1 override ONLY IF within 2.0s window
      if (l.finalTime > 0 && l.timingMethod === 'T2') {
        if (timingMethod === 'T1' && isT2PendingWindowActive) {
          const updatedSplits = [...l.splits];
          if (updatedSplits.length > 0) updatedSplits[updatedSplits.length - 1] = event.time;
          return {
            ...l,
            finalTime: event.time,
            splits: updatedSplits,
            timingMethod: 'T1' as const,
            isRunning: false
          };
        }
        // If window expired (>2s), T2 is confirmed official; ignore late T1
        return l;
      }

      if (l.finalTime > 0) return l;

      const isFinal = event.lap ? event.lap >= eventLapsRef.current : ((l.splits.length + 1) >= eventLapsRef.current);
      const updatedSplits = [...l.splits];
      const resolvedTimingMethod: 'T1' | 'T2' = timingMethod === 'T2' ? 'T2' : 'T1';

      if (l.timingMethod === 'T2' && resolvedTimingMethod === 'T1' && updatedSplits.length > 0) {
        if (isT2PendingWindowActive) {
          updatedSplits[updatedSplits.length - 1] = event.time;
        }
      } else {
        if (!updatedSplits.includes(event.time)) updatedSplits.push(event.time);
      }

      return {
        ...l,
        splits: updatedSplits,
        finalTime: isFinal ? event.time : l.finalTime,
        timingMethod: resolvedTimingMethod === 'T1' ? 'T1' : (l.timingMethod || resolvedTimingMethod),
        isRunning: !isFinal
      };
    }
    return l;
  });
  return currentLanes;
});
```

---

## 4. Multi-Heat & Reset State Management

To guarantee that arbitration memory does not carry over between heats or after stopping/resetting:

1. **On Race Start (`triggerStart`)**:
   - `serialDriver.markRaceStarted()` locks the hardware clock reference.
   - Clears `pendingT2TimeoutsRef` and `lastTouchByLaneRef`.
   - Clears `timingMethod: undefined` on all lanes.

2. **On Heat/Event Change**:
   - Clears `pendingT2TimeoutsRef` and `lastTouchByLaneRef`.

3. **On Timer Reset (`handleResetTimer`)**:
   - `serialDriver.resetRaceStartHardwareTime()` resets hardware offsets.
   - Clears all pending timers and lane touch records.
   - Resets `timingMethod: undefined` across all 8 lanes.

---

## 5. Summary Matrix of Arbitration Outcomes

| Sequence | Touch Interval | Time Recorded | Badge Displayed |
|---|---|---|---|
| **T1 first, T2 second** | Any time | **T1 Time** | **T1** |
| **T2 first, T1 second** | **Within 2.0s** | **T1 Time** *(Overridden)* | **T1** |
| **T2 first, T1 second** | **After 2.0s** | **T2 Time** *(Preserved)* | **T2** |
| **T2 first, no T1** | 2.0+ seconds | **T2 Time** | **T2** |
