import React, { useState, useEffect, useRef } from 'react';
import { db, Meet, Event, QualifyingTime } from '../db';
import { Award, Timer, Check } from 'lucide-react';
import { ScoreboardDisplayConfig, DEFAULT_SCOREBOARD_CONFIG } from '../types';

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

interface ScoreboardProps {
  activeMeetId: number | null;
  activeEventId: number | null;
  activeHeatNum: number;
  isFinals: boolean;
  elapsedTime: number;
  timerStatus: 'IDLE' | 'READY' | 'RUNNING' | 'FINISHED';
  lanes: LaneState[];
  onRaceComplete?: () => void; // called when last eligible swimmer finishes
  displayConfig?: ScoreboardDisplayConfig;
  isTestMode?: boolean;
}

export default function Scoreboard({
  activeMeetId,
  activeEventId,
  activeHeatNum,
  isFinals,
  elapsedTime,
  timerStatus,
  lanes,
  onRaceComplete,
  displayConfig,
  isTestMode
}: ScoreboardProps) {
  const config = displayConfig || DEFAULT_SCOREBOARD_CONFIG;
  const [meet, setMeet] = useState<Meet | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEventDetails();
  }, [activeMeetId, activeEventId]);

  const loadEventDetails = async () => {
    if (activeMeetId) {
      const m = await db.meets.get(activeMeetId);
      setMeet(m || null);
    } else {
      setMeet(null);
    }

    if (activeEventId) {
      const ev = await db.events.get(activeEventId);
      setEvent(ev || null);
    } else {
      setEvent(null);
    }
  };

  // ── Qualifying times for current event ─────────────────────────────────
  const [qualifyingTimesMap, setQualifyingTimesMap] = useState<{[ageGroup: string]: number}>({});

  useEffect(() => {
    if (!event) { setQualifyingTimesMap({}); return; }
    db.qualifyingTimes
      .where('stroke').equals(event.stroke)
      .filter((qt: QualifyingTime) => qt.meetId === event!.meetId && qt.gender === event!.gender && qt.distance === event!.distance)
      .toArray()
      .then((times: QualifyingTime[]) => {
        const map: {[ageGroup: string]: number} = {};
        times.forEach((t: QualifyingTime) => { map[t.ageGroup] = t.time; });
        setQualifyingTimesMap(map);
      });
  }, [event]);

  // ── Finish flash state ──────────────────────────────────────────────────
  interface FlashInfo {
    laneNum: number;
    swimmerName: string;
    time: number;
    triggeredAt: number;
  }
  const [flashFinish, setFlashFinish] = useState<FlashInfo | null>(null);
  const prevFinalTimesRef = useRef<{[lane: number]: number}>({});
  const FLASH_DURATION_MS = 5000;

  // Self-clear the flash banner on its own timer instead of relying on a future render.
  // Once the race clock stops, elapsedTime stops changing and nothing else re-renders
  // this component, so without an explicit timeout the banner freezes on screen forever.
  useEffect(() => {
    if (!flashFinish) return;
    const remaining = FLASH_DURATION_MS - (Date.now() - flashFinish.triggeredAt);
    if (remaining <= 0) { setFlashFinish(null); return; }
    const id = setTimeout(() => setFlashFinish(null), remaining);
    return () => clearTimeout(id);
  }, [flashFinish]);

  // Detect new finishes and store flash with a timestamp.
  // When multiple finishes occur, pick the latest finish time.
  useEffect(() => {
    // Clear flashFinish when race is reset to READY
    if ((timerStatus === 'READY' && elapsedTime === 0) || lanes.every(l => l.finalTime === 0)) {
      setFlashFinish(null);
      prevFinalTimesRef.current = {};
    }

    const hasSwimmers = lanes.some(l => l.swimmer != null);
    const newlyFinished = lanes.filter(
      l => (hasSwimmers ? l.swimmer != null : true) && l.status === 'OK' && l.finalTime > 0 && l.finalTime !== (prevFinalTimesRef.current[l.laneNumber] ?? 0)
    );

    if (newlyFinished.length > 0) {
      // Pick the newly finished lane with the highest (latest) finish time
      const latestFinisher = newlyFinished.reduce(
        (max, l) => (l.finalTime > max.finalTime ? l : max),
        newlyFinished[0]
      );

      setFlashFinish({
        laneNum: latestFinisher.laneNumber,
        swimmerName: latestFinisher.swimmer ? latestFinisher.swimmer.name : `Lane ${latestFinisher.laneNumber}`,
        time: latestFinisher.finalTime,
        triggeredAt: Date.now()
      });
    }

    // Auto-stop the clock when every eligible (OK-status) swimmer has finished.
    // DQ / DNS / DNF lanes are NOT counted — they never need a finish time.
    const eligibleLanes = lanes.filter(l => (hasSwimmers ? l.swimmer != null : true) && l.status === 'OK');
    const allDone = eligibleLanes.length > 0 && eligibleLanes.every(l => l.finalTime > 0);
    if (allDone && timerStatus === 'RUNNING') {
      onRaceComplete?.();
    }

    for (const lane of lanes) {
      prevFinalTimesRef.current[lane.laneNumber] = lane.finalTime;
    }
  }, [lanes, timerStatus, onRaceComplete]);

  // Flash is active only within 5 seconds of the triggeredAt timestamp (the effect above
  // also self-clears flashFinish via setTimeout so this stays correct even without a re-render).
  const isFlashActive = flashFinish != null &&
    (Date.now() - flashFinish.triggeredAt) < FLASH_DURATION_MS;

  // Maximum finish time among eligible swimmers who finished
  const hasSwimmers = lanes.some(l => l.swimmer != null);
  const finishedTimes = lanes.filter(l => (hasSwimmers ? l.swimmer != null : true) && l.status === 'OK' && l.finalTime > 0).map(l => l.finalTime);
  const finalHeatTime = finishedTimes.length > 0 ? Math.max(...finishedTimes) : elapsedTime;

  // Calculate finish ranks for completed swimmers (1st, 2nd, 3rd, etc.)
  const rankMap: { [laneNumber: number]: number } = {};
  const finishedLanesList = lanes
    .filter(l => (hasSwimmers ? l.swimmer != null : true) && l.status === 'OK' && l.finalTime > 0)
    .sort((a, b) => a.finalTime - b.finalTime);

  finishedLanesList.forEach((lane, index) => {
    rankMap[lane.laneNumber] = index + 1;
  });

  const getRankBadge = (rank: number) => {
    const labels = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
    const label = labels[rank - 1] || `${rank}TH`;
    const colors: { [r: number]: { bg: string; border: string; text: string } } = {
      1: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047' }, // Gold
      2: { bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', text: '#f1f5f9' }, // Silver
      3: { bg: 'rgba(217, 119, 6, 0.15)', border: '#d97706', text: '#fdba74' }  // Bronze
    };
    const style = colors[rank] || { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#38bdf8' };
    return (
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          padding: '0.15rem 0.55rem',
          borderRadius: '5px',
          backgroundColor: style.bg,
          border: `1.5px solid ${style.border}`,
          color: style.text,
          letterSpacing: '0.05em',
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1,
          boxShadow: `0 0 8px ${style.bg}`
        }}
      >
        {label}
      </span>
    );
  };

  const formatTimer = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    const minutesStr = mins > 0 ? `${mins.toString().padStart(2, '0')}:` : '00:';
    return `${minutesStr}${remainingSecs.toFixed(2).padStart(5, '0')}`;
  };

  const getLaneClockFont = (_laneNum: number): string => {
    return "'Roboto Mono', monospace";
  };

  const res = config.resolution || 'auto';
  const isCustom = res === 'custom';
  const customW = config.customAspectWidth || 12;
  const customH = config.customAspectHeight || 4;

  const ratioMap: { [key: string]: number } = {
    '16:9': 16 / 9,
    '16:10': 16 / 10,
    '4:3': 4 / 3,
    '5:4': 5 / 4,
    '1:1': 1 / 1,
    '12:4': 12 / 4,
    '21:9': 21 / 9,
    '32:9': 32 / 9,
  };

  const activeRatio = isCustom ? (customW / customH) : (ratioMap[res] || 0);

  const isSquare = activeRatio > 0 && activeRatio <= 1.25;
  const isBar = activeRatio >= 2.3;
  const isStandard = activeRatio > 1.25 && activeRatio < 2.3;

  const calculatedAspectRatio = isCustom
    ? `${customW} / ${customH}`
    : res !== 'auto' ? res.replace(':', ' / ') : undefined;

  const calculatedMaxWidth = activeRatio >= 2.3 ? '1350px' : (isSquare ? '740px' : isStandard ? '1000px' : '100%');

  const headerPadding = isSquare ? '0.75rem 1.25rem' : isBar ? '0.75rem 1.5rem' : res === '4:3' ? '1rem 1.75rem' : '1.5rem 2.5rem';
  const eventTitleSize = isSquare ? '1.4rem' : isBar ? '1.8rem' : res === '4:3' ? '2rem' : '2.4rem';
  const masterClockSize = isSquare ? '3.2rem' : isBar ? '3.8rem' : res === '4:3' ? '4.2rem' : '5.5rem';

  const lanePadding = isSquare ? '0.4rem 1rem' : isBar ? '0.45rem 1.25rem' : res === '4:3' ? '0.6rem 1.75rem' : '0.8rem 2.5rem';
  const laneMinHeight = isSquare ? '42px' : isBar ? '48px' : res === '4:3' ? '54px' : '68px';
  const laneSwimmerSize = isSquare ? '0.95rem' : isBar ? '1.1rem' : res === '4:3' ? '1.15rem' : '1.25rem';
  const laneClockSize = isSquare ? '1.25rem' : isBar ? '1.45rem' : res === '4:3' ? '1.6rem' : '1.8rem';
  const laneBadgeSize = isSquare ? '30px' : isBar ? '34px' : '38px';
  const laneBadgeFontSize = isSquare ? '1.1rem' : isBar ? '1.25rem' : '1.4rem';
  const timerColWidth = isSquare ? '210px' : isBar ? '260px' : res === '4:3' ? '280px' : '320px';
  const laneGap = isSquare ? '0.35rem' : isBar ? '0.45rem' : '0.6rem';

  return (
    <div 
      className="flex flex-col gap-4" 
      style={{ 
        width: '100%',
        maxWidth: calculatedMaxWidth,
        aspectRatio: calculatedAspectRatio,
        margin: '0 auto',
        padding: '0 1.25rem',
        boxSizing: 'border-box'
      }}
    >
      
      {/* LED Digital Scoreboard Board Header */}
      <div 
        className="glass-card" 
        style={{ 
          padding: headerPadding, 
          background: 'linear-gradient(135deg, #0f172a, #040814)', 
          borderLeft: '5px solid var(--accent-cyan)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: isSquare ? '1rem' : '2rem'
        }}
      >
        {event ? (
          <>
            {/* Event & Meet Information Details on the Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? '0.2rem' : '0.4rem' }}>
              {(config.showEventNumber || config.showHeatNumber) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: isSquare ? '0.4rem' : '0.75rem' }}>
                  {config.showEventNumber && (
                    <span 
                      style={{ 
                        color: 'var(--accent-cyan)', 
                        backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                        border: '1px solid var(--accent-cyan)', 
                        fontSize: isSquare ? '0.75rem' : '0.85rem', 
                        fontWeight: 700, 
                        padding: isSquare ? '0.15rem 0.45rem' : '0.25rem 0.65rem',
                        borderRadius: '4px',
                        letterSpacing: '0.05em'
                      }}
                    >
                      EVENT {event.id}
                    </span>
                  )}
                  {config.showHeatNumber && (
                    <span 
                      style={{ 
                        color: 'var(--accent-amber)', 
                        backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                        border: '1px solid var(--accent-amber)', 
                        fontSize: isSquare ? '0.75rem' : '0.85rem', 
                        fontWeight: 700, 
                        padding: isSquare ? '0.15rem 0.45rem' : '0.25rem 0.65rem',
                        borderRadius: '4px',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {isFinals ? 'FINALS' : 'HEAT'} {activeHeatNum}
                    </span>
                  )}
                </div>
              )}
              
              {config.showEventName && (
                <h1 style={{ fontSize: eventTitleSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0.1rem 0' }}>
                  {event.distance}m {event.stroke}
                </h1>
              )}
              
              {(config.showGender || config.showAgeCategory || config.showCompetitionName) && (
                <div className="flex gap-2 items-center" style={{ fontSize: isSquare ? '0.85rem' : '1rem', color: 'var(--text-secondary)' }}>
                  {config.showGender && (
                    <span style={{ color: '#fff', fontWeight: 600 }}>{event.gender === 'M' ? 'Men' : 'Women'}</span>
                  )}
                  {config.showGender && config.showAgeCategory && <span>•</span>}
                  {config.showAgeCategory && (
                    <span style={{ color: '#fff', fontWeight: 600 }}>{event.ageGroup}</span>
                  )}
                  {(config.showGender || config.showAgeCategory) && config.showCompetitionName && <span>|</span>}
                  {config.showCompetitionName && (
                    <span>{meet?.name || 'National Selection Trials 2026'}</span>
                  )}
                </div>
              )}
            </div>

            {/* Master Clock Timer on the Right */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ fontSize: isSquare ? '0.65rem' : '0.75rem', fontWeight: 700, letterSpacing: '0.2em', color: isFlashActive ? 'var(--accent-cyan)' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                {isFlashActive ? (
                  `${config.showLaneNumber ? `LN ${flashFinish!.laneNum}` : ''}${
                    config.showLaneNumber && config.showPlayerName ? '  •  ' : ''
                  }${config.showPlayerName ? flashFinish!.swimmerName.toUpperCase() : ''}`
                ) : (
                  <>
                    {timerStatus === 'RUNNING' && elapsedTime === 0 && (isTestMode ? 'TESTING' : 'CLOCK READY')}
                    {timerStatus === 'RUNNING' && elapsedTime > 0 && 'RACE ACTIVE'}
                    {timerStatus === 'READY' && (isTestMode ? 'TESTING' : 'CLOCK READY')}
                    {timerStatus === 'FINISHED' && 'FINISH OFFICIAL'}
                    {timerStatus === 'IDLE' && (isTestMode ? 'TESTING' : 'RESET')}
                  </>
                )}
              </span>
              
              <div 
                style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: masterClockSize, 
                  fontWeight: 900, 
                  color: isFlashActive
                    ? 'var(--accent-cyan)'
                    : timerStatus === 'RUNNING' ? 'var(--accent-cyan)'
                    : timerStatus === 'READY'   ? 'var(--accent-amber)'
                    : 'var(--text-primary)',
                  textShadow: isFlashActive
                    ? '0 0 25px var(--accent-cyan-glow)'
                    : timerStatus === 'RUNNING' ? '0 0 25px var(--accent-cyan-glow)'
                    : 'none',
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'color 0.3s ease, text-shadow 0.3s ease'
                }}
              >
                {config.showRunningFinishingTime
                  ? formatTimer(isFlashActive ? flashFinish!.time : (timerStatus === 'FINISHED' ? finalHeatTime : (timerStatus === 'READY' ? 0 : elapsedTime)))
                  : '--:--.--'}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center" style={{ padding: '1rem', color: 'var(--text-muted)', width: '100%' }}>
            <span>No Active Event Scheduled. Navigate to the Operator Desk to assign events.</span>
          </div>
        )}
      </div>

      {/* Lane Cards */}
      <div className="scoreboard-container" style={{ margin: 0, gap: laneGap }}>
        {lanes.map(lane => {
          const isLaneActive = timerStatus === 'RUNNING' && lane.finalTime === 0 && (lane.isRunning || !hasSwimmers);

          const currentLaneTime = lane.finalTime > 0 
            ? lane.finalTime 
            : (isLaneActive ? elapsedTime : 0);

          const hasFinished = lane.finalTime > 0;
          const playerRank = rankMap[lane.laneNumber];

          const gridCols = [
            config.showLaneNumber ? (isSquare ? '40px' : '60px') : null,
            '1fr',
            config.showPlayerPosition ? (isSquare ? '65px' : '90px') : null,
            timerColWidth
          ].filter(Boolean).join(' ');

          return (
            <div 
              key={lane.laneNumber} 
              className={`lane-card ${isLaneActive ? 'active-swim' : ''} ${hasFinished ? 'finished-swim' : ''}`}
              style={{ 
                gridTemplateColumns: gridCols, 
                padding: lanePadding,
                minHeight: laneMinHeight
              }}
            >
              {/* Lane Number circle */}
              {config.showLaneNumber && (
                <div className="lane-number-badge" style={{ width: laneBadgeSize, height: laneBadgeSize, fontSize: laneBadgeFontSize }}>
                  {lane.laneNumber}
                </div>
              )}

              {/* Swimmer Name and District / Club */}
              <div className="lane-swimmer-info">
                {lane.swimmer ? (
                  <>
                    {config.showPlayerName && (
                      <span className="lane-swimmer-name" style={{ fontSize: laneSwimmerSize }}>
                        {lane.swimmer.name}
                      </span>
                    )}
                    {config.showDistrictName && lane.swimmer.club && (
                      <div className="lane-swimmer-meta" style={{ marginTop: '0.1rem' }}>
                        <span className="lane-swimmer-club" style={{ fontSize: isSquare ? '0.75rem' : '0.85rem' }}>
                          {lane.swimmer.club}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="lane-swimmer-name" style={{ color: (hasFinished || isLaneActive) ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: (hasFinished || isLaneActive) ? 'normal' : 'italic', fontWeight: (hasFinished || isLaneActive) ? 600 : 400, fontSize: isSquare ? '0.9rem' : '1.15rem' }}>
                    {(hasFinished || isLaneActive) ? `Lane ${lane.laneNumber}` : '[ Empty Lane ]'}
                  </span>
                )}
              </div>

              {/* Dedicated Player Position Column */}
              {config.showPlayerPosition && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {playerRank ? (
                    getRankBadge(playerRank)
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.2)', fontWeight: 600 }}>--</span>
                  )}
                </div>
              )}

              {/* Live running clock, split timing, or final time */}
              <div className="lane-timer-display" style={{ fontSize: laneClockSize, paddingRight: isSquare ? '0.3rem' : '1rem', display: 'flex', alignItems: 'center', gap: isSquare ? '0.5rem' : '1.5rem', justifyContent: 'flex-end', fontFamily: getLaneClockFont(lane.laneNumber), fontVariantNumeric: 'tabular-nums' }}>
                {config.showSplitTiming && lane.swimmer && lane.lastSplitTime && lane.lastSplitTimestamp && (Date.now() - lane.lastSplitTimestamp < 10000) && (
                  <span 
                    style={{ 
                      fontSize: isSquare ? '0.85rem' : '1.1rem', 
                      color: 'var(--accent-amber)', 
                      backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: '4px', 
                      border: '1px solid var(--accent-amber)', 
                      fontFamily: getLaneClockFont(lane.laneNumber),
                      animation: 'pulse 1s infinite alternate'
                    }}
                  >
                    LAP {lane.splits.length}: {formatTimer(lane.lastSplitTime)}
                  </span>
                )}
                
                {config.showRunningFinishingTime ? (
                  lane.swimmer ? (
                    lane.status === 'OK' ? (
                      (hasFinished || isLaneActive) ? (
                        <span style={{ color: hasFinished ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
                          {formatTimer(currentLaneTime)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--accent-amber)', fontFamily: getLaneClockFont(lane.laneNumber), letterSpacing: '0.05em' }}>
                          {isTestMode ? 'TESTING' : 'READY'}
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: '1.2rem', color: 'var(--accent-red)', fontWeight: 700 }}>
                        {lane.status}
                      </span>
                    )
                  ) : (
                    '--:--.--'
                  )
                ) : (
                  '--:--.--'
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
