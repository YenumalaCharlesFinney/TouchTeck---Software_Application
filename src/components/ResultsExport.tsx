import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, Event, Result, Swimmer, QualifyingTime } from '../db';
import { Award, Download, Trash2, Filter, Printer, AlertTriangle } from 'lucide-react';
import CustomSelect from './CustomSelect';
import ConfirmationModal from './ConfirmationModal';
import { useModalClose } from '../hooks/useModalClose';

interface ResultRow {
  id?: number;
  rank: number;
  stage?: 'Heats' | 'Finals';
  laneNumber: number;
  heatNumber: number;
  swimmerName: string;
  club: string;
  ageGroup: string;
  finalTime: number;
  status: string;
  timingMethod?: 'T1' | 'T2';
  qualifyingTime?: number;
  isQualified: boolean;
  recordedAt?: number;
  isOutdatedFinals?: boolean;
}

interface NoticeModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

function NoticeModal({ isOpen, title, message, onClose }: NoticeModalProps) {
  const { isClosing, triggerClose } = useModalClose();

  if (!isOpen) return null;

  const closingClass = isClosing ? ' modal-closing' : '';

  return createPortal(
    <div className={`modal-overlay${closingClass}`} style={{ zIndex: 99999 }}>
      <div className={`modal-content${closingClass}`} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
            onClick={() => triggerClose(onClose)}
          >
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ margin: '1rem 0 1.5rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {message}
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-cyan"
            onClick={() => triggerClose(onClose)}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ResultsExportProps {
  activeMeetId?: number | null;
}

export default function ResultsExport({ activeMeetId }: ResultsExportProps) {
  const [meets, setMeets] = useState<Meet[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(activeMeetId || null);
  
  useEffect(() => {
    if (activeMeetId) setSelectedMeetId(activeMeetId);
  }, [activeMeetId]);

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<'All' | 'Heats' | 'Finals'>('All');

  const [leaderboard, setLeaderboard] = useState<ResultRow[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);
  
  const [isFinalsOutdated, setIsFinalsOutdated] = useState(false);
  const [latestHeatNumAfterFinals, setLatestHeatNumAfterFinals] = useState<number>(1);
  
  // Modals state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    ids: number[];
    title: string;
    message: string;
  }>({ isOpen: false, ids: [], title: '', message: '' });

  const [noticeState, setNoticeState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    loadMeets();
  }, []);

  useEffect(() => {
    if (selectedMeetId) {
      loadEvents(selectedMeetId);
    } else {
      setEvents([]);
      setSelectedEventId(null);
    }
  }, [selectedMeetId]);

  // Reload leaderboard whenever cutoff times are saved in the Cutoffs tab
  useEffect(() => {
    const handleQTUpdate = () => {
      if (selectedEventId) loadLeaderboard(selectedEventId, selectedStage);
    };
    window.addEventListener('qualifying-times-updated', handleQTUpdate);
    return () => window.removeEventListener('qualifying-times-updated', handleQTUpdate);
  }, [selectedEventId, selectedStage]);

  useEffect(() => {
    setSelectedResultIds([]);
    if (selectedEventId) {
      loadLeaderboard(selectedEventId, selectedStage);
    } else {
      setLeaderboard([]);
    }
  }, [selectedEventId, selectedStage]);

  const loadMeets = async () => {
    const list = await db.meets.toArray();
    setMeets(list);
    if (list.length > 0) {
      setSelectedMeetId(list[0].id || null);
    }
  };

  const loadEvents = async (meetId: number) => {
    const list = await db.events.where('meetId').equals(meetId).toArray();
    setEvents(list);
    if (list.length > 0) {
      setSelectedEventId(list[0].id || null);
    } else {
      setSelectedEventId(null);
    }
  };

  const loadLeaderboard = async (eventId: number, stageFilter: 'All' | 'Heats' | 'Finals' = 'All') => {
    const event = await db.events.get(eventId);
    if (!event) return;

    // Load all results for this event
    const results = await db.results.where('eventId').equals(eventId).toArray();

    // Check if finals are outdated (if any Heat was saved AFTER Finals were recorded)
    const heatsResults = results.filter(r => (r.stage || 'Heats') === 'Heats');
    const finalsResults = results.filter(r => r.stage === 'Finals');

    const maxHeatsTimestamp = heatsResults.length > 0 ? Math.max(...heatsResults.map(r => r.recordedAt || 0)) : 0;
    const maxFinalsTimestamp = finalsResults.length > 0 ? Math.max(...finalsResults.map(r => r.recordedAt || 0)) : 0;

    const latestHeatRecord = heatsResults.length > 0 
      ? heatsResults.reduce((max, r) => (r.recordedAt || 0) > (max.recordedAt || 0) ? r : max, heatsResults[0]) 
      : null;
    const latestHeatNum = latestHeatRecord ? latestHeatRecord.heatNumber : 1;

    const outdated = finalsResults.length > 0 && maxHeatsTimestamp > maxFinalsTimestamp;
    setIsFinalsOutdated(outdated);
    setLatestHeatNumAfterFinals(latestHeatNum);

    const filteredResults = results.filter(r => {
      if (stageFilter === 'All') return true;
      const rStage = r.stage || 'Heats';
      return rStage === stageFilter;
    });
    
    // Resolve swimmer details and qualifying times
    const rows: Omit<ResultRow, 'rank'>[] = [];

    for (const r of filteredResults) {
      if (!r.swimmerId) continue;
      const swimmer = await db.swimmers.get(r.swimmerId);
      if (!swimmer) continue;

      // Get QT standard
      const qt = await db.qualifyingTimes
        .where('[distance+stroke+gender+ageGroup]')
        .equals([event.distance, event.stroke, event.gender, event.ageGroup])
        .and(q => q.meetId === event.meetId)
        .first();

      const finalTime = r.finalTime || 0;
      const rawStatus = r.status || 'OK';
      const status = (rawStatus === 'OK' && finalTime <= 0) ? 'NT' : rawStatus;
      const isQualified = (status === 'OK' && finalTime > 0 && qt) ? finalTime <= qt.time : false;
      const rStage = r.stage || 'Heats';

      rows.push({
        id: r.id,
        stage: rStage,
        laneNumber: r.laneNumber,
        heatNumber: r.heatNumber,
        swimmerName: swimmer.name,
        club: swimmer.club,
        ageGroup: swimmer.ageGroup,
        finalTime,
        status,
        timingMethod: r.timingMethod || (finalTime > 0 ? 'T1' : undefined),
        qualifyingTime: qt?.time,
        isQualified,
        recordedAt: r.recordedAt,
        isOutdatedFinals: rStage === 'Finals' && outdated
      });
    }

    // Sort by final time (valid finishes first, NT/DNS/DNF/DQ at bottom)
    rows.sort((a, b) => {
      const aValid = a.status === 'OK' && a.finalTime > 0;
      const bValid = b.status === 'OK' && b.finalTime > 0;

      if (!aValid && bValid) return 1;
      if (aValid && !bValid) return -1;
      if (!aValid && !bValid) return a.laneNumber - b.laneNumber;
      return a.finalTime - b.finalTime;
    });

    // Assign ranks (excluding DQs, DNSs, NT etc.)
    let currentRank = 1;
    const rankedRows: ResultRow[] = rows.map((row) => {
      const isValid = row.status === 'OK' && row.finalTime > 0;
      return {
        ...row,
        rank: isValid ? currentRank++ : 999
      };
    });

    setLeaderboard(rankedRows);
  };

  const showNotice = (title: string, message: string) => {
    setNoticeState({ isOpen: true, title, message });
  };

  // Single Result Delete trigger
  const promptDeleteSingleResult = (resultId?: number) => {
    if (!resultId) return;
    setDeleteConfirmState({
      isOpen: true,
      ids: [resultId],
      title: 'Delete Result',
      message: 'Are you sure you want to delete this result?'
    });
  };

  // Multiple Results Delete trigger
  const promptDeleteSelectedResults = () => {
    if (selectedResultIds.length === 0) return;
    setDeleteConfirmState({
      isOpen: true,
      ids: selectedResultIds,
      title: 'Delete Selected Results',
      message: `Are you sure you want to delete ${selectedResultIds.length} selected result(s)?`
    });
  };

  // Confirm delete handler (for single or multiple)
  const handleConfirmDelete = async () => {
    const ids = deleteConfirmState.ids;
    setDeleteConfirmState({ isOpen: false, ids: [], title: '', message: '' });

    for (const id of ids) {
      await db.results.delete(id);
    }
    
    setSelectedResultIds(prev => prev.filter(id => !ids.includes(id)));
    if (selectedEventId) {
      loadLeaderboard(selectedEventId, selectedStage);
    }
  };

  const handleDeleteOutdatedFinals = async () => {
    if (!selectedEventId) return;
    const finalsResults = await db.results
      .where('eventId')
      .equals(selectedEventId)
      .filter(r => r.stage === 'Finals')
      .toArray();

    for (const r of finalsResults) {
      if (r.id) await db.results.delete(r.id);
    }
    if (selectedEventId) {
      loadLeaderboard(selectedEventId, selectedStage);
    }
  };

  const formatSecondsToTime = (totalSecs: number): string => {
    if (isNaN(totalSecs) || totalSecs <= 0) return '--:--.--';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    
    if (mins > 0) {
      return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    return secs.toFixed(2).padStart(5, '0');
  };

  const handleClearResults = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClearResults = async () => {
    setShowClearConfirm(false);
    if (selectedEventId) {
      const results = await db.results.where('eventId').equals(selectedEventId).toArray();
      const targetResults = selectedStage === 'All'
        ? results
        : results.filter(r => (r.stage || 'Heats') === selectedStage);

      for (const r of targetResults) {
        if (r.id) await db.results.delete(r.id);
      }
      setSelectedResultIds([]);
      setLeaderboard([]);
      setIsFinalsOutdated(false);
      await loadLeaderboard(selectedEventId, selectedStage);
      window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
    } else {
      await db.results.clear();
      setSelectedResultIds([]);
      setLeaderboard([]);
      setIsFinalsOutdated(false);
    }
    showNotice('Results Cleared', 'Timing results have been successfully cleared.');
  };

  // Checkbox toggle helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResultIds(leaderboard.map(r => r.id!).filter(Boolean));
    } else {
      setSelectedResultIds([]);
    }
  };

  const handleToggleRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedResultIds(prev => [...prev, id]);
    } else {
      setSelectedResultIds(prev => prev.filter(item => item !== id));
    }
  };

  const getTargetRows = () => {
    if (selectedResultIds.length > 0) {
      return leaderboard.filter(r => r.id && selectedResultIds.includes(r.id));
    }
    return leaderboard;
  };

  const exportToCSV = () => {
    const targetRows = getTargetRows();
    if (targetRows.length === 0) {
      showNotice('No Results', 'No results available to export.');
      return;
    }

    if (isFinalsOutdated && (selectedStage === 'Finals' || selectedStage === 'All')) {
      showNotice('Invalid Finals Result', 'Finals results are invalidated because a preliminary heat was run after finals were recorded. Please delete outdated finals and re-run finals.');
      return;
    }

    const eventDesc = events.find(e => e.id === selectedEventId);
    const eventName = eventDesc 
      ? `${eventDesc.distance}m_${eventDesc.stroke}_${eventDesc.gender === 'M' ? 'Men' : 'Women'}_${eventDesc.ageGroup.replace(' ', '_')}`
      : 'results';

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Rank,Heat,Lane,Swimmer Name,District,Age Group,Final Time,Timing Method,Status,Qualifying Time,National Qualified?\n';

    targetRows.forEach(r => {
      const qTimeStr = r.qualifyingTime ? r.qualifyingTime.toFixed(2) : 'N/A';
      const finalTimeStr = r.status === 'OK' ? r.finalTime.toFixed(2) : r.status;
      const methodStr = r.status === 'OK' && r.finalTime > 0 ? (r.timingMethod || 'T1') : 'N/A';
      const rowStr = `${r.rank === 999 ? 'N/A' : r.rank},${r.heatNumber},${r.laneNumber},"${r.swimmerName.replace(/"/g, '""')}","${r.club.replace(/"/g, '""')}",${r.ageGroup},${finalTimeStr},${methodStr},${r.status},${qTimeStr},${r.isQualified ? 'YES' : 'NO'}\n`;
      csvContent += rowStr;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${eventName}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPDF = () => {
    const targetRows = getTargetRows();
    if (targetRows.length === 0) {
      showNotice('No Results', 'No results available to print.');
      return;
    }

    if (isFinalsOutdated && (selectedStage === 'Finals' || selectedStage === 'All')) {
      showNotice('Invalid Finals Result', 'Finals results are invalidated because a preliminary heat was run after finals were recorded. Please delete outdated finals and re-run finals.');
      return;
    }

    const eventDesc = events.find(e => e.id === selectedEventId);
    const meetDesc = meets.find(m => m.id === selectedMeetId);
    const eventNameStr = eventDesc 
      ? `${eventDesc.distance}m ${eventDesc.stroke} - ${eventDesc.gender === 'M' ? 'Men' : 'Women'} (${eventDesc.ageGroup})`
      : 'Race Results';
    const meetNameStr = meetDesc ? meetDesc.name : 'Swim Meet';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotice('Pop-up Blocker Active', 'Pop-up blocker is preventing opening the print preview window.');
      return;
    }

    const tableRowsHtml = targetRows.map(r => {
      const isRanked = r.rank !== 999;
      let badgeHtml = '';
      if (r.status !== 'OK') {
        badgeHtml = `<span class="badge badge-dq">${r.status}</span>`;
      } else if (r.qualifyingTime) {
        badgeHtml = r.isQualified 
          ? '<span class="badge badge-qualified">Qualified</span>'
          : `<span class="badge badge-not">+${(r.finalTime - r.qualifyingTime).toFixed(2)}s</span>`;
      } else {
        badgeHtml = '<span class="badge badge-not">Finished</span>';
      }

      const methodBadge = r.status === 'OK' && r.finalTime > 0 
        ? `<span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11px; background: ${r.timingMethod === 'T2' ? '#fef3c7' : '#ecfeff'}; color: ${r.timingMethod === 'T2' ? '#b45309' : '#0891b2'}; border: 1px solid ${r.timingMethod === 'T2' ? '#fde68a' : '#a5f3fc'};">${r.timingMethod || 'T1'}</span>`
        : '--';

      return `
        <tr>
          <td class="rank-col">${isRanked ? '#' + r.rank : '--'}</td>
          <td class="heat-col">H${r.heatNumber}</td>
          <td class="lane-col">L${r.laneNumber}</td>
          <td><strong>${r.swimmerName}</strong></td>
          <td>${r.club}</td>
          <td>${r.ageGroup}</td>
          <td class="time-col">${r.status === 'OK' ? formatSecondsToTime(r.finalTime) : r.status}</td>
          <td style="text-align: center;">${methodBadge}</td>
          <td class="status-col">${badgeHtml}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Official Results - ${eventNameStr}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 25px; }
            .header h1 { font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: -0.01em; }
            .header h2 { font-size: 16px; font-weight: 600; color: #475569; margin: 5px 0 0 0; }
            .meta-info { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-top: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th { background-color: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 10px; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .rank-col { font-weight: bold; text-align: center; width: 50px; }
            .heat-col, .lane-col { text-align: center; width: 60px; }
            .time-col { text-align: right; font-weight: bold; width: 100px; font-family: monospace; font-size: 14px; }
            .status-col { text-align: center; width: 100px; }
            .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; }
            .badge-qualified { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
            .badge-not { background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            .badge-dq { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            @media print {
              body { padding: 0; }
              @page { size: auto; margin: 20mm; }
            }
          </style>
        </head>
        <body>
          <div class="header" style="position: relative;">
            <img src="${window.location.origin}/logo.png" style="position: absolute; right: 0; top: 0; height: 52px; width: 52px; border-radius: 8px; border: 1px solid #cbd5e1; background-color: #000; padding: 1px;" />
            <div style="padding-right: 70px;">
              <h1>${meetNameStr}</h1>
              <h2>${eventNameStr}</h2>
            </div>
            <div class="meta-info">
              <span>Date & Time: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Official Swimming Results</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="rank-col">Rank</th>
                <th class="heat-col">Heat</th>
                <th class="lane-col">Lane</th>
                <th>Swimmer Name</th>
                <th>District</th>
                <th>Age Group</th>
                <th class="time-col">Final Time</th>
                <th style="text-align: center;">Method</th>
                <th class="status-col">QT Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <!-- Signature Image positioned at bottom-right corner -->
          <div style="position: fixed; bottom: 2mm; right: 4mm; text-align: right; z-index: 9999;">
            <img src="${window.location.origin}/signature.png" style="max-height: 25px; width: auto;" />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try { printWindow.print(); } catch (e) {}
    }, 250);
  };

  const isAllSelected = leaderboard.length > 0 && selectedResultIds.length === leaderboard.length;

  return (
    <div className="glass-card">
      <div className="card-header flex justify-between items-center mb-4">
        <div>
          <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            Results & Standings
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Browse overall event rankings, check qualification tallies, and export reports.
          </p>
        </div>
        
        {/* Top Action Bar */}
        <div className="flex gap-2 items-center">
          <button 
            className="btn btn-primary" 
            onClick={printPDF} 
            disabled={leaderboard.length === 0} 
            style={{ backgroundColor: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' }}
          >
            <Printer size={16} /> {selectedResultIds.length > 0 ? `Print Selected (${selectedResultIds.length})` : 'Print PDF Report'}
          </button>
          
          <button 
            className="btn btn-cyan" 
            onClick={exportToCSV} 
            disabled={leaderboard.length === 0}
          >
            <Download size={16} /> {selectedResultIds.length > 0 ? `Export Selected (${selectedResultIds.length})` : 'Export to XL SHEET'}
          </button>
          
          {selectedResultIds.length > 0 ? (
            <button 
              className="btn btn-secondary" 
              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.15)' }} 
              onClick={promptDeleteSelectedResults}
            >
              <Trash2 size={16} /> Delete Selected ({selectedResultIds.length})
            </button>
          ) : (
            <button 
              className="btn btn-secondary" 
              style={{ color: 'var(--accent-red)' }} 
              onClick={handleClearResults}
            >
              <Trash2 size={16} /> Clear Results
            </button>
          )}
        </div>
      </div>

      {/* Outdated Finals Banner Alert */}
      {isFinalsOutdated && (
        <div 
          className="flex justify-between items-center p-4 mt-4" 
          style={{ 
            background: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid rgba(239, 68, 68, 0.4)', 
            borderRadius: '10px', 
            color: '#f87171' 
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#f87171' }}>
                INVALIDATED FINALS RESULT — Heat #{latestHeatNumAfterFinals} recorded after Finals
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
                A preliminary heat was recorded after the finals race was completed. The saved finals results are outdated and no longer valid. PDF printing and CSV export are disabled for invalid finals.
              </p>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
              color: '#f87171', 
              borderColor: 'rgba(239, 68, 68, 0.5)',
              whiteSpace: 'nowrap',
              fontSize: '0.85rem'
            }}
            onClick={handleDeleteOutdatedFinals}
          >
            <Trash2 size={15} /> Delete Outdated Finals
          </button>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="qt-filters mt-4">
        <div className="form-group mb-0" style={{ flex: 1 }}>
          <label className="form-label">Meet</label>
          <CustomSelect
            options={meets.map(m => ({ value: m.id!, label: m.name }))}
            value={selectedMeetId || ''}
            placeholder="Select a Swim Meet"
            onChange={(val) => setSelectedMeetId(Number(val))}
          />
        </div>

        <div className="form-group mb-0" style={{ flex: 2 }}>
          <label className="form-label">Event</label>
          <CustomSelect
            options={events.map(ev => ({
              value: ev.id!,
              label: `${ev.distance}m ${ev.stroke} - ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})`
            }))}
            value={selectedEventId || ''}
            placeholder="No events available"
            onChange={(val) => setSelectedEventId(Number(val))}
          />
        </div>

        <div className="form-group mb-0" style={{ flex: 1 }}>
          <label className="form-label">Stage</label>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Stages (Heats & Finals)' },
              { value: 'Heats', label: 'Heats Only' },
              { value: 'Finals', label: 'Finals Only' }
            ]}
            value={selectedStage}
            onChange={(val) => setSelectedStage(val as 'All' | 'Heats' | 'Finals')}
          />
        </div>
      </div>

      {/* Rankings Leaderboard Table */}
      <div className="data-table-container mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  disabled={leaderboard.length === 0}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                />
              </th>
              <th style={{ width: '70px', textAlign: 'center' }}>Rank</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Heat</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Lane</th>
              <th>Swimmer Name</th>
              <th>District</th>
              <th>Age Group</th>
              <th style={{ textAlign: 'right' }}>Final Time</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Method</th>
              <th style={{ width: '150px', textAlign: 'center' }}>National Status</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center" style={{ color: 'var(--text-muted)', padding: '3rem 2rem' }}>
                  No timing results recorded for this event yet. Complete a heat on the scoreboard and save results.
                </td>
              </tr>
            ) : (
              leaderboard.map(row => {
                const isRanked = row.rank !== 999;
                const isOutdated = row.isOutdatedFinals;
                const isRowChecked = row.id ? selectedResultIds.includes(row.id) : false;
                
                return (
                  <tr 
                    key={row.id || `${row.heatNumber}-${row.laneNumber}`}
                    style={{
                      background: isRowChecked
                        ? 'rgba(6, 182, 212, 0.12)'
                        : isOutdated
                        ? 'rgba(239, 68, 68, 0.12)'
                        : undefined,
                      opacity: isOutdated && !isRowChecked ? 0.7 : 1
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isRowChecked}
                        onChange={(e) => row.id && handleToggleRow(row.id, e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: isOutdated ? 'var(--accent-red)' : (row.rank === 1 ? 'var(--accent-amber)' : 'var(--text-muted)') }}>
                      {isOutdated ? 'INVALID' : (isRanked ? `#${row.rank}` : (row.status === 'NT' ? 'NT' : '--'))}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {row.stage === 'Finals' ? (
                        <span className="pill-info" style={{ borderColor: isOutdated ? 'var(--accent-red)' : 'var(--accent-amber)', color: isOutdated ? 'var(--accent-red)' : 'var(--accent-amber)', fontSize: '0.7rem' }}>
                          {isOutdated ? 'Finals (Outdated)' : 'Finals'}
                        </span>
                      ) : (
                        `H${row.heatNumber}`
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>L{row.laneNumber}</td>
                    <td style={{ fontWeight: 600 }}>{row.swimmerName}</td>
                    <td>{row.club}</td>
                    <td>
                      <span className="pill-info">{row.ageGroup}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {row.status === 'OK' && row.finalTime > 0 ? (
                        <span className="text-green">{formatSecondsToTime(row.finalTime)}</span>
                      ) : row.status === 'NT' ? (
                        <span className="pill-info" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 700 }}>
                          NO TOUCH
                        </span>
                      ) : (
                        <span className="text-red">{row.status}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.status === 'OK' && row.finalTime > 0 ? (
                        <span className="pill-info" style={{ borderColor: row.timingMethod === 'T2' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(6, 182, 212, 0.4)', color: row.timingMethod === 'T2' ? 'var(--accent-amber)' : 'var(--accent-cyan)', backgroundColor: row.timingMethod === 'T2' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)', padding: '0.15rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}>
                          {row.timingMethod || 'T1'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.status === 'OK' && row.finalTime > 0 ? (
                        row.qualifyingTime ? (
                          row.isQualified ? (
                            <span className="badge-qt qualified" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                              Qualified
                            </span>
                          ) : (
                            <span className="badge-qt not-qualified" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                              +{ (row.finalTime - row.qualifyingTime).toFixed(2) }s
                            </span>
                          )
                        ) : (
                          <span style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', letterSpacing: '0.03em' }}>N/A</span>
                        )
                      ) : row.status === 'NT' ? (
                        <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>NO TOUCH</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          color: 'var(--accent-red)', 
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          fontSize: '0.75rem'
                        }}
                        title="Delete single result"
                        onClick={() => promptDeleteSingleResult(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {leaderboard.length > 0 && leaderboard.some(l => l.qualifyingTime) && (
        <div className="flex items-center gap-2 mt-4 p-3" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
          <Award size={18} className="text-green" />
          <span style={{ color: 'var(--text-secondary)' }}>
            Total of <strong className="text-green">{leaderboard.filter(l => l.isQualified).length} swimmer(s)</strong> achieved the National Qualifying Standard in this event!
          </span>
        </div>
      )}

      {/* Custom Confirmation Modal for Single or Multiple Result Deletion */}
      <ConfirmationModal
        isOpen={deleteConfirmState.isOpen}
        title={deleteConfirmState.title}
        message={deleteConfirmState.message}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmState({ isOpen: false, ids: [], title: '', message: '' })}
      />

      {/* Custom Confirmation Modal for Clear All Results */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        title="Clear All Results"
        message="CAUTION: This will delete ALL race results from the database. This action cannot be undone! Are you sure?"
        confirmText="Clear Results"
        cancelText="Cancel"
        onConfirm={handleConfirmClearResults}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Custom Notice Modal replacing browser alert(...) */}
      <NoticeModal
        isOpen={noticeState.isOpen}
        title={noticeState.title}
        message={noticeState.message}
        onClose={() => setNoticeState({ isOpen: false, title: '', message: '' })}
      />
    </div>
  );
}
