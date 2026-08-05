import React, { useState, useEffect } from 'react';
import { db, QualifyingTime } from '../db';
import { Award, Save, Info } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface QualifyingStandardsProps {
  activeMeetId?: number | null;
}

export default function QualifyingStandards({ activeMeetId }: QualifyingStandardsProps) {
  const [qualifyingTimes, setQualifyingTimes] = useState<QualifyingTime[]>([]);
  const [meetName, setMeetName] = useState<string>('');

  // Selection/Filter States
  const [selectedStroke, setSelectedStroke] = useState<QualifyingTime['stroke']>('Freestyle');
  const [selectedGender, setSelectedGender] = useState<QualifyingTime['gender']>('M');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<QualifyingTime['ageGroup']>('Group A');
  const [selectedDistance, setSelectedDistance] = useState<number | 'all'>('all');

  // Get active distances based on selected stroke
  const getDistancesForStroke = (stroke: QualifyingTime['stroke']): number[] => {
    switch (stroke) {
      case 'Freestyle':
        return [50, 100, 200, 400, 800, 1500];
      case 'Backstroke':
      case 'Breaststroke':
      case 'Butterfly':
        return [50, 100, 200];
      case 'Individual Medley':
        return [200, 400];
      default:
        return [50, 100, 200, 400, 800, 1500];
    }
  };

  const activeDistances = getDistancesForStroke(selectedStroke);

  // When stroke changes, reset distance to 'all' if current selection isn't valid
  useEffect(() => {
    if (selectedDistance !== 'all' && !activeDistances.includes(selectedDistance as number)) {
      setSelectedDistance('all');
    }
  }, [selectedStroke]);

  // Rows to show in the table (filtered by selectedDistance if not 'all')
  const visibleDistances = selectedDistance === 'all'
    ? activeDistances
    : activeDistances.filter(d => d === selectedDistance);

  const [gridTimes, setGridTimes] = useState<{ [distance: number]: string }>({});

  useEffect(() => {
    loadStandards();
  }, [selectedStroke, selectedGender, selectedAgeGroup, activeMeetId]);

  const loadStandards = async () => {
    if (activeMeetId) {
      const meet = await db.meets.get(activeMeetId);
      if (meet) setMeetName(meet.name);
    }

    const list = await db.qualifyingTimes
      .where('stroke')
      .equals(selectedStroke)
      .filter(qt => 
        qt.gender === selectedGender && 
        qt.ageGroup === selectedAgeGroup &&
        (!activeMeetId || qt.meetId === activeMeetId)
      )
      .toArray();

    setQualifyingTimes(list);

    // Populate temporary state for the inputs
    const initialGrid: { [distance: number]: string } = {};
    activeDistances.forEach(d => {
      const match = list.find(qt => qt.distance === d);
      initialGrid[d] = match ? formatSecondsToTime(match.time) : '';
    });
    setGridTimes(initialGrid);
  };

  // Convert raw seconds (e.g. 84.52) to MM:SS.hh format (e.g. "01:24.52")
  const formatSecondsToTime = (totalSecs: number): string => {
    if (isNaN(totalSecs) || totalSecs <= 0) return '';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 0) {
      return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    return secs.toFixed(2).padStart(5, '0');
  };

  // Parse input into total seconds.
  // Supports three formats:
  //   1. 6-digit compact:  MMSSCC  e.g. 002895  → 00min 28sec 95cs → 28.95s
  //   2. Colon-separated: MM:SS.hh e.g. 01:04.52 → 64.52s
  //   3. Flat seconds:    SS.hh   e.g. 28.95
  const parseTimeToSeconds = (str: string): number => {
    const trimmed = str.trim();
    if (!trimmed) return 0;

    // Format 1: exactly 6 digits — MMSSCC
    if (/^\d{6}$/.test(trimmed)) {
      const mins = parseInt(trimmed.substring(0, 2), 10);
      const secs = parseInt(trimmed.substring(2, 4), 10);
      const cs   = parseInt(trimmed.substring(4, 6), 10);
      return (mins * 60) + secs + (cs / 100);
    }

    // Format 2: MM:SS.hh
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return (mins * 60) + secs;
      }
    }

    // Format 3: flat seconds
    return parseFloat(trimmed) || 0;
  };

  const handleInputChange = (distance: number, value: string) => {
    setGridTimes(prev => ({ ...prev, [distance]: value }));
  };

  const handleSaveStandard = async (distance: number) => {
    const timeStr = gridTimes[distance];
    const timeInSecs = parseTimeToSeconds(timeStr);

    const existing = await db.qualifyingTimes
      .where('distance')
      .equals(distance)
      .filter(qt => 
        qt.stroke === selectedStroke && 
        qt.gender === selectedGender && 
        qt.ageGroup === selectedAgeGroup &&
        (!activeMeetId || qt.meetId === activeMeetId)
      )
      .first();

    if (existing) {
      if (timeInSecs <= 0) {
        if (existing.id) await db.qualifyingTimes.delete(existing.id);
      } else {
        existing.time = timeInSecs;
        if (activeMeetId) existing.meetId = activeMeetId;
        await db.qualifyingTimes.put(existing);
      }
    } else if (timeInSecs > 0) {
      await db.qualifyingTimes.add({
        meetId: activeMeetId || 1,
        distance,
        stroke: selectedStroke,
        gender: selectedGender,
        ageGroup: selectedAgeGroup,
        time: timeInSecs
      });
    }

    loadStandards();
    window.dispatchEvent(new CustomEvent('qualifying-times-updated'));
  };

  const handleSaveAll = async () => {
    for (const d of activeDistances) {
      await handleSaveStandard(d);
    }
    window.dispatchEvent(new CustomEvent('qualifying-times-updated'));
    alert('Qualifying Standards saved successfully for active meet!');
  };

  return (
    <div className="glass-card">
      <div className="card-header flex justify-between items-center mb-4">
        <div>
          <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <Award size={20} className="text-cyan" /> Qualifying Cutoff Standards
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Set qualification cut-off times for {meetName ? `"${meetName}"` : 'the active meet'}.
          </p>
        </div>
        <button className="btn btn-cyan" onClick={handleSaveAll}>
          <Save size={16} /> Save All standards
        </button>
      </div>

      <div className="qt-grid-container mt-4">
        {/* Filter / Selector row */}
        <div className="qt-filters">

          {/* ── Meters (Distance) filter — BEFORE Stroke ── */}
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label">Meters</label>
            <CustomSelect
              options={[
                { value: 'all', label: 'All Distances' },
                ...getDistancesForStroke(selectedStroke).map(d => ({ value: d, label: `${d}m` }))
              ]}
              value={selectedDistance}
              onChange={(val) => setSelectedDistance(val === 'all' ? 'all' : parseInt(val, 10))}
            />
          </div>

          {/* ── Stroke ── */}
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label">Stroke</label>
            <CustomSelect
              options={[
                { value: 'Freestyle', label: 'Freestyle' },
                { value: 'Backstroke', label: 'Backstroke' },
                { value: 'Breaststroke', label: 'Breaststroke' },
                { value: 'Butterfly', label: 'Butterfly' },
                { value: 'Individual Medley', label: 'Individual Medley' }
              ]}
              value={selectedStroke}
              onChange={(val) => setSelectedStroke(val as QualifyingTime['stroke'])}
            />
          </div>

          {/* ── Gender ── */}
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label">Gender</label>
            <CustomSelect
              options={[
                { value: 'M', label: 'Men' },
                { value: 'F', label: 'Women' }
              ]}
              value={selectedGender}
              onChange={(val) => setSelectedGender(val as QualifyingTime['gender'])}
            />
          </div>

          {/* ── Age Group ── */}
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label">Age Group</label>
            <CustomSelect
              options={[
                { value: 'Group A', label: 'Group A' },
                { value: 'Group B', label: 'Group B' },
                { value: 'Group C', label: 'Group C' },
                { value: 'Group D', label: 'Group D' }
              ]}
              value={selectedAgeGroup}
              onChange={(val) => setSelectedAgeGroup(val as QualifyingTime['ageGroup'])}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
          <Info size={18} className="text-cyan" />
          <span>
            Enter times as <strong>MMSSCC</strong> (e.g. <strong>002895</strong> = 0 min 28.95 sec),&nbsp;
            <strong>MM:SS.hh</strong> (e.g. <strong>01:04.52</strong>), or <strong>SS.hh</strong> (e.g. <strong>26.50</strong>).
            &nbsp;Leave blank to clear the standard.
          </span>
        </div>

        {/* Input grid */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Event Distance</th>
                <th style={{ width: '30%', textAlign: 'center' }}>Qualifying Time</th>
                <th style={{ width: '30%', textAlign: 'center' }}>Standard (Seconds)</th>
              </tr>
            </thead>
            <tbody>
              {visibleDistances.map(d => {
                const rawSecs = parseTimeToSeconds(gridTimes[d] || '');
                return (
                  <tr key={d}>
                    <td style={{ fontWeight: 600 }}>{d}m &nbsp;{selectedStroke}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="text"
                        className="qt-input"
                        placeholder="--:--.--"
                        style={{ width: '120px', padding: '0.4rem' }}
                        value={gridTimes[d] || ''}
                        onChange={(e) => handleInputChange(d, e.target.value)}
                        onBlur={() => handleSaveStandard(d)}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: rawSecs > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {rawSecs > 0 ? `${rawSecs.toFixed(2)}s` : 'Not Set'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
