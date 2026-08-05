import React, { useState, useEffect } from 'react';
import { playBeeps, playStarterHorn, playMicSweep, playTouchpadChime } from '../audioUtility';
import { ShieldCheck, Cpu, Play, HelpCircle, Volume2, Mic, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { serialDriver, simulator } from '../serialDriver';
import ConfirmationModal from './ConfirmationModal';

interface SystemCheckProps {
  systemCheckPads: number[];
  setSystemCheckPads: React.Dispatch<React.SetStateAction<number[]>>;
  starterChecked: boolean;
  setStarterChecked: (checked: boolean) => void;
  micChecked: boolean;
  setMicChecked: (checked: boolean) => void;
  serialStatus?: 'CONNECTED' | 'DISCONNECTED' | 'SIMULATOR';
  isSimulating?: boolean;
  setIsSimulating?: (sim: boolean) => void;
}

export default function SystemCheck({
  systemCheckPads,
  setSystemCheckPads,
  starterChecked,
  setStarterChecked,
  micChecked,
  setMicChecked,
  serialStatus = 'DISCONNECTED',
  isSimulating = false,
  setIsSimulating
}: SystemCheckProps) {
  
  const [isConnected, setIsConnected] = useState(serialDriver.isConnected());
  const [baudRate, setBaudRate] = useState(9600);
  const [showSimConfirm, setShowSimConfirm] = useState(false);

  useEffect(() => {
    const checkConn = () => setIsConnected(serialDriver.isConnected());
    checkConn();
    const interval = setInterval(checkConn, 1000);
    return () => clearInterval(interval);
  }, []);

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
          setIsSimulating?.(false);
          simulator.stop();
        }
        setIsConnected(true);
      }
    } catch (err: any) {
      if (isUserCancellation(err)) {
        console.log('[SYSTEM] Serial port selection cancelled by user.');
        return;
      }
      alert(`Connection failed: ${err?.message || err}`);
    }
  };

  const handleSimulatorButtonClick = async () => {
    if (isSimulating || isConnected) {
      setShowSimConfirm(true);
      return;
    }

    try {
      const success = await serialDriver.connect(baudRate);
      if (success) {
        setIsConnected(true);
        setIsSimulating?.(false);
        return;
      }
    } catch (err: any) {
      if (isUserCancellation(err)) {
        console.log('[SYSTEM] Hardware port selection cancelled, starting Simulator...');
      }
    }

    setIsSimulating?.(true);
  };

  const handleConfirmStopSim = async () => {
    setShowSimConfirm(false);
    if (isConnected) {
      await serialDriver.disconnect();
      setIsConnected(false);
    }
    setIsSimulating?.(false);
    simulator.stop();
  };

  const isSerialConnected = isConnected || serialStatus === 'CONNECTED';
  const isSimulator = serialStatus === 'SIMULATOR' || isSimulating;

  const handleTestLane = (lane: number) => {
    playTouchpadChime();
    serialDriver.injectRawLine(`TF 0${lane} 00:00.00`);
    setSystemCheckPads(prev => {
      if (prev.includes(lane)) return prev;
      return [...prev, lane];
    });
  };

  const handleTestStarter = () => {
    playStarterHorn();
    serialDriver.injectRawLine('START');
    setStarterChecked(true);
  };

  const handleTestMic = () => {
    playMicSweep();
    setMicChecked(true);
  };

  const handleResetChecks = () => {
    setSystemCheckPads([]);
    setStarterChecked(false);
    setMicChecked(false);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Overview Stats and Action controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Main Status Panel */}
        <div className="glass-card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <ShieldCheck size={22} className="text-green" /> Pre-Meet Diagnostics
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Verify touchpads, starter horns, and hardware timing driver before official meet heats.
              </p>
            </div>
            
            <button className="btn btn-secondary" onClick={handleResetChecks} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> Reset Diagnostics
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            {/* USB Console status card */}
            <div className="settings-section" style={{ borderLeft: `3px solid ${isSerialConnected ? 'var(--accent-green)' : isSimulator ? 'var(--accent-cyan)' : 'var(--accent-red)'}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TIMING CONSOLE PORT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.25rem 0' }}>
                {isSerialConnected ? 'USB Active (ARES 21)' : isSimulator ? 'Simulator Active' : 'No Connection'}
              </div>
              <span style={{ fontSize: '0.75rem', color: isSerialConnected ? 'var(--accent-green)' : isSimulator ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                {isSerialConnected ? '✓ Comm tunnel OK' : isSimulator ? '✓ Simulating hardware inputs' : 'Connect USB or start Simulator'}
              </span>
            </div>

            {/* Starter System status card */}
            <div className="settings-section" style={{ borderLeft: `3px solid ${starterChecked ? 'var(--accent-green)' : 'var(--accent-amber)'}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STARTER PISTOL LINK</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.25rem 0' }}>
                {starterChecked ? 'Starter OK' : 'Pending Test'}
              </div>
              <span style={{ fontSize: '0.75rem', color: starterChecked ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {starterChecked ? '✓ Start signal received' : 'Trigger starter or click test'}
              </span>
            </div>

            {/* Microphone system status card */}
            <div className="settings-section" style={{ borderLeft: `3px solid ${micChecked ? 'var(--accent-green)' : 'var(--accent-amber)'}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>MICROPHONE FEED</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.25rem 0' }}>
                {micChecked ? 'Audio Sweep OK' : 'Pending Test'}
              </div>
              <span style={{ fontSize: '0.75rem', color: micChecked ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {micChecked ? '✓ Speakers/Mike audited' : 'Click Mic Check to test sweep'}
              </span>
            </div>
          </div>

        </div>

        {/* Diagnostic Action Drawer */}
        <div className="glass-card">
          <h3 className="settings-header"><Volume2 size={16} /> Component Tests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            
            <div className="flex gap-2">
              {isSimulating && !isConnected && (
                <button 
                  className="btn btn-cyan" 
                  style={{ flex: 1 }} 
                  onClick={handleConnect}
                >
                  Connect USB
                </button>
              )}

              <button 
                className={`btn ${isSimulating || isConnected ? 'btn-danger' : 'btn-success'}`} 
                style={{ flex: 1, fontWeight: 700 }} 
                onClick={handleSimulatorButtonClick}
              >
                {isSimulating || isConnected ? 'Stop Simulator' : 'Simulator'}
              </button>
            </div>

            <button className="btn btn-cyan" onClick={handleTestStarter} style={{ width: '100%' }}>
              <Play size={16} /> Test Starter horn
            </button>
            
            <button className="btn btn-secondary" onClick={handleTestMic} style={{ width: '100%', borderColor: 'var(--accent-blue)', color: '#93c5fd' }}>
              <Mic size={16} /> Test Microphone sweep
            </button>

            <button 
              className="btn btn-secondary" 
              onClick={() => playBeeps(3, 800, 0.08, 0.1)} 
              style={{ width: '100%' }}
            >
              <Volume2 size={16} /> Test 3-Beep sequence
            </button>
          </div>
        </div>

      </div>

      {/* Lanes Touchpad Grid */}
      <div className="glass-card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="settings-header" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            Lanes Touchpad Matrix (Lanes 1 to 8)
          </h3>
          <span className="pill-info" style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>
            Tested: {systemCheckPads.length} / 8 Touchpads
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(lane => {
            const isPassed = systemCheckPads.includes(lane);
            
            return (
              <div 
                key={lane} 
                className="lane-card" 
                style={{ 
                  flexDirection: 'column', 
                  alignItems: 'stretch', 
                  gap: '0.75rem', 
                  padding: '1rem',
                  gridTemplateColumns: '1fr',
                  backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary)',
                  borderLeft: `4px solid ${isPassed ? 'var(--accent-green)' : 'var(--border-color)'}`,
                  boxShadow: isPassed ? '0 0 15px rgba(16, 185, 129, 0.1)' : 'none'
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="lane-number-badge" style={{ width: '28px', height: '28px', fontSize: '0.9rem' }}>
                      {lane}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Touchpad #{lane}</span>
                  </div>
                  {isPassed ? (
                    <span className="flex items-center gap-1 font-bold text-xs text-emerald-400">
                      <CheckCircle size={14} /> Passed
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Untested</span>
                  )}
                </div>

                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      flex: 1, 
                      padding: '0.35rem 0.5rem', 
                      fontSize: '0.8rem',
                      borderColor: isPassed ? 'var(--accent-green)' : 'var(--border-color)',
                      color: isPassed ? 'var(--accent-green)' : 'var(--text-primary)'
                    }} 
                    onClick={() => handleTestLane(lane)}
                  >
                    {isPassed ? 'Test Again' : 'Simulate Tap'}
                  </button>
                </div>
            );
          })}
        </div>
      </div>

      {/* Info Warning Footer */}
      <div className="flex items-center gap-2 p-3 text-amber" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
        <AlertTriangle size={18} />
        <span>Audio check will utilize your browser's speakers. Make sure the volume is turned up. Any lane touch signal received from the physical ARES interface will instantly verify that touchpad and play the 3 beeps.</span>
      </div>

    </div>
  );
}
