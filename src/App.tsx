import React, { useState, useEffect, useRef } from 'react';
import { seedDatabase, db } from './db';
import SwimmerManager from './components/SwimmerManager';
import MeetManager from './components/MeetManager';
import QualifyingStandards from './components/QualifyingStandards';
import Scoreboard from './components/Scoreboard';
import ResultsExport from './components/ResultsExport';
import OperatorConsole from './components/OperatorConsole';
import SystemCheck from './components/SystemCheck';
import LandingPage from './components/LandingPage';
import AnimatedLogo from './components/AnimatedLogo';
import { Timer, Users, Calendar, Award, BarChart3, Radio, Tv, ShieldCheck, CheckCircle2, AlertCircle, RotateCcw, FileText, Home, LogOut, User, ChevronDown, ChevronLeft, ChevronRight, LogIn, Cpu, Database, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { serialDriver, simulator, TimingEvent } from './serialDriver';
import { playBeeps, playStarterHorn, playTouchpadChime } from './audioUtility';
import ConfirmationModal from './components/ConfirmationModal';

import { ScoreboardDisplayConfig, DEFAULT_SCOREBOARD_CONFIG } from './types';

type TabId = 'home' | 'scoreboard' | 'operator' | 'system-check' | 'meet-setup' | 'swimmer-registry' | 'qualifying' | 'results';

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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('touchteck_is_logged_in');
      if (saved !== null) return saved === 'true';
    }
    return true; // Default to true so new tabs never require sign in
  });

  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('touchteck_user_email') || 'operator@touchteck.com';
    }
    return 'operator@touchteck.com';
  });

  const handleLogin = (email: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_is_logged_in', 'true');
      localStorage.setItem('touchteck_user_email', email);
    }
    setActiveTab('operator');
  };

  const handleLogout = async () => {
    setIsLoggedIn(false);
    setUserEmail('');
    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_is_logged_in', 'false');
      localStorage.removeItem('touchteck_user_email');
      localStorage.removeItem('touchteck_connection_mode');
    }
    try {
      await serialDriver.disarmAres();
      await serialDriver.disconnect();
      simulator.stop();
      setIsSimulating(false);
    } catch {}
    setActiveTab('home');
  };

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Error attempting to exit fullscreen:', err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + F or Cmd + F to toggle fullscreen mode
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('touchteck_active_tab');
      if (saved) return saved as TabId;
    }
    return 'home';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('touchteck_active_tab', activeTab);
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  const [dbSeeded, setDbSeeded] = useState(false);
  
  // Scoreboard Display Visibility Configuration
  const [scoreboardConfig, setScoreboardConfig] = useState<ScoreboardDisplayConfig>(() => {
    const saved = localStorage.getItem('touchteck_scoreboard_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return DEFAULT_SCOREBOARD_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('touchteck_scoreboard_config', JSON.stringify(scoreboardConfig));
  }, [scoreboardConfig]);

  // Timing Console Settings
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeMeetId, setActiveMeetId] = useState<number | null>(() => {
    const saved = localStorage.getItem('touchteck_active_meet_id');
    return saved ? Number(saved) : null;
  });
  const [activeEventId, setActiveEventId] = useState<number | null>(() => {
    const saved = localStorage.getItem('touchteck_active_event_id');
    return saved ? Number(saved) : null;
  });
  const [activeHeatNum, setActiveHeatNum] = useState<number>(() => {
    const saved = localStorage.getItem('touchteck_active_heat_num');
    return saved ? Number(saved) : 1;
  });

  useEffect(() => {
    if (activeMeetId !== null) localStorage.setItem('touchteck_active_meet_id', String(activeMeetId));
  }, [activeMeetId]);

  useEffect(() => {
    if (activeEventId !== null) localStorage.setItem('touchteck_active_event_id', String(activeEventId));
  }, [activeEventId]);

  useEffect(() => {
    localStorage.setItem('touchteck_active_heat_num', String(activeHeatNum));
  }, [activeHeatNum]);

  const [isFinals, setIsFinals] = useState<boolean>(false);
  const [serialStatus, setSerialStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'SIMULATOR'>('DISCONNECTED');
  const [bothEnds, setBothEnds] = useState<boolean>(false);
  // Test Mode State
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [showTestModeConfirm, setShowTestModeConfirm] = useState<boolean>(false);

  // Save Success Modal State
  const [saveSuccessInfo, setSaveSuccessInfo] = useState<{
    isOpen: boolean;
    heatNum: number;
    nextHeatNum: number | null;
    hasAnyTouch?: boolean;
  }>({
    isOpen: false,
    heatNum: 1,
    nextHeatNum: null,
    hasAnyTouch: true
  });

  // Shared Stopwatch & Lane States
  const DEFAULT_SWIMMERS: Swimmer[] = [
    { id: 1, name: 'Charles Wesley', ageGroup: 'Group A', club: 'RR' },
    { id: 2, name: 'Arjun Mehta', ageGroup: 'Group A', club: 'HYD' },
    { id: 3, name: 'Rohan Sharma', ageGroup: 'Group A', club: 'RR' },
    { id: 4, name: 'Vihaan Patel', ageGroup: 'Group A', club: 'HYD' },
    { id: 5, name: 'Aditya Sen', ageGroup: 'Group A', club: 'MUM' },
    { id: 6, name: 'Kabir Nair', ageGroup: 'Group A', club: 'DEL' },
    { id: 7, name: 'Aarav Gupta', ageGroup: 'Group A', club: 'BLR' },
    { id: 8, name: 'Neil Dsouza', ageGroup: 'Group A', club: 'KOL' }
  ];

  const createDefaultLanes = (): LaneState[] => 
    Array.from({ length: 8 }, (_, i) => ({
      laneNumber: i + 1,
      swimmer: undefined,
      splits: [],
      finalTime: 0,
      status: 'OK',
      isRunning: false
    }));

  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerStatus, setTimerStatus] = useState<'IDLE' | 'READY' | 'RUNNING' | 'FINISHED'>('READY');
  const [lanes, setLanes] = useState<LaneState[]>(createDefaultLanes);
  const [eventLaps, setEventLaps] = useState<number>(1);
  const [isResultsSaved, setIsResultsSaved] = useState(false);
  const isSavingRef = useRef(false);

  // System Check States
  const [systemCheckPads, setSystemCheckPads] = useState<number[]>([]);
  const [starterChecked, setStarterChecked] = useState(false);
  const [micChecked, setMicChecked] = useState(false);
  const activeTabRef = useRef<TabId>('scoreboard');

  // Sync refs with state changes
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Refs to avoid stale closures in serial port & broadcast callbacks
  const lanesRef = useRef<LaneState[]>([]);
  const eventLapsRef = useRef<number>(1);
  const timerStatusRef = useRef<'IDLE' | 'READY' | 'RUNNING' | 'FINISHED'>('READY');
  const timerStartRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const activeMeetIdRef = useRef<number | null>(activeMeetId);
  const activeEventIdRef = useRef<number | null>(activeEventId);
  const activeHeatNumRef = useRef<number>(activeHeatNum);
  const isTestModeRef = useRef<boolean>(isTestMode);
  const isSimulatingRef = useRef<boolean>(isSimulating);
  const bothEndsRef = useRef<boolean>(bothEnds);
  const isFinalsRef = useRef<boolean>(isFinals);

  // T1 vs T2 Timing Arbitration Refs
  const pendingT2TimeoutsRef = useRef<{ [lane: number]: { time: number; timestamp: number; timeoutId: any } }>({});
  const lastTouchByLaneRef = useRef<{ [lane: number]: { method: 'T1' | 'T2'; time: number; timestamp: number } }>({});

  // Sync refs with state changes
  useEffect(() => { lanesRef.current = lanes; }, [lanes]);
  useEffect(() => { eventLapsRef.current = eventLaps; }, [eventLaps]);
  useEffect(() => { timerStatusRef.current = timerStatus; }, [timerStatus]);
  useEffect(() => { activeMeetIdRef.current = activeMeetId; }, [activeMeetId]);
  useEffect(() => { activeEventIdRef.current = activeEventId; }, [activeEventId]);
  useEffect(() => { activeHeatNumRef.current = activeHeatNum; }, [activeHeatNum]);
  useEffect(() => { isTestModeRef.current = isTestMode; }, [isTestMode]);
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);
  useEffect(() => { bothEndsRef.current = bothEnds; }, [bothEnds]);
  useEffect(() => { isFinalsRef.current = isFinals; }, [isFinals]);

  // Clear arbitration memory on heat or event change
  useEffect(() => {
    Object.values(pendingT2TimeoutsRef.current).forEach(p => clearTimeout(p.timeoutId));
    pendingT2TimeoutsRef.current = {};
    lastTouchByLaneRef.current = {};
  }, [activeHeatNum, activeEventId, activeMeetId, isFinals]);

  // Multi-Tab Synchronization via BroadcastChannel
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  const broadcastSyncMessage = (action: string, payload: any) => {
    if (syncChannelRef.current) {
      try {
        syncChannelRef.current.postMessage({ action, payload, senderTab: activeTabRef.current });
      } catch (e) {
        console.error('BroadcastChannel error:', e);
      }
    }
  };

  const isIncomingSyncRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('touchteck_timing_sync');
      syncChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (!event.data) return;
        const { action, payload } = event.data;

        isIncomingSyncRef.current = true;
        setTimeout(() => { isIncomingSyncRef.current = false; }, 100);

        if (action === 'RACE_STARTED') {
          if (payload.startTime && payload.startTime > 0) {
            timerStartRef.current = payload.startTime;
          }
          if (payload.isSimulating !== undefined) { setIsSimulating(payload.isSimulating); isSimulatingRef.current = payload.isSimulating; }
          if (payload.bothEnds !== undefined) { setBothEnds(payload.bothEnds); bothEndsRef.current = payload.bothEnds; }
          if (payload.activeMeetId) { setActiveMeetId(payload.activeMeetId); activeMeetIdRef.current = payload.activeMeetId; }
          if (payload.activeEventId) { setActiveEventId(payload.activeEventId); activeEventIdRef.current = payload.activeEventId; }
          if (payload.activeHeatNum) { setActiveHeatNum(payload.activeHeatNum); activeHeatNumRef.current = payload.activeHeatNum; }
          if (payload.isFinals !== undefined) { setIsFinals(payload.isFinals); isFinalsRef.current = payload.isFinals; }
          if (payload.isTestMode !== undefined) { setIsTestMode(payload.isTestMode); isTestModeRef.current = payload.isTestMode; }
          if (payload.lanes && payload.lanes.length > 0) setLanes(payload.lanes);
          timerStatusRef.current = 'RUNNING';
          setTimerStatus('RUNNING');
          startTick(payload.startTime);
        } else if (action === 'RACE_STOPPED') {
          stopTick();
          timerStatusRef.current = 'FINISHED';
          setTimerStatus('FINISHED');
          if (payload.elapsedTime !== undefined) setElapsedTime(payload.elapsedTime);
          if (payload.lanes && payload.lanes.length > 0) setLanes(payload.lanes);
        } else if (action === 'RACE_RESET') {
          stopTick();
          setElapsedTime(0);
          timerStatusRef.current = 'READY';
          setTimerStatus('READY');
          if (payload.lanes && payload.lanes.length > 0) setLanes(payload.lanes);
        } else if (action === 'LANE_UPDATE') {
          if (payload.lanes && payload.lanes.length > 0) setLanes(payload.lanes);
        } else if (action === 'LANE_ASSIGNMENTS_UPDATED') {
          if (timerStatusRef.current !== 'RUNNING' && timerStatusRef.current !== 'FINISHED') {
            loadLanesAndEventConfig();
          }
        } else if (action === 'STATE_SYNC' || action === 'CONFIG_UPDATE') {
          if (payload.isSimulating !== undefined) { setIsSimulating(payload.isSimulating); isSimulatingRef.current = payload.isSimulating; }
          if (payload.bothEnds !== undefined) { setBothEnds(payload.bothEnds); bothEndsRef.current = payload.bothEnds; }
          if (payload.activeMeetId) { setActiveMeetId(payload.activeMeetId); activeMeetIdRef.current = payload.activeMeetId; }
          if (payload.activeEventId) { setActiveEventId(payload.activeEventId); activeEventIdRef.current = payload.activeEventId; }
          if (payload.activeHeatNum) { setActiveHeatNum(payload.activeHeatNum); activeHeatNumRef.current = payload.activeHeatNum; }
          if (payload.isFinals !== undefined) { setIsFinals(payload.isFinals); isFinalsRef.current = payload.isFinals; }
          if (payload.isTestMode !== undefined) { setIsTestMode(payload.isTestMode); isTestModeRef.current = payload.isTestMode; }
          if (payload.scoreboardConfig) setScoreboardConfig(payload.scoreboardConfig);

          if (payload.lanes && payload.lanes.length > 0) {
            setLanes(payload.lanes);
            lanesRef.current = payload.lanes;
          }

          if (payload.timerStatus === 'RUNNING') {
            if (payload.startTime && payload.startTime > 0) {
              timerStartRef.current = payload.startTime;
            }
            timerStatusRef.current = 'RUNNING';
            setTimerStatus('RUNNING');
            startTick(payload.startTime);
          } else if (payload.timerStatus === 'FINISHED') {
            stopTick();
            timerStatusRef.current = 'FINISHED';
            setTimerStatus('FINISHED');
            if (payload.elapsedTime !== undefined) setElapsedTime(payload.elapsedTime);
          } else if (payload.timerStatus === 'READY') {
            if (timerStatusRef.current !== 'RUNNING' && timerStatusRef.current !== 'FINISHED') {
              stopTick();
              timerStatusRef.current = 'READY';
              setTimerStatus('READY');
              if (!payload.lanes || payload.lanes.length === 0) {
                loadLanesAndEventConfig(payload.activeEventId, payload.activeHeatNum, payload.isFinals);
              }
            }
          }
        } else if (action === 'REQUEST_INITIAL_SYNC') {
          if (syncChannelRef.current && activeEventIdRef.current && activeTabRef.current === 'operator') {
            syncChannelRef.current.postMessage({
              action: 'STATE_SYNC',
              payload: {
                startTime: timerStartRef.current,
                elapsedTime: elapsedTime,
                timerStatus: timerStatusRef.current,
                lanes: lanesRef.current,
                activeMeetId: activeMeetIdRef.current,
                activeEventId: activeEventIdRef.current,
                activeHeatNum: activeHeatNumRef.current,
                isFinals: isFinalsRef.current,
                isTestMode: isTestModeRef.current,
                isSimulating: isSimulatingRef.current,
                bothEnds: bothEndsRef.current,
                scoreboardConfig
              }
            });
          }
        }
      };

      // Listen for window storage events for immediate cross-window sync
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'touchteck_event_selection' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data.activeEventId) setActiveEventId(data.activeEventId);
            if (data.activeHeatNum) setActiveHeatNum(data.activeHeatNum);
            loadLanesAndEventConfig(data.activeEventId, data.activeHeatNum, data.isFinals);
          } catch (err) {}
        }
      };
      window.addEventListener('storage', handleStorageChange);

      // Request initial sync state from existing open tabs
      channel.postMessage({ action: 'REQUEST_INITIAL_SYNC', payload: {} });

      return () => {
        channel.close();
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  // Broadcast state updates ONLY from operator desk tab to display tabs
  useEffect(() => {
    if (isIncomingSyncRef.current) return;
    if (activeTabRef.current === 'operator' && activeEventIdRef.current) {
      broadcastSyncMessage('STATE_SYNC', {
        isSimulating,
        timerStatus: timerStatusRef.current,
        startTime: timerStartRef.current,
        elapsedTime,
        lanes: lanesRef.current,
        activeMeetId,
        activeEventId,
        activeHeatNum,
        isFinals,
        isTestMode,
        bothEnds,
        scoreboardConfig
      });
    }
  }, [isSimulating, activeMeetId, activeEventId, activeHeatNum, isFinals, isTestMode, bothEnds, scoreboardConfig, lanes]);

  // Persist active event selection to localStorage so refreshing keeps exact event
  useEffect(() => {
    if (typeof window !== 'undefined' && activeMeetId && activeEventId) {
      localStorage.setItem('touchteck_event_selection', JSON.stringify({
        activeMeetId,
        activeEventId,
        activeHeatNum,
        isTestMode,
        bothEnds
      }));
    }
  }, [activeMeetId, activeEventId, activeHeatNum, isTestMode, bothEnds]);

  // Persist live running race state to localStorage for instant mid-race refresh recovery
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (timerStatus === 'RUNNING' && timerStartRef.current > 0) {
        localStorage.setItem('touchteck_live_race_state', JSON.stringify({
          startTime: timerStartRef.current,
          timerStatus: 'RUNNING',
          lanes,
          activeMeetId,
          activeEventId,
          activeHeatNum,
          isTestMode,
          isSimulating,
          bothEnds
        }));
      } else if (timerStatus === 'FINISHED') {
        localStorage.setItem('touchteck_live_race_state', JSON.stringify({
          timerStatus: 'FINISHED',
          elapsedTime,
          lanes,
          activeMeetId,
          activeEventId,
          activeHeatNum,
          isTestMode,
          isSimulating,
          bothEnds
        }));
      } else if (timerStatus === 'READY') {
        localStorage.removeItem('touchteck_live_race_state');
      }
    }
  }, [timerStatus, lanes, elapsedTime, activeMeetId, activeEventId, activeHeatNum, isTestMode, isSimulating, bothEnds]);

  // Seeder and State Restoration on Startup
  useEffect(() => {
    const initDb = async () => {
      try {
        await seedDatabase();
      } catch (err) {
        console.error('Error during seedDatabase:', err);
      } finally {
        setDbSeeded(true);
      }
      
      // Check for active running race state in localStorage
      const savedRaceStr = localStorage.getItem('touchteck_live_race_state');
      let restored = false;

      if (savedRaceStr) {
        try {
          const saved = JSON.parse(savedRaceStr);
          if (saved.timerStatus === 'RUNNING' && saved.startTime && saved.startTime > 0) {
            const elapsed = (Date.now() - saved.startTime) / 1000;
            if (elapsed < 3600) { // Race started within 1 hour
              timerStartRef.current = saved.startTime;
              setTimerStatus('RUNNING');
              if (saved.lanes) {
                const sanitizedLanes = saved.lanes.map((l: LaneState) => ({
                  ...l,
                  splits: (l.splits || []).filter(s => s > 0),
                  finalTime: l.finalTime > 0 ? l.finalTime : 0
                }));
                setLanes(sanitizedLanes);
              }
              if (saved.activeMeetId) setActiveMeetId(saved.activeMeetId);
              if (saved.activeEventId) setActiveEventId(saved.activeEventId);
              if (saved.activeHeatNum) setActiveHeatNum(saved.activeHeatNum);
              if (saved.isTestMode !== undefined) setIsTestMode(saved.isTestMode);
              if (saved.isSimulating !== undefined) setIsSimulating(saved.isSimulating);
              if (saved.bothEnds !== undefined) setBothEnds(saved.bothEnds);
              startTick(saved.startTime);
              restored = true;
            }
          }
        } catch (e) {
          console.error('Error restoring live race state:', e);
        }
      }

      if (!restored) {
        let restoredEv = false;
        const savedEventStr = localStorage.getItem('touchteck_event_selection');
        if (savedEventStr) {
          try {
            const savedEv = JSON.parse(savedEventStr);
            if (savedEv.activeMeetId) setActiveMeetId(savedEv.activeMeetId);
            if (savedEv.activeEventId) {
              setActiveEventId(savedEv.activeEventId);
              restoredEv = true;
            }
            if (savedEv.activeHeatNum) setActiveHeatNum(savedEv.activeHeatNum);
            if (savedEv.isTestMode !== undefined) setIsTestMode(savedEv.isTestMode);
            if (savedEv.bothEnds !== undefined) setBothEnds(savedEv.bothEnds);
          } catch (e) {
            // fallback below
          }
        }

        if (!restoredEv) {
          try {
            const meetsList = await db.meets.toArray();
            if (meetsList.length > 0) {
              setActiveMeetId(meetsList[0].id || 1);
              const eventsList = await db.events.where('meetId').equals(meetsList[0].id!).toArray();
              if (eventsList.length > 0) {
                setActiveEventId(eventsList[0].id || 1);
              }
            }
          } catch (e) {
            console.error('Error reading meets list:', e);
          }
        }
      }
    };
    initDb();
  }, []);

  // Silent hardware auto-connect on mount (uses previously granted port, no popup dialog)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mode = localStorage.getItem('touchteck_connection_mode');
    if (mode === 'HARDWARE') {
      serialDriver.autoConnect().then(success => {
        if (success) setSerialStatus('CONNECTED');
      }).catch(() => {});
    } else if (mode === 'SIMULATOR') {
      setIsSimulating(true);
      setSerialStatus('SIMULATOR');
    }
  }, []);

  // Update hardware status indicator – blink immediately when COM port opens
  useEffect(() => {
    if (isSimulating) {
      setSerialStatus('SIMULATOR');
      if (typeof window !== 'undefined') localStorage.setItem('touchteck_connection_mode', 'SIMULATOR');
    } else {
      const checkConnection = () => {
        const state = serialDriver.getHardwareState();
        if (state === 'ARES_ONLINE' || state === 'CABLE_ONLY') {
          setSerialStatus('CONNECTED');
          if (typeof window !== 'undefined') localStorage.setItem('touchteck_connection_mode', 'HARDWARE');
        } else {
          setSerialStatus('DISCONNECTED');
        }
      };
      checkConnection();
      const interval = setInterval(checkConnection, 500);
      return () => clearInterval(interval);
    }
  }, [isSimulating]);

  // Load lane structure whenever Meet, Event, Heat, BothEnds, isFinals, or dbSeeded config changes
  useEffect(() => {
    if (!dbSeeded) return;
    setIsResultsSaved(false);
    // IMPORTANT: Do NOT reset to READY or clear race state if a live race was restored on startup
    if (timerStatusRef.current !== 'RUNNING') {
      // Only wipe saved race state if there is no running race being restored
      const savedStr = typeof window !== 'undefined' ? localStorage.getItem('touchteck_live_race_state') : null;
      const savedIsRunning = savedStr ? (() => { try { return JSON.parse(savedStr)?.timerStatus === 'RUNNING'; } catch { return false; } })() : false;
      if (!savedIsRunning) {
        stopTick();
        setElapsedTime(0);
        setTimerStatus('READY');
        timerStatusRef.current = 'READY';
        if (typeof window !== 'undefined') {
          localStorage.removeItem('touchteck_live_race_state');
        }
        loadLanesAndEventConfig(activeEventId, activeHeatNum, isFinals);
      }
    }
  }, [dbSeeded, activeMeetId, activeEventId, activeHeatNum, bothEnds, isFinals]);

  // Listen for live lane assignment updates dispatched when swimmers are added/removed
  useEffect(() => {
    const handleLiveLaneUpdate = () => {
      if (timerStatusRef.current !== 'RUNNING') {
        loadLanesAndEventConfig(activeEventId, activeHeatNum, isFinals);
      }
    };

    window.addEventListener('lane-assignments-updated', handleLiveLaneUpdate);
    return () => {
      window.removeEventListener('lane-assignments-updated', handleLiveLaneUpdate);
    };
  }, [activeMeetId, activeEventId, activeHeatNum, bothEnds, isFinals]);

  const resolveLanesFromDB = async (numEventId: number, numHeatNum: number, isFinalsMode: boolean): Promise<LaneState[]> => {
    const ev = await db.events.get(numEventId);
    if (!ev) return createDefaultLanes();

    if (isFinalsMode) {
      // FINALS STAGE: Get top 8 swimmers from recorded preliminary heat results
      const results = await db.results.where('eventId').equals(numEventId).toArray();
      const validResults = results.filter(r => r.status === 'OK' && r.finalTime > 0 && r.swimmerId);

      // Map each swimmer to their best preliminary time
      const bestTimesMap = new Map<number, number>();
      for (const r of validResults) {
        const existing = bestTimesMap.get(r.swimmerId!);
        if (!existing || r.finalTime < existing) {
          bestTimesMap.set(r.swimmerId!, r.finalTime);
        }
      }

      // Sort swimmer IDs by fastest time ascending and select top 8
      const topSwimmerIds = Array.from(bestTimesMap.entries())
        .sort((a, b) => a[1] - b[1])
        .map(entry => entry[0])
        .slice(0, 8);

      // Spearhead lane order for 8 lanes: Lane 4 (1st), Lane 5 (2nd), Lane 3 (3rd), Lane 6 (4th), Lane 2 (5th), Lane 7 (6th), Lane 1 (7th), Lane 8 (8th)
      const SPEARHEAD_LANES = [4, 5, 3, 6, 2, 7, 1, 8];
      const finalsAssignmentsMap = new Map<number, number>();

      topSwimmerIds.forEach((swimmerId, index) => {
        if (index < SPEARHEAD_LANES.length) {
          finalsAssignmentsMap.set(SPEARHEAD_LANES[index], swimmerId);
        }
      });

      const resolvedLanes: LaneState[] = [];
      for (let laneNum = 1; laneNum <= 8; laneNum++) {
        const swimmerId = finalsAssignmentsMap.get(laneNum);
        let swimmer: Swimmer | undefined;
        let qTime = undefined;

        if (swimmerId) {
          swimmer = await db.swimmers.get(swimmerId);
          if (swimmer) {
            try {
              const qtRecord = await db.qualifyingTimes
                .filter(q => q.distance === ev.distance && q.stroke === ev.stroke && q.gender === ev.gender && q.ageGroup === ev.ageGroup)
                .first();
              qTime = qtRecord?.time;
            } catch (e) {
              console.warn('QT query warning:', e);
            }
          }
        }

        resolvedLanes.push({
          laneNumber: laneNum,
          swimmer,
          qualifyingTime: qTime,
          splits: [],
          finalTime: 0,
          status: 'OK',
          isRunning: false,
          lastSplitTime: undefined,
          lastSplitTimestamp: undefined
        });
      }
      return resolvedLanes;
    } else {
      // REGULAR HEATS STAGE: Get assignments for this heat
      const assignments = await db.laneAssignments
        .filter(a => Number(a.eventId) === numEventId && Number(a.heatNumber) === numHeatNum)
        .toArray();

      const resolvedLanes: LaneState[] = [];
      for (let laneNum = 1; laneNum <= 8; laneNum++) {
        const assign = assignments.find(a => a.laneNumber === laneNum);
        let swimmer: Swimmer | undefined;
        let qTime = undefined;

        if (assign && assign.swimmerId) {
          swimmer = await db.swimmers.get(assign.swimmerId);
          if (swimmer) {
            try {
              const qtRecord = await db.qualifyingTimes
                .filter(q => q.distance === ev.distance && q.stroke === ev.stroke && q.gender === ev.gender && q.ageGroup === ev.ageGroup)
                .first();
              qTime = qtRecord?.time;
            } catch (e) {
              console.warn('QT query warning:', e);
            }
          }
        }

        resolvedLanes.push({
          laneNumber: laneNum,
          swimmer,
          qualifyingTime: qTime,
          splits: [],
          finalTime: 0,
          status: 'OK',
          isRunning: false,
          lastSplitTime: undefined,
          lastSplitTimestamp: undefined
        });
      }
      return resolvedLanes;
    }
  };

  const loadLanesAndEventConfig = async (
    targetEventId?: number | null,
    targetHeatNum?: number,
    targetIsFinals?: boolean
  ) => {
    const effEventId = targetEventId ?? activeEventIdRef.current ?? activeEventId;
    const effHeatNum = targetHeatNum ?? activeHeatNumRef.current ?? activeHeatNum;
    const effIsFinals = targetIsFinals ?? isFinalsRef.current ?? isFinals;

    if (!effEventId) {
      setLanes(createDefaultLanes());
      return;
    }

    const numEventId = Number(effEventId);
    const numHeatNum = Number(effHeatNum);

    const ev = await db.events.get(numEventId);
    if (!ev) {
      setLanes(createDefaultLanes());
      return;
    }

    // Calculate required laps (50m pool lengths) based on pool end configurations
    const laps = bothEndsRef.current 
      ? Math.max(1, Math.ceil(ev.distance / 50)) 
      : Math.max(1, Math.ceil(ev.distance / 100));
    setEventLaps(laps);

    const resolvedLanes = await resolveLanesFromDB(numEventId, numHeatNum, effIsFinals);

    setLanes(resolvedLanes);
    lanesRef.current = resolvedLanes;

    if (timerStatusRef.current !== 'RUNNING') {
      setTimerStatus('READY');
      timerStatusRef.current = 'READY';
      setElapsedTime(0);
      stopTick();
    }

    if (activeTabRef.current === 'operator') {
      broadcastSyncMessage('STATE_SYNC', {
        isSimulating: isSimulatingRef.current,
        timerStatus: timerStatusRef.current,
        startTime: 0,
        elapsedTime: 0,
        lanes: resolvedLanes,
        activeMeetId: activeMeetIdRef.current,
        activeEventId: numEventId,
        activeHeatNum: numHeatNum,
        isFinals: effIsFinals,
        isTestMode: isTestModeRef.current,
        bothEnds: bothEndsRef.current,
        scoreboardConfig
      });
    }
  };

  // Stopwatch Animation Frame Ticker with setInterval fallback for multi-window/tab sync
  const startTick = (startTs?: number) => {
    stopTick();
    if (startTs && startTs > 0) {
      timerStartRef.current = startTs;
    }

    const tick = () => {
      if (timerStartRef.current > 0) {
        const elapsed = (Date.now() - timerStartRef.current) / 1000;
        if (elapsed >= 3599.99) {
          setElapsedTime(3599.99);
          setTimerStatus('FINISHED');
          stopTick();
          setLanes(prev => prev.map(l => ({ ...l, isRunning: false })));
          return;
        }
        setElapsedTime(elapsed);
      }
    };

    const loop = () => {
      tick();
      animationFrameId.current = requestAnimationFrame(loop);
    };
    animationFrameId.current = requestAnimationFrame(loop);

    // Fallback interval (40ms) to ensure unfocused display tabs and secondary monitors keep ticking smoothly
    intervalIdRef.current = window.setInterval(tick, 40);
  };

  const stopTick = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  // Timing Operations: Start (Synchronous for immediate start execution)
  const triggerStart = () => {
    const startTime = Date.now();
    timerStartRef.current = startTime;
    timerStatusRef.current = 'RUNNING';
    setTimerStatus('RUNNING');

    // Reset arbitration state for fresh heat
    Object.values(pendingT2TimeoutsRef.current).forEach(p => clearTimeout(p.timeoutId));
    pendingT2TimeoutsRef.current = {};
    lastTouchByLaneRef.current = {};

    const numEventId = Number(activeEventIdRef.current || activeEventId);
    const numHeatNum = Number(activeHeatNumRef.current || activeHeatNum);
    const currentMeetId = activeMeetIdRef.current || activeMeetId;
    const isFinalsMode = isFinalsRef.current;

    const currentLanes = lanesRef.current.length > 0 ? lanesRef.current : lanes;

    const newLanes = currentLanes.map(l => ({
      ...l,
      splits: [],
      finalTime: 0,
      timingMethod: undefined,
      isRunning: !!l.swimmer,
      status: (l.swimmer ? 'OK' : 'DNS') as ('OK' | 'DNS' | 'DNF' | 'DQ')
    }));

    setLanes(newLanes);
    startTick(startTime);
    serialDriver.markRaceStarted(false);
    serialDriver.sendRaceStartSignal();

    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_live_race_state', JSON.stringify({
        timerStatus: 'RUNNING',
        timerStart: startTime,
        lanes: newLanes,
        activeMeetId: currentMeetId,
        activeEventId: numEventId,
        activeHeatNum: numHeatNum,
        isFinals: isFinalsMode
      }));
    }

    broadcastSyncMessage('RACE_STARTED', {
      startTime,
      timerStatus: 'RUNNING',
      lanes: newLanes,
      activeMeetId: currentMeetId,
      activeEventId: numEventId,
      activeHeatNum: numHeatNum,
      isFinals: isFinalsMode,
      isTestMode: isTestModeRef.current
    });
  };

  // Timing Operations: Reset
  const handleResetTimer = () => {
    simulator.stop();
    simulator.reset();
    serialDriver.sendRaceResetSignal(); // Resets hardware state + arms lanes (calls resetRaceStartHardwareTime internally)
    Object.values(pendingT2TimeoutsRef.current).forEach(p => clearTimeout(p.timeoutId));
    pendingT2TimeoutsRef.current = {};
    lastTouchByLaneRef.current = {};
    localStorage.removeItem('touchteck_live_race_state');
    timerStatusRef.current = 'READY';
    timerStartRef.current = 0;
    stopTick();
    setElapsedTime(0);
    setTimerStatus('READY');
    const resetLanes = lanes.map(l => ({
      ...l,
      splits: [],
      finalTime: 0,
      timingMethod: undefined,
      isRunning: false,
      status: (l.swimmer ? 'OK' : 'DNS') as ('OK' | 'DNS' | 'DNF' | 'DQ'),
      lastSplitTime: undefined,
      lastSplitTimestamp: undefined
    }));
    setLanes(resetLanes);

    broadcastSyncMessage('RACE_RESET', {
      lanes: resetLanes,
      elapsedTime: 0,
      timerStatus: 'READY',
      activeMeetId: activeMeetIdRef.current,
      activeEventId: activeEventIdRef.current,
      activeHeatNum: activeHeatNumRef.current,
      isFinals: isFinalsRef.current
    });
  };

  // Timing Operations: Stop
  const handleStopTimer = () => {
    serialDriver.stopRace();
    timerStatusRef.current = 'FINISHED';
    stopTick();
    setTimerStatus('FINISHED');
    const finishedLanes = lanes.map(l => ({
      ...l,
      isRunning: false
    }));
    setLanes(finishedLanes);

    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_live_race_state', JSON.stringify({
        timerStatus: 'FINISHED',
        timerStart: timerStartRef.current,
        elapsedTime,
        lanes: finishedLanes
      }));
    }

    broadcastSyncMessage('RACE_STOPPED', {
      elapsedTime,
      lanes: finishedLanes
    });
  };

  // Timing Operations: Save
  const handleSaveResults = async () => {
    if (!activeEventId || isSavingRef.current || isResultsSaved) return;
    isSavingRef.current = true;

    try {
      const numEventId = Number(activeEventId);
      const numHeatNum = Number(activeHeatNum);

      const hasAnyTouch = lanes.some(l => l.swimmer && l.finalTime > 0);

      for (const lane of lanes) {
        if (!lane.swimmer) continue;

        const isTouchRecorded = lane.finalTime > 0;
        const record = {
          eventId: numEventId,
          stage: (isFinals ? 'Finals' : 'Heats') as 'Heats' | 'Finals',
          heatNumber: numHeatNum,
          laneNumber: lane.laneNumber,
          swimmerId: lane.swimmer.id,
          splits: lane.splits,
          finalTime: lane.finalTime || 0,
          status: (isTouchRecorded ? (lane.status || 'OK') : 'NT') as 'OK' | 'DNS' | 'DNF' | 'DQ' | 'NT',
          timingMethod: isTouchRecorded ? (lane.timingMethod || 'T1') : undefined,
          recordedAt: Date.now()
        };

        const existing = await db.results
          .filter(r => Number(r.eventId) === numEventId && Number(r.heatNumber) === numHeatNum && Number(r.laneNumber) === lane.laneNumber)
          .first();

        if (existing && existing.id) {
          (record as any).id = existing.id;
        }
        await db.results.put(record);
      }

      setIsResultsSaved(true);

      // Determine if next heat is available
      const assignments = await db.laneAssignments.filter(a => Number(a.eventId) === numEventId).toArray();
      const uniqueHeats = Array.from(new Set(assignments.map(a => Number(a.heatNumber))));
      const maxHeat = uniqueHeats.length > 0 ? Math.max(...uniqueHeats) : 1;

      setSaveSuccessInfo({
        isOpen: true,
        heatNum: numHeatNum,
        nextHeatNum: numHeatNum < maxHeat ? numHeatNum + 1 : null,
        hasAnyTouch
      });
    } catch (err) {
      console.error('Error saving results:', err);
    } finally {
      isSavingRef.current = false;
    }
  };


  // Global Serial Stream Listener
  useEffect(() => {
    const unsubscribe = serialDriver.onData((event: TimingEvent) => {
      if (event.type === 'START') {
        playStarterHorn();
        if (activeTabRef.current === 'system-check') {
          setStarterChecked(true);
        } else {
          if (timerStatusRef.current !== 'RUNNING') {
            triggerStart();
          } else {
            console.log('[ARES21] Hardware START signal received while race already RUNNING — keeping active race clock.');
          }
        }
      } else if (event.type === 'RUNNING_TIME') {
        if (event.time === 0) {
          // Many unrelated diagnostic packets (status-poll ACKs, keepalives, arm/disarm
          // confirmations) share this same "RUNNING_TIME time=0" event shape. Only treat it
          // as a real clock reset while a race isn't actively running, otherwise a routine
          // keepalive ACK arriving mid-race would snap the visible clock back to 00.00.
          if (timerStatusRef.current !== 'RUNNING') {
            timerStartRef.current = Date.now();
            setElapsedTime(0);
          }
        } else if (event.time > 0 && timerStatusRef.current === 'RUNNING') {
          // Prevent 1-second visual snapping/flicker: requestAnimationFrame handles smooth 60 FPS rendering.
          // Only adjust timer start if hardware drift exceeds 0.5s.
          const currentLocal = (Date.now() - timerStartRef.current) / 1000;
          if (Math.abs(currentLocal - event.time) > 0.5) {
            timerStartRef.current = Date.now() - (event.time * 1000);
          }
        }
      } else if (event.type === 'SPLIT' || event.type === 'FINISH') {
        const laneNum = event.lane;
        if (!laneNum || laneNum < 1 || laneNum > 8 || !event.time || event.time <= 0) return;

        const timingMethod = event.timingMethod || 'T1';
        const now = Date.now();
        const lastTouch = lastTouchByLaneRef.current[laneNum];

        // ── Arbitration Rule 1: T1 touchpad hit arrived ──
        let isT2PendingWindowActive = false;
        if (timingMethod === 'T1') {
          // If there is a pending T2 timer for this lane, clear it and note that T1 arrived within 2s
          if (pendingT2TimeoutsRef.current[laneNum]) {
            isT2PendingWindowActive = true;
            clearTimeout(pendingT2TimeoutsRef.current[laneNum].timeoutId);
            delete pendingT2TimeoutsRef.current[laneNum];
            console.log(`[Arbitration] T1 touchpad hit (${event.time}s) arrived within 2s window for Lane ${laneNum} — overriding T2!`);
          }
          lastTouchByLaneRef.current[laneNum] = { method: 'T1', time: event.time, timestamp: now };
        }

        // ── Arbitration Rule 2: T2 hand button arrived when T1 was ALREADY recorded first ──
        if (timingMethod === 'T2') {
          if (lastTouch && lastTouch.method === 'T1' && (now - lastTouch.timestamp < 2500)) {
            console.log(`[Arbitration] Ignored T2 hit (${event.time}s) on Lane ${laneNum} because T1 touchpad hit was already recorded first in current heat`);
            return;
          }

          // If T2 arrived first, register 2.0-second window waiting for T1
          if (pendingT2TimeoutsRef.current[laneNum]) {
            clearTimeout(pendingT2TimeoutsRef.current[laneNum].timeoutId);
          }
          const timeoutId = setTimeout(() => {
            delete pendingT2TimeoutsRef.current[laneNum];
            console.log(`[Arbitration] 2s window expired on Lane ${laneNum} — T2 time ${event.time}s confirmed as official`);
          }, 2000);
          pendingT2TimeoutsRef.current[laneNum] = { time: event.time, timestamp: now, timeoutId };
          lastTouchByLaneRef.current[laneNum] = { method: 'T2', time: event.time, timestamp: now };
        }

        if (activeTabRef.current === 'system-check') {
          playTouchpadChime();
          setSystemCheckPads(prev => prev.includes(laneNum) ? prev : [...prev, laneNum]);
        } else {
          if (timerStatusRef.current !== 'RUNNING' && !isTestModeRef.current) {
            console.log(`[ARES21] Ignored pre-start hit on Lane ${laneNum} (race status: ${timerStatusRef.current})`);
            return;
          }

          setLanes(prev => {
            const currentLanes = prev.map(l => {
              if (l.laneNumber === laneNum) {
                // If lane already finished with T1, ignore any subsequent touch
                if (l.finalTime > 0 && l.timingMethod === 'T1') return l;

                // If lane finished with T2:
                if (l.finalTime > 0 && l.timingMethod === 'T2') {
                  // T1 OVERRIDES T2 ONLY IF T1 arrived WITHIN the 2-second window!
                  if (timingMethod === 'T1' && isT2PendingWindowActive) {
                    console.log(`[Arbitration] T1 touchpad hit (${event.time}s) OVERRODE T2 finish (${l.finalTime}s) on Lane ${laneNum} (within 2s window)`);
                    const updatedSplits = [...l.splits];
                    if (updatedSplits.length > 0) {
                      updatedSplits[updatedSplits.length - 1] = event.time;
                    }
                    return {
                      ...l,
                      finalTime: event.time,
                      splits: updatedSplits,
                      timingMethod: 'T1' as const,
                      isRunning: false
                    };
                  }
                  // Otherwise, 2s window expired -> T2 is confirmed official, ignore late T1 hit!
                  console.log(`[Arbitration] Late T1 hit (${event.time}s) ignored on Lane ${laneNum} because T2 2-second window expired`);
                  return l;
                }

                // If lane already finished, ignore
                if (l.finalTime > 0) return l;

                const isFinal = event.lap ? event.lap >= eventLapsRef.current : ((l.splits.length + 1) >= eventLapsRef.current);
                const updatedSplits = [...l.splits];

                const resolvedTimingMethod: 'T1' | 'T2' = timingMethod === 'T2' ? 'T2' : 'T1';

                // If previous split was T2 and T1 arrives now: T1 OVERRIDES T2 split ONLY IF within 2s window!
                if (l.timingMethod === 'T2' && resolvedTimingMethod === 'T1' && updatedSplits.length > 0) {
                  if (isT2PendingWindowActive) {
                    updatedSplits[updatedSplits.length - 1] = event.time;
                    console.log(`[Arbitration] T1 touchpad split (${event.time}s) OVERRODE T2 split on Lane ${laneNum} (within 2s window)`);
                  }
                } else {
                  if (!updatedSplits.includes(event.time)) {
                    updatedSplits.push(event.time);
                  }
                }

                const finalMethod: 'T1' | 'T2' = resolvedTimingMethod === 'T1' ? 'T1' : (l.timingMethod || resolvedTimingMethod);

                return {
                  ...l,
                  splits: updatedSplits,
                  finalTime: isFinal ? event.time : l.finalTime,
                  timingMethod: finalMethod,
                  isRunning: !isFinal,
                  lastSplitTime: isFinal ? undefined : event.time,
                  lastSplitTimestamp: isFinal ? undefined : Date.now()
                };
              }
              return l;
            });

            checkRaceCompletion(currentLanes);
            broadcastSyncMessage('LANE_UPDATE', { lanes: currentLanes });
            return currentLanes;
          });
        }
      }
    });

    return () => {
      unsubscribe();
      stopTick();
    };
  }, []);

  // Completion checker helper
  const checkRaceCompletion = (currentLanes: LaneState[]) => {
    // Clock remains ticking and must be manually stopped by the operator.
  };

  // Navigation Tabs Configuration (All 8 Tabs)
  const navigationTabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'scoreboard', label: 'Scoreboard', icon: Tv },
    { id: 'meet-setup', label: 'Heats & Lanes', icon: Calendar },
    { id: 'swimmer-registry', label: 'Swimmers', icon: Users },
    { id: 'qualifying', label: 'Cutoffs', icon: Award },
    { id: 'results', label: 'Reports', icon: BarChart3 },
    { id: 'operator', label: 'Operator Desk', icon: Radio },
    { id: 'system-check', label: 'System Check', icon: ShieldCheck },
  ];

  const currentTabItem = navigationTabs.find(t => t.id === activeTab) || navigationTabs[6];
  const currentTabIdx = navigationTabs.findIndex(t => t.id === activeTab);

  const handlePrevTabNav = () => {
    const prevIdx = (currentTabIdx - 1 + navigationTabs.length) % navigationTabs.length;
    setActiveTab(navigationTabs[prevIdx].id);
  };

  const handleNextTabNav = () => {
    const nextIdx = (currentTabIdx + 1) % navigationTabs.length;
    setActiveTab(navigationTabs[nextIdx].id);
  };

  if (!dbSeeded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b0f19', color: '#fff', gap: '1.5rem' }}>
        <img src="/logo.png?v=3" alt="TouchTeck Logo" style={{ height: '80px', objectFit: 'contain' }} />
        <h3 style={{ letterSpacing: '0.05em' }}>Initializing TouchTeck Database...</h3>
      </div>
    );
  }

  if (activeTab === 'home') {
    return (
      <LandingPage
        onLogin={handleLogin}
        onLogout={handleLogout}
        onNavigateToTab={(tab) => setActiveTab(tab as TabId)}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
      />
    );
  }

  return (
    <div className={`app-container ${isFullscreen ? 'fullscreen-active' : ''}`}>
      {/* Top Header — hidden when in fullscreen mode */}
      {!isFullscreen && (
        <header className="app-header">
        <div className="brand-section">
          <AnimatedLogo size="sm" showText={true} />
        </div>

        {/* Full Desktop Nav Tabs (lg+ screens) */}
        <nav className="nav-tabs nav-tabs-desktop">
          {navigationTabs.map(tab => (
            <button 
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              {React.createElement(tab.icon, { size: 15, className: 'shrink-0' })}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* System connectivity status badge & Profile controls */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {/* Minimized Single-Tab Carousel with Left & Right Arrows (< lg screens) */}
          <div className="nav-tabs-carousel items-center gap-1.5 bg-slate-950 border border-[#fff500]/40 rounded-2xl px-2 py-1.5 shadow-lg shrink-0">
            <button
              onClick={handlePrevTabNav}
              className="w-7 h-7 rounded-xl bg-slate-900 hover:bg-[#fff500] hover:text-black text-[#fff500] flex items-center justify-center transition-colors cursor-pointer border border-[#fff500]/30 shrink-0"
              title="Previous Tab"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2 px-3 py-1 bg-black/60 rounded-xl border border-white/10 text-xs font-mono font-bold text-white min-w-[120px] max-w-[170px] justify-center">
              {React.createElement(currentTabItem.icon, { size: 14, className: "text-[#fff500] shrink-0" })}
              <span className="truncate">{currentTabItem.label}</span>
            </div>

            <button
              onClick={handleNextTabNav}
              className="w-7 h-7 rounded-xl bg-slate-900 hover:bg-[#fff500] hover:text-black text-[#fff500] flex items-center justify-center transition-colors cursor-pointer border border-[#fff500]/30 shrink-0"
              title="Next Tab"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="header-status-pill shrink-0" style={{
            borderColor: serialStatus === 'CONNECTED' ? '#22c55e' : serialStatus === 'SIMULATOR' ? '#06b6d4' : '#ef4444'
          }}>
            <span className={`status-dot ${
              serialStatus === 'CONNECTED' 
                ? 'connected' 
                : serialStatus === 'SIMULATOR' 
                  ? 'simulating' 
                  : 'disconnected'
            }`} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {serialStatus === 'CONNECTED' && 'COM PORT CONNECTED'}
              {serialStatus === 'SIMULATOR' && 'SIMULATING TIMERS'}
              {serialStatus === 'DISCONNECTED' && 'NO USB CABLE'}
            </span>
          </div>

          {/* Interactive Profile & Auth Menu */}
          {isLoggedIn ? (
            <div className="relative shrink-0 pr-2">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950 border border-[#fff500]/60 text-xs font-sans text-[#fff500] hover:bg-slate-900 transition-all cursor-pointer shrink-0"
                style={{
                  boxShadow: '0 0 12px rgba(255, 245, 0, 0.25)'
                }}
                title="User Profile & Session Controls"
              >
                <div 
                  className="w-6 h-6 rounded-full bg-[#fff500]/20 border border-[#fff500] text-[#fff500] flex items-center justify-center font-bold text-[11px] shrink-0"
                  style={{ boxShadow: '0 0 8px rgba(255, 245, 0, 0.4)' }}
                >
                  {userEmail ? userEmail[0].toUpperCase() : 'O'}
                </div>
                <div className="flex flex-col text-left leading-tight shrink-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Operator</span>
                  <span className="text-[11px] font-medium text-slate-100 truncate max-w-[140px] sm:max-w-[180px]">
                    {userEmail || 'operator@touchteck.com'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-[#fff500] shrink-0 ml-0.5" />
              </button>

              {isProfileMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-3 w-80 sm:w-[370px] bg-slate-950 border-2 border-[#fff500] rounded-3xl shadow-2xl z-[99999] text-xs font-sans text-slate-200 animate-fadeIn"
                  style={{
                    boxShadow: '0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(255,245,0,0.3)',
                    padding: '20px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  {/* Top Header Section */}
                  <div className="flex items-center gap-3" style={{ paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div 
                      className="w-10 h-10 rounded-2xl bg-[#fff500] text-black flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ boxShadow: '0 0 12px rgba(255, 245, 0, 0.5)' }}
                    >
                      {userEmail ? userEmail[0].toUpperCase() : 'O'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-white text-xs sm:text-sm truncate tracking-tight">
                        {userEmail || 'operator@touchteck.com'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-[#fff500] font-semibold tracking-wide">Active Operator Session</span>
                      </div>
                    </div>
                  </div>

                  {/* Sleek Compact Session Metadata */}
                  <div className="flex flex-col gap-3 font-mono text-[11px] text-slate-300" style={{ marginTop: '14px', marginBottom: '16px' }}>
                    {/* Console Role Row */}
                    <div
                      className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 hover:border-[#fff500]/50 transition-all shadow-md whitespace-nowrap group"
                      style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', minHeight: '46px', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-center gap-2.5 shrink-0">
                        <Cpu className="w-4 h-4 text-[#fff500] shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-slate-200 font-extrabold text-xs tracking-wide">Console Role:</span>
                      </div>
                      <span
                        className="text-[#fff500] font-black text-xs shrink-0 bg-[#fff500]/15 rounded-xl border border-[#fff500]/40 shadow-[0_0_10px_rgba(255,245,0,0.2)]"
                        style={{ paddingLeft: '14px', paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px' }}
                      >
                        Timing Operator
                      </span>
                    </div>

                    {/* Security Access Row */}
                    <div
                      className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 hover:border-emerald-500/50 transition-all shadow-md whitespace-nowrap group"
                      style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', minHeight: '46px', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-center gap-2.5 shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-slate-200 font-extrabold text-xs tracking-wide">Security Access:</span>
                      </div>
                      <span
                        className="text-emerald-300 font-black text-xs flex items-center gap-1.5 shrink-0 bg-emerald-500/15 rounded-xl border border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                        style={{ paddingLeft: '14px', paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px' }}
                      >
                        ● Verified
                      </span>
                    </div>

                    {/* Auto-Save State Row */}
                    <div
                      className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 hover:border-cyan-500/50 transition-all shadow-md whitespace-nowrap group"
                      style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px', minHeight: '46px', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-center gap-2.5 shrink-0">
                        <Database className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-slate-200 font-extrabold text-xs tracking-wide">Auto-Save State:</span>
                      </div>
                      <span
                        className="text-cyan-300 font-black text-xs shrink-0 bg-cyan-500/15 rounded-xl border border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                        style={{ paddingLeft: '14px', paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px' }}
                      >
                        Enabled & Saved
                      </span>
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div style={{ paddingTop: '14px', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full hover:bg-rose-500/25 transition-all cursor-pointer shadow-lg tracking-wide"
                      style={{
                        paddingTop: '11px',
                        paddingBottom: '11px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        borderRadius: '14px',
                        backgroundColor: 'rgba(244, 63, 94, 0.15)',
                        border: '2px solid rgba(244, 63, 94, 0.4)',
                        color: '#fda4af',
                        fontWeight: 800,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <LogOut size={15} />
                      <span>Log Out & Return to Home</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#fff500] text-black font-extrabold text-xs shadow-md hover:bg-[#e6dc00] transition-all cursor-pointer"
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}
        </div>
      </header>
    )}

      {/* Primary Layout Panel */}
      <main className="main-content">
        
        {activeTab === 'scoreboard' && (
          <Scoreboard
            activeMeetId={activeMeetId}
            activeEventId={activeEventId}
            activeHeatNum={activeHeatNum}
            isFinals={isFinals}
            elapsedTime={elapsedTime}
            timerStatus={timerStatus}
            lanes={lanes}
            onRaceComplete={handleStopTimer}
            displayConfig={scoreboardConfig}
            isTestMode={isTestMode}
          />
        )}

        {activeTab === 'operator' && (
          <OperatorConsole
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            activeMeetId={activeMeetId}
            activeEventId={activeEventId}
            setActiveEventId={setActiveEventId}
            activeHeatNum={activeHeatNum}
            setActiveHeatNum={setActiveHeatNum}
            isFinals={isFinals}
            setIsFinals={setIsFinals}
            elapsedTime={elapsedTime}
            timerStatus={timerStatus}
            lanes={lanes}
            handleManualStart={serialDriver.injectRawLine.bind(serialDriver, 'START')}
            handleResetTimer={handleResetTimer}
            handleStopTimer={handleStopTimer}
            handleSaveResults={handleSaveResults}
            eventLaps={eventLaps}
            bothEnds={bothEnds}
            setBothEnds={setBothEnds}
            scoreboardConfig={scoreboardConfig}
            setScoreboardConfig={setScoreboardConfig}
            isTestMode={isTestMode}
            setIsTestMode={setIsTestMode}
            setShowTestModeConfirm={setShowTestModeConfirm}
          />
        )}

        {activeTab === 'system-check' && (
          <SystemCheck
            systemCheckPads={systemCheckPads}
            setSystemCheckPads={setSystemCheckPads}
            starterChecked={starterChecked}
            setStarterChecked={setStarterChecked}
            micChecked={micChecked}
            setMicChecked={setMicChecked}
            serialStatus={serialStatus}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
          />
        )}

        {activeTab === 'meet-setup' && (
          <MeetManager 
            activeMeetId={activeMeetId}
            setActiveMeetId={setActiveMeetId}
            activeEventId={activeEventId}
            setActiveEventId={setActiveEventId}
            activeHeatNum={activeHeatNum}
            setActiveHeatNum={setActiveHeatNum}
          />
        )}

        {activeTab === 'swimmer-registry' && (
          <SwimmerManager activeMeetId={activeMeetId} />
        )}

        {activeTab === 'qualifying' && (
          <QualifyingStandards activeMeetId={activeMeetId} />
        )}

        {activeTab === 'results' && (
          <ResultsExport activeMeetId={activeMeetId} />
        )}

      </main>

      {/* Save Success Popup Modal */}
      {saveSuccessInfo.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '450px', textAlign: 'center', padding: '2rem 1.75rem' }}>
            {saveSuccessInfo.hasAnyTouch === false ? (
              <>
                <div 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    border: '2px solid var(--accent-red)',
                    color: 'var(--accent-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
                  }}
                >
                  <AlertCircle size={32} />
                </div>

                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  No Touch Recorded
                </h3>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  No touchpad hits were recorded for <strong>Heat {saveSuccessInfo.heatNum}</strong>. Results have been saved with <strong>NO TOUCH (NT)</strong> status.
                </p>
              </>
            ) : (
              <>
                <div 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                    border: '2px solid var(--accent-green)',
                    color: 'var(--accent-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>

                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Results Saved Successfully!
                </h3>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  Heat {saveSuccessInfo.heatNum} results have been recorded into the database and are now viewable in <strong>Reports</strong>.
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {saveSuccessInfo.hasAnyTouch === false ? (
                <>
                  <button 
                    className="btn btn-cyan"
                    onClick={() => {
                      setSaveSuccessInfo(prev => ({ ...prev, isOpen: false }));
                      handleResetTimer();
                    }}
                    style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <RotateCcw size={16} /> Retake Heat
                  </button>

                  <button 
                    className="btn btn-secondary"
                    onClick={() => setSaveSuccessInfo(prev => ({ ...prev, isOpen: false }))}
                    style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    OK
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setSaveSuccessInfo(prev => ({ ...prev, isOpen: false }));
                      setActiveTab('results');
                    }}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <FileText size={16} /> View Reports
                  </button>

                  {saveSuccessInfo.nextHeatNum !== null ? (
                    <button 
                      className="btn btn-cyan"
                      onClick={() => {
                        if (saveSuccessInfo.nextHeatNum !== null) {
                          setActiveHeatNum(saveSuccessInfo.nextHeatNum);
                        }
                        setSaveSuccessInfo(prev => ({ ...prev, isOpen: false }));
                      }}
                      style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      Load Heat {saveSuccessInfo.nextHeatNum} →
                    </button>
                  ) : (
                    <button 
                      className="btn btn-cyan"
                      onClick={() => setSaveSuccessInfo(prev => ({ ...prev, isOpen: false }))}
                      style={{ padding: '0.55rem 1.5rem', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      OK
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Mode Confirmation Modal */}
      <ConfirmationModal
        isOpen={showTestModeConfirm}
        title={isTestMode ? "Exit Test Mode" : "System Test Mode"}
        message={
          isTestMode 
            ? "Do you want to exit Test Mode and return to official timing?" 
            : "Do you want to test the system? In Test Mode, screen displays will show 'TESTING' instead of 'READY'."
        }
        confirmText={isTestMode ? "Exit Test Mode" : "Yes, Start Testing"}
        cancelText="No / Cancel"
        onConfirm={() => {
          setIsTestMode(!isTestMode);
          setShowTestModeConfirm(false);
        }}
        onCancel={() => setShowTestModeConfirm(false)}
      />

      {/* Floating Bottom-Right Corner Fullscreen Button (only visible on Scoreboard Display when not in fullscreen) */}
      {!isFullscreen && activeTab === 'scoreboard' && (
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-4 right-5 z-[999999] flex items-center gap-2.5 px-5 py-2 rounded-full bg-black/75 border border-cyan-500/40 text-cyan-400/70 hover:text-cyan-300 hover:bg-black/95 hover:border-cyan-400 hover:opacity-100 opacity-60 shadow-lg backdrop-blur-md transition-all cursor-pointer group hover:scale-105"
          title="Enable Fullscreen Mode (Ctrl+F)"
          style={{
            boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)'
          }}
        >
          <Maximize2 size={13} className="text-cyan-400/80 group-hover:text-cyan-300" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-400/80 group-hover:text-cyan-300">
            FULLSCREEN (CTRL+F)
          </span>
        </button>
      )}

      {/* Embedded Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
