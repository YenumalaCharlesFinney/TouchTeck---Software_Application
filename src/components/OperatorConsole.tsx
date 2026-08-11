import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, Event } from '../db';
import { serialDriver, simulator, TimingEvent } from '../serialDriver';
import { ScoreboardDisplayConfig, DEFAULT_SCOREBOARD_CONFIG, ScoreboardResolution } from '../types';
import { Terminal, Cpu, Play, Square, RotateCcw, Save, ShieldAlert, Radio, HelpCircle, CheckCircle2, Plus, Activity, ShieldCheck, Power, Copy, Check, Loader2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import { useModalClose } from '../hooks/useModalClose';

interface Swimmer {
  id?: number;
  name: string;
  ageGroup: string;
  club: string;
}

interface LaneState {
  laneNumber: number;
  swimmer?: Swimmer;
  qualifyingTime?: number;
  splits: number[];
  finalTime: number;
  status: 'OK' | 'DNS' | 'DNF' | 'DQ' | 'NT';
  timingMethod?: 'T1' | 'T2';
  isRunning: boolean;
  lastSplitTime?: number;
  lastSplitTimestamp?: number;
}

interface OperatorConsoleProps {
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  activeMeetId: number | null;
  activeEventId: number | null;
  setActiveEventId: (id: number | null) => void;
  activeHeatNum: number;
  setActiveHeatNum: (num: number) => void;
  isFinals: boolean;
  setIsFinals: (isFinals: boolean) => void;
  elapsedTime: number;
  timerStatus: 'IDLE' | 'READY' | 'RUNNING' | 'FINISHED';
  lanes: LaneState[];
  handleManualStart: () => void;
  handleResetTimer: () => void;
  handleStopTimer: () => void;
  handleSaveResults: () => void;
  isSavingResults?: boolean;
  eventLaps: number;
  bothEnds: boolean;
  setBothEnds: (both: boolean) => void;
  scoreboardConfig?: ScoreboardDisplayConfig;
  setScoreboardConfig?: React.Dispatch<React.SetStateAction<ScoreboardDisplayConfig>>;
  isTestMode?: boolean;
  setIsTestMode?: (val: boolean) => void;
  setShowTestModeConfirm?: (val: boolean) => void;
  serialStatus?: 'DISCONNECTED' | 'CONNECTED' | 'SIMULATOR';
  armingCooldown?: number;
}

export default function OperatorConsole({
  armingCooldown = 0,
  serialStatus,
  isSimulating,
  setIsSimulating,
  activeMeetId,
  activeEventId,
  setActiveEventId,
  activeHeatNum,
  setActiveHeatNum,
  isFinals,
  setIsFinals,
  elapsedTime,
  timerStatus,
  lanes,
  handleManualStart,
  handleResetTimer,
  handleStopTimer,
  handleSaveResults,
  isSavingResults = false,
  eventLaps,
  bothEnds,
  setBothEnds,
  scoreboardConfig = DEFAULT_SCOREBOARD_CONFIG,
  setScoreboardConfig,
  isTestMode,
  setIsTestMode,
  setShowTestModeConfirm
}: OperatorConsoleProps) {
  const [meets, setMeets] = useState<Meet[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(activeMeetId);
  const [availableHeats, setAvailableHeats] = useState<number[]>([1]);
  const [baudRate, setBaudRate] = useState(9600);

  useEffect(() => {
    if (activeEventId) {
      loadAvailableHeats(activeEventId);
    } else {
      setAvailableHeats([1]);
    }
  }, [activeEventId, activeHeatNum]);

  const loadAvailableHeats = async (eventId: number) => {
    const assignments = await db.laneAssignments.where('eventId').equals(eventId).toArray();
    const results = await db.results.where('eventId').equals(eventId).toArray();

    const heatSet = new Set<number>();
    assignments.forEach(a => heatSet.add(a.heatNumber));
    results.forEach(r => heatSet.add(r.heatNumber));
    heatSet.add(activeHeatNum);

    const sortedHeats = Array.from(heatSet).sort((a, b) => a - b);
    setAvailableHeats(sortedHeats.length > 0 ? sortedHeats : [1]);
  };

  const handleAddHeat = () => {
    const nextHeat = availableHeats.length > 0 ? Math.max(...availableHeats) + 1 : 1;
    const updated = [...availableHeats, nextHeat].sort((a, b) => a - b);
    setAvailableHeats(updated);
    setActiveHeatNum(nextHeat);
  };
  const [isConnected, setIsConnected] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [onlyImportantLogs, setOnlyImportantLogs] = useState<boolean>(true); // Default to filtered mode for readability
  const [showSimConfirm, setShowSimConfirm] = useState(false);
  const [showUsbModal, setShowUsbModal] = useState(false);
  const [showSimOffModal, setShowSimOffModal] = useState<boolean>(false);
  const { isClosing: isUsbModalClosing, triggerClose: closeUsbModal } = useModalClose();
  const { isClosing: isSimOffModalClosing, triggerClose: closeSimOffModal } = useModalClose();
  const [usbErrorMsg, setUsbErrorMsg] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const isHardwareConnected = isConnected || serialStatus === 'CONNECTED' || serialDriver.isConnected();
  const isSessionActive = isSimulating || isHardwareConnected;

  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const eventSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMeets();
    const unsub = serialDriver.onData((event: TimingEvent) => {
      if (event.raw) {
        setConsoleLogs(prev => {
          const next = [...prev, event.raw!];
          return next.length > 2500 ? next.slice(-2500) : next;
        });
      }
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (selectedMeetId) {
      loadEvents(selectedMeetId);
    } else {
      setEvents([]);
    }
  }, [selectedMeetId]);

  const loadMeets = async () => {
    const list = await db.meets.toArray();
    setMeets(list);
    if (list.length > 0) {
      const initialMeetId = activeMeetId && list.some(m => m.id === activeMeetId) ? activeMeetId : list[0].id!;
      setSelectedMeetId(initialMeetId);
      loadEvents(initialMeetId);
    }
  };

  const loadEvents = async (meetId: number) => {
    const list = await db.events.where('meetId').equals(meetId).toArray();
    setEvents(list);
    if (list.length > 0) {
      if (!activeEventId || !list.some(e => e.id === activeEventId)) {
        setActiveEventId(list[0].id!);
      }
    }
  };

  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [consoleLogs, onlyImportantLogs]);

  const onStartRaceClick = () => {
    if (isConnected || isTestMode) {
      // handleManualStart → triggerStart → sendRaceStartSignal → markRaceStarted(false) → disarmAres.
      // Do NOT additionally call sendSerialData('START') or injectRawLine('START') —
      // those triggered extra markRaceStarted() calls causing triple disarm → ARES 21 3-beep lockout.
      handleManualStart();
      setConsoleLogs(prev => [...prev, '[HARDWARE] Sent START command to ARES 21 console via Serial.']);
    } else if (isSimulating) {
      setSimRunning(true);
      const swimmerLanes = lanes.filter(l => l.swimmer).map(l => l.laneNumber);
      const activeLanes = swimmerLanes.length > 0 ? swimmerLanes : [1, 2, 3, 4, 5, 6, 7, 8];
      simulator.startRace(eventLaps, activeLanes);
      setConsoleLogs(prev => [...prev, `[SIMULATOR] Starting race: ${eventLaps} length(s) for lanes [${activeLanes.join(', ')}]`]);
    } else {
      setShowSimOffModal(true);
    }
  };

  const onStopRaceClick = () => {
    if (isSimulating) {
      simulator.stop();
    }
    setSimRunning(false);
    handleStopTimer();
    setConsoleLogs(prev => [...prev, '[SYSTEM] Stopped race clock.']);
  };

  const onResetRaceClick = () => {
    if (isSimulating) {
      simulator.stop();
      simulator.reset();
    }
    // Do NOT also call serialDriver.sendRaceResetSignal() here — handleResetTimer() (below)
    // already does that. Calling it twice sends the full 13-command arm sequence to the
    // physical console twice per Reset click, which is what causes the ARES 21 3-beep
    // error lockout after a couple of reset cycles.
    setSimRunning(false);
    handleResetTimer();
    setConsoleLogs(prev => [...prev, '[SYSTEM] Reset race timer to READY.']);
  };

  const handleTestingCompleted = () => {
    setIsTestMode?.(false);
    handleResetTimer();
    setConsoleLogs(prev => [...prev, '[SYSTEM] Test mode completed. Unchecked test mode and reset clock.']);
    if (eventSectionRef.current) {
      eventSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleSimulator = () => {
    if (isSimulating || isConnected) {
      setShowSimConfirm(true);
    } else {
      setIsSimulating(true);
      setConsoleLogs(prev => [...prev, '[SYSTEM] Simulator Mode ENABLED.']);
    }
  };

  const isUserCancellation = (err: any): boolean => {
    const msg = err?.message || String(err || '');
    const name = err?.name || '';
    return (
      name === 'NotFoundError' ||
      msg.includes('No port selected') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('User cancelled')
    );
  };

  const handleConnect = async () => {
    try {
      const success = await serialDriver.connect(baudRate);
      if (success) {
        if (isSimulating) {
          setIsSimulating(false);
          simulator.stop();
          setSimRunning(false);
        }
        setIsConnected(true);
        setShowUsbModal(false);
        setUsbErrorMsg(null);
        setConsoleLogs(prev => [...prev, `[SYSTEM] Connected to CH340 USB Adapter at ${baudRate} baud. Waiting for ARES 21 data stream...`]);
      }
    } catch (err: any) {
      if (isUserCancellation(err)) {
        console.log('[SYSTEM] Serial port selection cancelled by user. Retaining Simulator Mode.');
        setConsoleLogs(prev => [...prev, '[SYSTEM] Serial port selection cancelled by user. Remaining in Simulator Mode.']);
        return;
      }
      setUsbErrorMsg(err?.message || 'No compatible serial device selected or port failed to open.');
      setShowUsbModal(true);
    }
  };

  const handleDisconnect = async () => {
    await serialDriver.disconnect();
    setIsConnected(false);
    setConsoleLogs(prev => [...prev, '[SYSTEM] Serial hardware disconnected.']);
  };

  const handleSimulatorButtonClick = async () => {
    if (isSimulating) {
      setShowSimConfirm(true);
      return;
    }
    setIsSimulating(true);
    setConsoleLogs(prev => [...prev, '[SYSTEM] Simulator Mode ENABLED.']);
  };

  const handleConfirmStopSim = async () => {
    setShowSimConfirm(false);
    setIsSimulating(false);
    simulator.stop();
    setSimRunning(false);
    setConsoleLogs(prev => [...prev, '[SYSTEM] Simulator Mode DISABLED.']);
  };

  const formatLogForDisplay = (log: string): string | null => {
    // 1. In Full Chat / Raw Stream mode (onlyImportantLogs === false), show EVERYTHING including raw hex!
    if (!onlyImportantLogs) return log;

    // 2. In Main Content Only mode (onlyImportantLogs === true), filter out ONLY raw hex byte dumps & status poll keepalives
    if (
      log.includes('TIMER:') ||
      log.includes('[ARES21] Status OK') ||
      log.includes('01 F7 02 05 04 FB') ||
      log.includes('01 F7 02') ||
      log.includes('[ARES21] 0x') ||
      log.includes('[SNIFFER') ||
      /0x[0-9A-Fa-f]{2}/.test(log)
    ) {
      return null;
    }

    // Format raw TOUCH lines cleanly into "[TOUCHPAD (T1)] / [BACKUP BUTTON (T2)] Lane X Active — Touch Recorded: Time"
    if (log.includes('TOUCH')) {
      const match = log.match(/TOUCH\s+(?:\(([A-Z0-9]+)\)\s+)?Lane(\d+)\s+([\d:\.]+)/i);
      if (match) {
        const method = match[1] || 'T1';
        const tag = method === 'T2' ? '[BACKUP BUTTON (T2)]' : '[TOUCHPAD (T1)]';
        return `${tag} Lane ${match[2]} Active — Touch Recorded: ${match[3]}`;
      }
      return log.replace(/^TOUCH\s*/i, '[TOUCHPAD] ');
    }

    return log;
  };

  const displayedLogs = consoleLogs
    .map(formatLogForDisplay)
    .filter((log): log is string => log !== null);

  const handleSimStart = () => {
    if (!isSimulating) return;
    setSimRunning(true);
    const swimmerLanes = lanes.filter(l => l.swimmer).map(l => l.laneNumber);
    const activeLanes = swimmerLanes.length > 0 ? swimmerLanes : [1, 2, 3, 4, 5, 6, 7, 8];
    simulator.startRace(eventLaps, activeLanes);
    setConsoleLogs(prev => [...prev, `[SIMULATOR] Starting race: ${eventLaps} length(s) for lanes [${activeLanes.join(', ')}]`]);
  };

  const handleSimStop = () => {
    simulator.stop();
    setSimRunning(false);
    handleStopTimer();
    setConsoleLogs(prev => [...prev, '[SIMULATOR] Simulator race stopped. Clock stopped.']);
  };

  const handleSimReset = () => {
    simulator.stop();
    setSimRunning(false);
    handleResetTimer();
    setConsoleLogs(prev => [...prev, '[SIMULATOR] Simulator reset. Race timer reset.']);
  };

  const handleDisarmAresClick = () => {
    serialDriver.disarmAres();
    setConsoleLogs(prev => [...prev, '[HARDWARE] ARES 21 Disarmed (Red Light OFF).']);
  };

  const handleForceSplit = (laneNumber: number) => {
    const lane = lanes.find(l => l.laneNumber === laneNumber);
    if (!lane) return;

    if (isSimulating) {
      simulator.manualSplit(laneNumber, elapsedTime);
    } else {
      const formattedTime = formatSecondsToTime(elapsedTime);
      const currentSplits = lane.splits.length;
      const nextLap = currentSplits + 1;
      // Inject a Split Touch event (Format: LANE LAP TIME)
      serialDriver.injectRawLine(`0${laneNumber} ${nextLap} ${formattedTime}`);
    }
  };

  const handleForceFinish = (laneNumber: number) => {
    const lane = lanes.find(l => l.laneNumber === laneNumber);
    if (!lane) return;

    if (isSimulating) {
      simulator.manualFinish(laneNumber, elapsedTime);
    } else {
      const formattedTime = formatSecondsToTime(elapsedTime);
      // Inject a Finish Touch event
      serialDriver.injectRawLine(`TF 0${laneNumber} ${formattedTime}`);
    }
  };

  const clearConsole = () => {
    setConsoleLogs([]);
  };

  const formatTimer = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    const minutesStr = mins > 0 ? `${mins.toString().padStart(2, '0')}:` : '00:';
    return `${minutesStr}${remainingSecs.toFixed(2).padStart(5, '0')}`;
  };

  const activeEvent = events.find(e => e.id === activeEventId);
  const activeMeet = meets.find(m => m.id === selectedMeetId);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
      
      {/* Left Column: Clock Controls & Lanes list */}
      <div className="flex flex-col gap-4">
        
        {/* Large sync clock display for the operator */}
        <div 
          className="glass-card master-timer-card" 
          style={{ 
            position: 'relative', 
            zIndex: 1, 
            background: 'linear-gradient(135deg, #131a2c, #0e1423)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.3rem' }}>
            <div className={`timer-state-label ${timerStatus.toLowerCase()}`} style={{ fontSize: '0.9rem' }}>
              OPERATOR MONITOR CLOCK: {
                isTestMode && (timerStatus === 'READY' || (timerStatus === 'RUNNING' && elapsedTime === 0))
                  ? 'TESTING'
                  : (timerStatus === 'RUNNING' && elapsedTime === 0 ? 'READY' : timerStatus)
              }
            </div>

            {/* Test Mode Checkbox Toggle */}
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                cursor: 'pointer', 
                padding: '0.2rem 0.65rem', 
                borderRadius: '6px', 
                backgroundColor: isTestMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: isTestMode ? '1px solid var(--accent-amber)' : '1px solid var(--border-color)',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={!!isTestMode}
                onChange={() => setShowTestModeConfirm?.(true)}
                disabled={timerStatus === 'RUNNING'}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-amber)' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isTestMode ? 'var(--accent-amber)' : 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                {isTestMode ? 'TEST MODE ACTIVE' : 'Test Mode'}
              </span>
            </label>
          </div>

          <div className={`timer-clock ${timerStatus === 'RUNNING' ? 'running' : timerStatus === 'READY' ? 'ready' : ''}`} style={{ fontSize: '4.5rem', margin: '0.2rem 0', fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(elapsedTime)}
          </div>
          
          <div className="timer-controls">
            {timerStatus === 'READY' && (
              <button 
                className="btn btn-cyan" 
                onClick={onStartRaceClick}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}
              >
                <Play size={18} /> Start Race
              </button>
            )}
            
            {timerStatus === 'RUNNING' && (
              <button 
                className="btn btn-danger" 
                onClick={onStopRaceClick}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              >
                <Square size={18} /> Stop Clock
              </button>
            )}

            {(timerStatus === 'FINISHED' || (timerStatus === 'READY' && elapsedTime > 0)) && (
              <button className="btn btn-cyan font-bold" onClick={onResetRaceClick} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
                <RotateCcw size={18} /> Reset Timer
              </button>
            )}

            {timerStatus === 'FINISHED' && (
              isTestMode ? (
                <button className="btn btn-success" onClick={handleTestingCompleted} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={18} /> Testing Completed
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={handleSaveResults}
                  disabled={isSavingResults}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isSavingResults ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSavingResults ? 'Saving...' : 'Save Results'}
                </button>
              )
            )}
          </div>

          {/* Bottom-Right Starter LED Indicators */}
          <div style={{
            position: 'absolute',
            bottom: '0.75rem',
            right: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.8rem',
            borderRadius: '10px',
            background: 'rgba(8, 12, 22, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Label */}
            <div style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              writingMode: 'horizontal-tb'
            }}>
              STARTER
            </div>

            {/* Starter LED Indicators */}
            {(() => {
              const isHardwareConnected = isConnected || serialStatus === 'CONNECTED' || serialDriver.isConnected();
              const isCooldownActive = armingCooldown > 0;
              const isGreenOn = timerStatus !== 'RUNNING' && !isCooldownActive;
              const isRedOn = timerStatus === 'RUNNING';

              return (
                <>
                  {/* Green/Amber LED — ARMING cooldown or READY */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: isCooldownActive ? '#f59e0b' : (isGreenOn ? '#22c55e' : '#1a3320'),
                      border: `2px solid ${isCooldownActive ? '#fbbf24' : (isGreenOn ? '#4ade80' : '#2d4a32')}`,
                      boxShadow: isCooldownActive
                        ? '0 0 12px #f59e0b, 0 0 24px rgba(245,158,11,0.5), inset 0 1px 3px rgba(255,255,255,0.3)'
                        : (isGreenOn
                          ? '0 0 12px #22c55e, 0 0 24px rgba(34,197,94,0.5), inset 0 1px 3px rgba(255,255,255,0.3)'
                          : 'inset 0 2px 4px rgba(0,0,0,0.5)'),
                      transition: 'all 0.2s ease',
                    }} />
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      color: isCooldownActive ? '#fbbf24' : (isGreenOn ? '#4ade80' : 'rgba(255,255,255,0.25)'),
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap'
                    }}>
                      {isCooldownActive ? `ARMING (${armingCooldown}s)` : 'GREEN'}
                    </span>
                  </div>

                  {/* Red LED — ON when race is RUNNING */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: isRedOn ? '#ef4444' : '#331a1a',
                      border: `2px solid ${isRedOn ? '#f87171' : '#4a2d2d'}`,
                      boxShadow: isRedOn
                        ? '0 0 12px #ef4444, 0 0 24px rgba(239,68,68,0.5), inset 0 1px 3px rgba(255,255,255,0.3)'
                        : 'inset 0 2px 4px rgba(0,0,0,0.5)',
                      transition: 'all 0.2s ease',
                    }} />
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: isRedOn ? '#f87171' : 'rgba(255,255,255,0.25)',
                      letterSpacing: '0.05em'
                    }}>RED</span>
                  </div>

                  {/* Live dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isHardwareConnected ? '#06b6d4' : '#f59e0b',
                    boxShadow: isHardwareConnected ? '0 0 6px #06b6d4' : '0 0 6px #f59e0b',
                    alignSelf: 'center',
                    marginBottom: '1.2rem'
                  }} />
                </>
              );
            })()}
          </div>
        </div>

        {/* Meet/Event/Heat Selectors */}
        <div className="glass-card" ref={eventSectionRef} style={{ position: 'relative', zIndex: 50 }}>
          <h4 className="settings-header"><Radio size={16} /> Controller Assignment</h4>
          <div className="form-row">
            <div className="form-group mb-0">
              <label className="form-label">Active Meet</label>
              <CustomSelect
                disabled={timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                options={meets.map(m => ({ value: m.id!, label: m.name }))}
                value={selectedMeetId || ''}
                placeholder="Select Meet"
                onChange={(val) => setSelectedMeetId(Number(val))}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Active Event</label>
              <CustomSelect
                disabled={timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                options={events.map(ev => ({
                  value: ev.id!,
                  label: `Event #${ev.id}: ${ev.distance}m ${ev.stroke} (${ev.gender === 'M' ? 'Men' : 'Women'} - ${ev.ageGroup})`
                }))}
                value={activeEventId || ''}
                placeholder="Select Event"
                onChange={(val) => setActiveEventId(Number(val))}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Heat Number</label>
              <div className="flex gap-1 items-center">
                <CustomSelect
                  disabled={timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                  options={availableHeats.map(h => ({ value: h, label: `Heat ${h}` }))}
                  value={activeHeatNum}
                  onChange={(val) => setActiveHeatNum(Number(val))}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 0.6rem' }}
                  title="Add New Heat"
                  onClick={handleAddHeat}
                  disabled={timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Stage</label>
              <CustomSelect
                disabled={timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                options={[
                  { value: 'Heats', label: 'Heats' },
                  { value: 'Finals', label: 'Finals' }
                ]}
                value={isFinals ? 'Finals' : 'Heats'}
                onChange={(val) => setIsFinals(val === 'Finals')}
              />
            </div>
          </div>
        </div>

        {/* Lanes overview with manual override triggers */}
        <div className="glass-card" style={{ position: 'relative', zIndex: 1 }}>
          <h4 className="settings-header">Lane Supervisor (Touchpad Overrides)</h4>
          <div className="scoreboard-container" style={{ gap: '0.4rem', margin: 0 }}>
            {lanes.map(lane => (
              <div 
                key={lane.laneNumber} 
                className="lane-card" 
                style={{ 
                  gridTemplateColumns: '45px 2fr 1.2fr 1fr 75px 170px', 
                  padding: '0.4rem 1rem',
                  borderLeftColor: lane.swimmer ? (lane.finalTime > 0 ? 'var(--accent-green)' : 'var(--accent-cyan)') : 'var(--border-color)' 
                }}
              >
                <div className="lane-number-badge" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>
                  {lane.laneNumber}
                </div>

                <div className="lane-swimmer-info">
                  <span className="lane-swimmer-name" style={{ fontSize: '0.9rem' }}>
                    {lane.swimmer ? lane.swimmer.name : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>[ Empty ]</span>}
                  </span>
                  {lane.swimmer && <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>{lane.swimmer.club}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {lane.splits.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {lane.splits.map((s, idx) => (
                        <span 
                          key={idx} 
                          style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '0.75rem', 
                            padding: '0.1rem 0.35rem', 
                            borderRadius: '3px', 
                            backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            color: 'var(--accent-cyan)'
                          }}
                          title={`Lap ${idx + 1} Split Time`}
                        >
                          L{idx + 1}: {s.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>--</span>
                  )}
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: lane.finalTime > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                  {lane.finalTime > 0 ? formatSecondsToTime(lane.finalTime) : (timerStatus === 'RUNNING' ? 'Running' : (timerStatus === 'FINISHED' ? (lane.status === 'DNS' ? 'DNS' : '--') : (isTestMode ? 'Testing' : 'Ready')))}
                </div>

                {/* T1 / T2 Method Badge placed right between Time Readout & Force Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {lane.finalTime > 0 || lane.splits.length > 0 ? (
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        padding: '0.2rem 0.55rem', 
                        borderRadius: '4px', 
                        fontFamily: 'var(--font-mono)',
                        color: (lane.timingMethod === 'T2') ? 'var(--accent-amber)' : 'var(--accent-cyan)',
                        backgroundColor: (lane.timingMethod === 'T2') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                        border: `1px solid ${(lane.timingMethod === 'T2') ? 'rgba(245, 158, 11, 0.4)' : 'rgba(6, 182, 212, 0.4)'}`
                      }}
                      title={lane.timingMethod === 'T2' ? 'Recorded via Backup Button / Manual Force (T2)' : 'Recorded via Swimmer Touchpad (T1)'}
                    >
                      {lane.timingMethod || 'T1'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>--</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button 
                    className="btn btn-secondary" 
                    disabled={lane.finalTime > 0 || timerStatus !== 'RUNNING'}
                    style={{ 
                      flex: 1, 
                      padding: '0.25rem 0.4rem', 
                      fontSize: '0.7rem', 
                      borderColor: 'var(--accent-cyan)', 
                      color: 'var(--accent-cyan)',
                      backgroundColor: 'rgba(6, 182, 212, 0.05)',
                      height: '28px'
                    }}
                    onClick={() => handleForceSplit(lane.laneNumber)}
                  >
                    Force Split
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    disabled={lane.finalTime > 0 || timerStatus !== 'RUNNING'}
                    style={{ 
                      flex: 1, 
                      padding: '0.25rem 0.4rem', 
                      fontSize: '0.7rem', 
                      borderColor: 'var(--accent-amber)', 
                      color: 'var(--accent-amber)',
                      backgroundColor: 'rgba(245, 158, 11, 0.05)',
                      height: '28px'
                    }}
                    onClick={() => handleForceFinish(lane.laneNumber)}
                  >
                    Force Finish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Right Column: Connection panel, simulator panels, raw console logs */}
      <div className="flex flex-col gap-4">
        
        {/* Serial connection settings */}
        <div className="glass-card">
          <h4 className="settings-header flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Cpu size={16} className="text-cyan" /> Hardware Connection
            </span>
            {isConnected && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>COM Port Blinking</span>
              </span>
            )}
          </h4>
          <div className="flex flex-col gap-3">
            <div className="form-group mb-0">
              <label className="form-label">Baud Rate (Speed)</label>
              <select 
                className="form-control" 
                value={baudRate} 
                onChange={(e) => setBaudRate(Number(e.target.value))}
                disabled={isConnected || isSimulating}
              >
                <option value={9600}>9600 Baud (Omega standard)</option>
                <option value={19200}>19200 Baud</option>
                <option value={38400}>38400 Baud</option>
                <option value={115200}>115200 Baud</option>
              </select>
            </div>

            {/* Touchpad Configuration Checklist */}
            <div style={{ marginTop: '0.4rem', marginBottom: '0.8rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Touchpad Configuration</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>
                  {bothEnds ? 'Start end + opposite end (splits every 50m)' : 'Start/Finish end only (splits every 100m)'}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.1rem 0' }}>
                <input 
                  type="checkbox" 
                  checked={bothEnds} 
                  onChange={(e) => setBothEnds(e.target.checked)}
                  disabled={isSimulating || timerStatus === 'RUNNING' || timerStatus === 'FINISHED'}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bothEnds ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                  {bothEnds ? 'BOTH ENDS' : 'ONE END'}
                </span>
              </label>

              {/* LED Display Resolution & Aspect Ratio */}
              <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>LED Screen Resolution / Aspect Ratio</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    Adjust aspect ratio for square (1:1 / 12x4), widescreen, or custom screens
                  </span>
                </div>
                <select
                  className="form-control"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', height: 'auto', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  value={scoreboardConfig?.resolution || 'auto'}
                  onChange={(e) => setScoreboardConfig?.(prev => ({ ...prev, resolution: e.target.value as ScoreboardResolution }))}
                >
                  <option value="auto">Auto / Fit Container</option>
                  <option value="16:9">16:9 Widescreen LED</option>
                  <option value="16:10">16:10 Widescreen Display</option>
                  <option value="4:3">4:3 Standard Display</option>
                  <option value="5:4">5:4 Standard LED Panel</option>
                  <option value="1:1">1:1 Square LED (Square / Matrix)</option>
                  <option value="12:4">12:4 Wide Bar LED</option>
                  <option value="21:9">21:9 Ultrawide LED</option>
                  <option value="32:9">32:9 Ultra Panoramic LED</option>
                  <option value="custom">Custom Aspect Ratio (Manual)</option>
                </select>

                {/* Custom Manual Width & Height Ratio Inputs */}
                {scoreboardConfig?.resolution === 'custom' && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.5rem', backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent-cyan)', display: 'block', marginBottom: '0.3rem' }}>
                      Enter Manual Aspect Ratio (Width : Height):
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>Width</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', height: 'auto' }}
                          value={scoreboardConfig.customAspectWidth ?? 12}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setScoreboardConfig?.(prev => ({ ...prev, customAspectWidth: val }));
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.8rem' }}>:</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>Height</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', height: 'auto' }}
                          value={scoreboardConfig.customAspectHeight ?? 4}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setScoreboardConfig?.(prev => ({ ...prev, customAspectHeight: val }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full">
              {(() => {
                const isHwConnected = isConnected || serialStatus === 'CONNECTED' || serialDriver.isConnected();

                if (isSimulating) {
                  return (
                    <button
                      className="btn btn-danger w-full"
                      style={{ width: '100%', fontWeight: 800, padding: '0.65rem' }}
                      onClick={() => {
                        setIsSimulating(false);
                        if (typeof window !== 'undefined') localStorage.removeItem('touchteck_connection_mode');
                      }}
                      title="Stop Timer Simulator Mode"
                    >
                      Stop Simulator
                    </button>
                  );
                }

                if (isHwConnected) {
                  return (
                    <button
                      className="btn w-full"
                      style={{
                        width: '100%',
                        fontWeight: 800,
                        padding: '0.65rem',
                        backgroundColor: '#f59e0b',
                        color: '#000000',
                        border: '1px solid #fbbf24',
                        boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)'
                      }}
                      onClick={async () => {
                        setConsoleLogs(prev => [...prev, '[SYSTEM] Reconnecting to CH340 USB Adapter & ARES 21...']);
                        await serialDriver.autoConnect().catch(() => false);
                      }}
                      title="Trigger instant reconnection with ARES 21 USB Bridge"
                    >
                      Reconnect USB
                    </button>
                  );
                }

                return (
                  <button
                    className="btn btn-success w-full"
                    style={{ width: '100%', fontWeight: 800, padding: '0.65rem' }}
                    onClick={() => {
                      setIsSimulating(true);
                      if (typeof window !== 'undefined') localStorage.setItem('touchteck_connection_mode', 'SIMULATOR');
                    }}
                    title="Start Timer Simulator Mode"
                  >
                    Simulator
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Timing Simulator */}
        {isSimulating && (
          <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
            <h4 className="settings-header text-amber">
              <Cpu size={16} /> Timing Simulator
            </h4>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {timerStatus === 'RUNNING' ? (
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={onStopRaceClick}>
                    <Square size={14} /> Stop Sim Heat
                  </button>
                ) : (timerStatus === 'FINISHED' || (timerStatus === 'READY' && elapsedTime > 0)) ? (
                  <button className="btn btn-cyan font-bold" style={{ flex: 1 }} onClick={onResetRaceClick}>
                    <RotateCcw size={14} /> Reset Race
                  </button>
                ) : (
                  <button className="btn btn-cyan" style={{ flex: 1 }} onClick={onStartRaceClick}>
                    <Play size={14} /> Start Sim Heat
                  </button>
                )}

                <button 
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '0.5rem 0.8rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.35rem', 
                    opacity: timerStatus === 'RUNNING' ? 0.5 : 1,
                    cursor: timerStatus === 'RUNNING' ? 'not-allowed' : 'pointer'
                  }} 
                  onClick={onResetRaceClick}
                  disabled={timerStatus === 'RUNNING'}
                  title={timerStatus === 'RUNNING' ? 'Reset is disabled while timing is running' : 'Reset Simulator & Timer'}
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Raw Log Console */}
        <div className="glass-card">
          <div className="flex justify-between items-center mb-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
            <h4 className="settings-header" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              <Terminal size={14} /> Raw Serial Feed
            </h4>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.12rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={() => {
                  const textToCopy = displayedLogs.join('\n');
                  navigator.clipboard.writeText(textToCopy);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                title="Copy Raw Serial Feed Logs to Clipboard"
              >
                {isCopied ? (
                  <>
                    <Check size={12} style={{ color: '#4ade80' }} />
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.12rem 0.5rem', fontSize: '0.72rem' }} onClick={clearConsole}>
                Clear
              </button>
            </div>
          </div>

          <div 
            ref={consoleContainerRef}
            style={{ 
              backgroundColor: '#05070c', 
              fontFamily: 'monospace', 
              fontSize: '0.7rem', 
              color: '#a7f3d0', 
              padding: '0.5rem', 
              borderRadius: '6px', 
              border: '1px solid var(--border-color)', 
              height: '260px', 
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {displayedLogs.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Idle. Waiting for timing console...</span>
            ) : (
              displayedLogs.map((log, idx) => {
                const isRaceStateLog = log.includes('Started race clock') || log.includes('Stopped race clock') || log.includes('RACE STARTED') || log.includes('RACE STOPPED') || log.includes('RACE FINISHED') || log.includes('[RACE]');
                const isSyncReadyLog = log.includes('100% READY') || log.includes('Synchronized with ARES');
                const isTouchLog = log.includes('[TOUCHPAD') || log.includes('TOUCH (');
                
                let textColor = '#a7f3d0';
                let fontWeight = 400;
                let textShadow = 'none';

                if (isRaceStateLog) {
                  textColor = '#ef4444'; // Bright Glowing Red / Rose
                  fontWeight = 900;
                  textShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
                } else if (isSyncReadyLog) {
                  textColor = '#fbbf24'; // Vibrant Amber / Orange-Yellow
                  fontWeight = 800;
                  textShadow = '0 0 10px rgba(251, 191, 36, 0.6)';
                } else if (isTouchLog) {
                  textColor = '#38bdf8'; // Cyan
                  fontWeight = 600;
                }

                return (
                  <div key={idx} style={{ color: textColor, fontWeight, textShadow, padding: '1px 0' }}>
                    {log}
                  </div>
                );
              })
            )}
          </div>

          {/* Small Checkbox below Raw Serial Feed Box */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={onlyImportantLogs} 
                onChange={(e) => setOnlyImportantLogs(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent-cyan)' }}
              />
              <span style={{ fontWeight: 600, color: onlyImportantLogs ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                Only Important Content
              </span>
            </label>

            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {onlyImportantLogs ? 'Main Content Only' : 'Full Chat / Raw Stream'}
            </span>
          </div>

          {/* T1 & T2 Protocol Legend Note & Hardware Control Buttons at Bottom */}
          <div style={{ marginTop: 'auto', paddingTop: '0.65rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>T1</span>
              <span>= Swimmer Touchpad Hit</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 0.2rem' }}>|</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>T2</span>
              <span>= Timekeeper Backup Button / Manual Force</span>
            </div>

            {/* Professional Hardware Start Light Controls Side-by-Side at Bottom */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%', marginTop: 'auto' }}>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  height: '38px',
                  fontSize: '0.72rem',
                  padding: '0 0.5rem',
                  whiteSpace: 'nowrap',
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.4)',
                  background: 'rgba(74, 222, 128, 0.08)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
                onClick={async () => {
                  const isHw = isConnected || serialStatus === 'CONNECTED' || serialDriver.isConnected();
                  if (isHw) {
                    await serialDriver.armLanes(true);
                    setConsoleLogs(prev => [...prev, '[ARES21] Sent Arm command (CMD 0x16) — Green Ready Light ON.']);
                  }
                }}
                title="Turn ON Omega StartTime Green Ready Light"
              >
                <ShieldCheck size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>Arm Start Light</span>
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  height: '38px',
                  fontSize: '0.72rem',
                  padding: '0 0.5rem',
                  whiteSpace: 'nowrap',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
                onClick={async () => {
                  const isHw = isConnected || serialStatus === 'CONNECTED' || serialDriver.isConnected();
                  if (isHw) {
                    await serialDriver.disarmAres();
                    setConsoleLogs(prev => [...prev, '[ARES21] Sent Disarm command — Green Ready Light OFF.']);
                  }
                }}
                title="Turn OFF Omega StartTime Green Ready Light"
              >
                <Power size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>Disarm Start Light</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

      <ConfirmationModal
        isOpen={showSimConfirm}
        title={isConnected ? "End Hardware Timing Session" : "End Timing Simulator"}
        message={isConnected ? "Are you sure you want to disconnect physical timing hardware?" : "Are you sure you want to end the Simulator?"}
        confirmText="Stop Simulator"
        cancelText="Cancel"
        onConfirm={handleConfirmStopSim}
        onCancel={() => setShowSimConfirm(false)}
      />

      {/* USB Serial Hardware Detection Modal */}
      {showUsbModal && (
        <div className={`modal-overlay${isUsbModalClosing ? ' modal-closing' : ''}`} style={{ zIndex: 1150 }}>
          <div className={`modal-content${isUsbModalClosing ? ' modal-closing' : ''}`} style={{ maxWidth: '520px', padding: '1.75rem' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ padding: '0.4rem', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                  <Radio size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    USB Serial Hardware Setup
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Omega Quantum / Ares Hardware Connection Guide
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent', fontSize: '1.1rem' }}
                onClick={() => closeUsbModal(() => setShowUsbModal(false))}
              >
                ✕
              </button>
            </div>

            {/* Error / Status Alert Banner */}
            {usbErrorMsg && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <ShieldAlert size={18} className="text-danger" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-red)', display: 'block' }}>
                      {usbErrorMsg.includes('Close any other') ? '⚠️ COM Port Already In Use By Another App' : 'Connection Warning / No Device Selected'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {usbErrorMsg.includes('Close any other')
                        ? 'ARES-Swimming (SWIMM.EXE) or another serial tool is locking the COM port. Close it first, then try again.'
                        : usbErrorMsg}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Troubleshooting Steps */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'block', marginBottom: '0.5rem' }}>
                🔍 Troubleshooting Physical USB Connection:
              </span>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', lineHeight: '1.4' }}>
                <li><strong style={{ color: '#ef4444' }}>⚠️ Close ARES-Swimming First:</strong> Press <strong>Ctrl+Alt+Delete → Task Manager</strong> and end <strong>SWIMM.EXE</strong>. Two apps cannot share the same COM port.</li>
                <li><strong>Verify Driver:</strong> Check Windows <em>Device Manager &gt; Ports (COM &amp; LPT)</em> to confirm the USB Serial Port (COM3, COM4, etc.) is recognized.</li>
                <li><strong>Select Port:</strong> Click <strong>"Detect COM Port"</strong> below and pick <strong>USB-SERIAL CH340</strong> from the browser popup.</li>
                <li><strong>No Hardware Connected?</strong> Click <strong>"Use Timing Simulator"</strong> to test full software features without physical hardware!</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeUsbModal(() => {
                  setShowUsbModal(false);
                  toggleSimulator();
                })}
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
              >
                Use Timing Simulator
              </button>
              <button
                type="button"
                className="btn btn-cyan"
                onClick={async () => {
                  setUsbErrorMsg(null);
                  try {
                    const success = await serialDriver.connect(baudRate);
                    if (success) {
                      setIsConnected(true);
                      closeUsbModal(() => setShowUsbModal(false));
                      setConsoleLogs(prev => [...prev, `[SYSTEM] Connected to serial port at ${baudRate} baud.`]);
                    }
                  } catch (err: any) {
                    setUsbErrorMsg(err?.message || 'No compatible serial device selected or port failed to open.');
                  }
                }}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Detect COM Port →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Off Prompt Modal */}
      {showSimOffModal && (
        <div className={`modal-overlay${isSimOffModalClosing ? ' modal-closing' : ''}`} style={{ zIndex: 99999 }}>
          <div className={`modal-panel-anim${isSimOffModalClosing ? ' modal-closing' : ''}`} style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--accent-amber)', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.2)', border: '1px solid var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)' }}>
                <Cpu size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>Simulator is OFF</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: 600 }}>Action Required to Start Race</span>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              The <strong>Timing Simulator</strong> is currently turned OFF, and no physical USB hardware timing console is connected. Turn on the simulator to run simulated race triggers and touchpad splits.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-cyan"
                style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => closeSimOffModal(() => {
                  setShowSimOffModal(false);
                  if (isConnected) handleDisconnect();
                  setIsSimulating(true);
                  setConsoleLogs(prev => [...prev, '[SYSTEM] Simulator Mode ENABLED via Start prompt.']);
                  setTimeout(() => {
                    setSimRunning(true);
                    const swimmerLanes = lanes.filter(l => l.swimmer).map(l => l.laneNumber);
                    const activeLanes = swimmerLanes.length > 0 ? swimmerLanes : [1, 2, 3, 4, 5, 6, 7, 8];
                    simulator.startRace(eventLaps, activeLanes);
                    setConsoleLogs(prev => [...prev, `[SIMULATOR] Starting race: ${eventLaps} length(s) for lanes [${activeLanes.join(', ')}]`]);
                  }, 100);
                })}
              >
                <Play size={18} /> Turn On Simulator & Start Race
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem' }}
                onClick={() => closeSimOffModal(() => {
                  setShowSimOffModal(false);
                  setShowUsbModal(true);
                })}
              >
                🔌 Connect USB Hardware Console Instead
              </button>

              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}
                onClick={() => closeSimOffModal(() => setShowSimOffModal(false))}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Seconds formatter
function formatSecondsToTime(totalSecs: number): string {
  if (isNaN(totalSecs) || totalSecs <= 0) return '00:00.00';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const minutesStr = mins > 0 ? `${mins.toString().padStart(2, '0')}:` : '00:';
  return `${minutesStr}${secs.toFixed(2).padStart(5, '0')}`;
}
