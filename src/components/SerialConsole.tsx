import React, { useState, useEffect, useRef } from 'react';
import { serialDriver, simulator, TimingEvent } from '../serialDriver';
import { Terminal, Cpu, Play, Square, RotateCcw, AlertTriangle } from 'lucide-react';

interface SerialConsoleProps {
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  activeLanes: number[];
  eventLaps: number;
}

export default function SerialConsole({ 
  isSimulating, 
  setIsSimulating,
  activeLanes,
  eventLaps
}: SerialConsoleProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to serial events
    const unsubscribe = serialDriver.onData((event: TimingEvent) => {
      // Add raw text log
      setConsoleLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${event.raw}`]);
      
      if (event.type === 'START') {
        if (isSimulating) setSimRunning(true);
      }
      if (event.type === 'FINISH' && event.raw === 'SYSTEM: DISCONNECTED') {
        setIsConnected(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isSimulating]);

  const consoleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  const handleConnect = async () => {
    try {
      if (isSimulating) {
        setIsSimulating(false);
        simulator.stop();
        setSimRunning(false);
      }
      const success = await serialDriver.connect(baudRate);
      if (success) {
        setIsConnected(true);
        setConsoleLogs(prev => [...prev, `[SYSTEM] Connected to serial port at ${baudRate} baud.`]);
      }
    } catch (err: any) {
      alert(`Connection failed: ${err.message || err}`);
    }
  };

  const handleDisconnect = async () => {
    await serialDriver.disconnect();
    setIsConnected(false);
    setConsoleLogs(prev => [...prev, '[SYSTEM] Port disconnected.']);
  };

  const toggleSimulator = () => {
    if (isConnected) {
      handleDisconnect();
    }
    const newSimState = !isSimulating;
    setIsSimulating(newSimState);
    if (!newSimState) {
      simulator.stop();
      setSimRunning(false);
    }
    setConsoleLogs(prev => [...prev, `[SYSTEM] Simulator Mode ${newSimState ? 'ENABLED' : 'DISABLED'}.`]);
  };

  const handleSimStart = () => {
    if (!isSimulating) return;
    setSimRunning(true);
    // Determine how many laps based on event distance (50m pool = 50m distance is 1 lap, 100m is 2 laps)
    // We will let the parent component pass down eventLaps
    simulator.startRace(eventLaps, activeLanes);
    setConsoleLogs(prev => [...prev, `[SIMULATOR] Starting race: ${eventLaps} lengths for lanes [${activeLanes.join(', ')}]`]);
  };

  const handleSimStop = () => {
    simulator.stop();
    setSimRunning(false);
    setConsoleLogs(prev => [...prev, '[SIMULATOR] Race stopped.']);
  };

  const handleSimTouch = (lane: number) => {
    simulator.manualTouch(lane);
  };

  const clearConsole = () => {
    setConsoleLogs([]);
  };

  return (
    <div className="settings-panel">
      
      {/* Port Connection Settings */}
      <div className="settings-section">
        <h4 className="settings-header">
          <Terminal size={16} className="text-cyan" /> Hardware Connection
        </h4>

        {!serialDriver.isSupported() ? (
          <div className="flex items-center gap-2 text-red" style={{ fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <AlertTriangle size={24} />
            <span>Web Serial API not supported in this browser. Please run in Google Chrome or Microsoft Edge.</span>
          </div>
        ) : (
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

            <div className="flex gap-2">
              {isConnected ? (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDisconnect}>
                  Disconnect
                </button>
              ) : (
                <button 
                  className="btn btn-cyan" 
                  style={{ flex: 1 }} 
                  onClick={handleConnect}
                  disabled={isSimulating}
                >
                  Connect USB
                </button>
              )}

              <button 
                className={`btn ${isSimulating ? 'btn-success' : 'btn-secondary'}`} 
                style={{ flex: 1 }} 
                onClick={toggleSimulator}
              >
                <Cpu size={16} /> Simulator
              </button>
            </div>
            
            {isConnected && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }} className="text-center">
                ● Connected to timing hardware
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simulator Control Board */}
      {isSimulating && (
        <div className="settings-section" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
          <h4 className="settings-header text-amber">
            <Cpu size={16} /> Timing Simulator
          </h4>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {simRunning ? (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleSimStop}>
                  <Square size={14} /> Stop Race
                </button>
              ) : (
                <button className="btn btn-cyan" style={{ flex: 1 }} onClick={handleSimStart}>
                  <Play size={14} /> Start Race
                </button>
              )}
              
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => { simulator.reset(); setSimRunning(false); }}>
                <RotateCcw size={16} />
              </button>
            </div>

            {simRunning && (
              <div>
                <label className="form-label mt-2">Trigger Lane Touches</label>
                <div className="simulator-lane-buttons">
                  {activeLanes.map(lane => (
                    <button
                      key={lane}
                      className="simulator-lane-btn active"
                      onClick={() => handleSimTouch(lane)}
                    >
                      Lane {lane}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: 600 }} className="text-center">
              ● Running timing simulation
            </div>
          </div>
        </div>
      )}

      {/* Raw Diagnostic Console */}
      <div className="settings-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex justify-between items-center mb-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <h4 className="settings-header" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            Raw Console
          </h4>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={clearConsole}>
            Clear
          </button>
        </div>

        <div 
          ref={consoleContainerRef}
          style={{ 
            backgroundColor: '#05070c', 
            fontFamily: 'monospace', 
            fontSize: '0.75rem', 
            color: '#a7f3d0', 
            padding: '0.75rem', 
            borderRadius: '6px', 
            border: '1px solid var(--border-color)', 
            height: '180px', 
            overflowY: 'auto',
            whiteSpace: 'pre-wrap'
          }}
        >
          {consoleLogs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Console idle. Awaiting serial timing signals...</span>
          ) : (
            consoleLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
