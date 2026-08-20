import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, Event, Result, Swimmer, QualifyingTime } from '../db';
import { Award, Download, Trash2, Filter, Printer, AlertTriangle, FileText, ChevronDown, ChevronRight, Layers, Sparkles, RefreshCw, CheckSquare, Square, Search, CheckCircle2, Sliders } from 'lucide-react';
import CustomSelect from './CustomSelect';
import ConfirmationModal from './ConfirmationModal';
import { useModalClose } from '../hooks/useModalClose';
import { LOGO_BASE64 } from '../utils/logoBase64';
import { TSA_LOGO_BASE64, SAT_LOGO_BASE64 } from '../utils/reportLogos';
import { printHtmlDocument } from '../utils/printHelper';

interface ResultRow {
  id?: number;
  eventId?: number;
  eventName?: string;
  rank: number;
  stage?: 'Heats' | 'Finals';
  laneNumber: number;
  heatNumber: number;
  swimmerName: string;
  club: string;
  ageGroup: string;
  gender?: 'M' | 'F';
  t1Time?: number;
  t2Time?: number;
  finalTime: number;
  status: string;
  timingMethod?: 'T1' | 'T2';
  qualifyingTime?: number;
  isQualified: boolean;
  recordedAt?: number;
  isOutdatedFinals?: boolean;
}

interface AgeGroupSection {
  ageGroup: string;
  gender: 'M' | 'F';
  rows: ResultRow[];
}

interface HeatResults {
  heatNumber: number;
  stage: 'Heats' | 'Finals';
  swimmerCount: number;
  ageGroups: AgeGroupSection[];
}

interface EventTreeData {
  event: Event;
  eventName: string;
  totalSwimmers: number;
  heats: HeatResults[];
  finals?: HeatResults;
  isFinalsOutdated?: boolean;
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

function formatSecondsToTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toFixed(2).padStart(5, '0');
  return `${minsStr}:${secsStr}`;
}

const AGE_GROUP_ORDER = [
  '18-24', '25-29', '30-34', '35-39', '40-44', '45-49',
  '50-54', '55-59', '60-64', '65-69', '70-74', '75-79',
  '80+', '80-84', '85-89', '90+'
];

function getAgeGroupSortWeight(ag: string): number {
  const clean = (ag || '').trim();
  const idx = AGE_GROUP_ORDER.indexOf(clean);
  if (idx !== -1) return idx;
  const match = clean.match(/^(\d+)/);
  if (match) return Number(match[1]);
  return 999;
}

interface ResultsExportProps {
  activeMeetId?: number | null;
  activeEventId?: number | null;
}

export default function ResultsExport({ activeMeetId, activeEventId }: ResultsExportProps) {
  const [meets, setMeets] = useState<Meet[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(activeMeetId || null);

  useEffect(() => {
    if (activeMeetId) setSelectedMeetId(activeMeetId);
  }, [activeMeetId]);

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(-1);
  const [selectedEventIdsForPrint, setSelectedEventIdsForPrint] = useState<number[]>([]);
  const [eventsWithResultsCount, setEventsWithResultsCount] = useState<Map<number, number>>(new Map());
  const [selectedStage, setSelectedStage] = useState<'All' | 'Heats' | 'Finals'>('All');
  const [selectedHeatFilter, setSelectedHeatFilter] = useState<'All' | number>('All');
  const [showT1T2, setShowT1T2] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [eventTrees, setEventTrees] = useState<EventTreeData[]>([]);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [printedEventIds, setPrintedEventIds] = useState<Set<number>>(new Set());

  // Load printed event IDs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('touchteck_printed_events');
      if (saved) {
        try {
          setPrintedEventIds(new Set(JSON.parse(saved).map(Number)));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const handleMarkPrinted = () => {
    if (selectedEventIdsForPrint.length === 0) return;
    const next = new Set(printedEventIds);
    selectedEventIdsForPrint.forEach(id => next.add(id));
    setPrintedEventIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_printed_events', JSON.stringify(Array.from(next)));
    }
    showNotice('Events Marked as Printed', `Successfully marked ${selectedEventIdsForPrint.length} event(s) as printed.`);
  };

  // Expanded card state tracking
  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(new Set());
  const [expandedHeatKeys, setExpandedHeatKeys] = useState<Set<string>>(new Set());

  // Deletion modals
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // General notice modal
  const [notice, setNotice] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showNotice = (title: string, message: string) => {
    setNotice({ isOpen: true, title, message });
  };

  useEffect(() => {
    db.meets.toArray().then(mList => {
      setMeets(mList);
      if (!selectedMeetId && mList.length > 0) {
        setSelectedMeetId(mList[0].id!);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedMeetId) {
      db.events.where('meetId').equals(selectedMeetId).toArray().then(eList => {
        eList.sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));
        setEvents(eList);
        setSelectedEventIdsForPrint([]);
      });
    } else {
      setEvents([]);
      setSelectedEventIdsForPrint([]);
    }
  }, [selectedMeetId]);

  useEffect(() => {
    loadResultsTree();
  }, [selectedMeetId, selectedEventId, selectedStage, selectedHeatFilter, searchQuery, events]);

  const loadResultsTree = async () => {
    if (!selectedMeetId || events.length === 0) {
      setEventTrees([]);
      return;
    }

    let targetEvents: Event[] = [];
    if (selectedEventId && selectedEventId !== -1) {
      const ev = events.find(e => e.id === selectedEventId);
      if (ev) targetEvents = [ev];
    } else {
      targetEvents = [...events];
    }

    const countsMap = new Map<number, number>();
    const trees: EventTreeData[] = [];
    const searchLower = searchQuery.toLowerCase().trim();

    for (const ev of targetEvents) {
      const evId = ev.id!;
      const evName = `Event #${ev.eventNo || evId}: ${ev.distance}m ${ev.stroke} - ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})`;
      
      const allEvResults = await db.results.where('eventId').equals(evId).toArray();
      countsMap.set(evId, allEvResults.length);

      if (allEvResults.length === 0) continue;

      const heatsResults = allEvResults.filter(r => (r.stage || 'Heats') === 'Heats');
      const finalsResults = allEvResults.filter(r => r.stage === 'Finals');

      const maxHeatsTimestamp = heatsResults.length > 0 ? Math.max(...heatsResults.map(r => r.recordedAt || 0)) : 0;
      const maxFinalsTimestamp = finalsResults.length > 0 ? Math.max(...finalsResults.map(r => r.recordedAt || 0)) : 0;
      const isFinalsOutdated = finalsResults.length > 0 && maxHeatsTimestamp > maxFinalsTimestamp;

      // Map result records into enriched ResultRow objects
      const rows: ResultRow[] = [];
      for (const r of allEvResults) {
        let swimmer = r.swimmerId ? await db.swimmers.get(r.swimmerId) : undefined;
        const swimmerName = swimmer ? swimmer.name : (r.swimmerName || `Lane ${r.laneNumber} Swimmer`);
        const club = swimmer ? swimmer.club : (r.club || 'Unassigned');
        const ageGroup = swimmer ? swimmer.ageGroup : (r.ageGroup || ev.ageGroup || 'General');

        if (searchLower) {
          const matchName = swimmerName.toLowerCase().includes(searchLower);
          const matchClub = club.toLowerCase().includes(searchLower);
          const matchAg = ageGroup.toLowerCase().includes(searchLower);
          const matchHeat = `heat ${r.heatNumber}`.includes(searchLower) || `h${r.heatNumber}`.includes(searchLower);
          const matchEv = evName.toLowerCase().includes(searchLower);
          if (!matchName && !matchClub && !matchAg && !matchHeat && !matchEv) continue;
        }

        if (selectedStage !== 'All' && (r.stage || 'Heats') !== selectedStage) continue;
        if (selectedHeatFilter !== 'All' && r.heatNumber !== Number(selectedHeatFilter)) continue;

        // Robust lookup for qualifying standard
        const qt = await db.qualifyingTimes
          .filter(q => 
            q.distance === ev.distance &&
            q.stroke === ev.stroke &&
            q.gender === (swimmer?.gender || ev.gender || 'M') &&
            (
              q.ageGroup === ageGroup || 
              q.ageGroup === ev.ageGroup || 
              q.ageGroup === 'All Age Groups' || 
              q.ageGroup === 'General' || 
              q.ageGroup === 'Group A' ||
              !q.ageGroup
            ) &&
            (!ev.meetId || !q.meetId || q.meetId === ev.meetId)
          )
          .first() || await db.qualifyingTimes
          .filter(q => 
            q.distance === ev.distance &&
            q.stroke === ev.stroke &&
            q.gender === (swimmer?.gender || ev.gender || 'M') &&
            (!ev.meetId || !q.meetId || q.meetId === ev.meetId)
          )
          .first() || await db.qualifyingTimes
          .filter(q => 
            q.distance === ev.distance &&
            q.stroke === ev.stroke &&
            q.gender === (swimmer?.gender || ev.gender || 'M')
          )
          .first();

        const finalTime = r.finalTime || 0;
        const rawStatus = r.status || 'OK';
        const status = (rawStatus === 'OK' && finalTime <= 0) ? 'NT' : rawStatus;
        const isQualified = (status === 'OK' && finalTime > 0 && qt && qt.time > 0) ? finalTime <= qt.time : false;
        const rStage = r.stage || 'Heats';

        rows.push({
          id: r.id,
          eventId: evId,
          eventName: evName,
          rank: 999,
          stage: rStage,
          laneNumber: r.laneNumber,
          heatNumber: r.heatNumber,
          swimmerName,
          club,
          ageGroup,
          gender: (swimmer?.gender || ev.gender || 'M') as 'M' | 'F',
          t1Time: r.t1Time || (r.timingMethod === 'T1' ? r.finalTime : undefined),
          t2Time: r.t2Time || (r.timingMethod === 'T2' ? r.finalTime : undefined),
          finalTime,
          status,
          timingMethod: r.timingMethod || (finalTime > 0 ? 'T1' : undefined),
          qualifyingTime: qt?.time,
          isQualified,
          recordedAt: r.recordedAt,
          isOutdatedFinals: rStage === 'Finals' && isFinalsOutdated
        });
      }

      if (rows.length === 0) continue;

      // Group rows into Heats vs Finals
      const heatMap = new Map<number, ResultRow[]>();
      const finalsRows: ResultRow[] = [];

      rows.forEach(r => {
        if (r.stage === 'Finals') {
          finalsRows.push(r);
        } else {
          const hNum = r.heatNumber || 1;
          if (!heatMap.has(hNum)) heatMap.set(hNum, []);
          heatMap.get(hNum)!.push(r);
        }
      });

      // Helper to process a set of rows into sorted AgeGroupSections with ranks #1, #2, #3
      const processAgeGroupSections = (inputRows: ResultRow[]): AgeGroupSection[] => {
        const agMap = new Map<string, ResultRow[]>();
        inputRows.forEach(r => {
          const key = r.ageGroup || 'General';
          if (!agMap.has(key)) agMap.set(key, []);
          agMap.get(key)!.push(r);
        });

        const sortedSections: AgeGroupSection[] = [];
        const sortedAgKeys = Array.from(agMap.keys()).sort((a, b) => getAgeGroupSortWeight(a) - getAgeGroupSortWeight(b));

        for (const agKey of sortedAgKeys) {
          const groupRows = agMap.get(agKey)!;
          groupRows.sort((a, b) => {
            const aValid = a.status === 'OK' && a.finalTime > 0;
            const bValid = b.status === 'OK' && b.finalTime > 0;
            if (!aValid && bValid) return 1;
            if (aValid && !bValid) return -1;
            if (!aValid && !bValid) return a.laneNumber - b.laneNumber;
            return a.finalTime - b.finalTime;
          });

          let currentRank = 1;
          const rankedGroupRows = groupRows.map(r => {
            const isValid = r.status === 'OK' && r.finalTime > 0;
            return {
              ...r,
              rank: isValid ? currentRank++ : 999
            };
          });

          sortedSections.push({
            ageGroup: agKey,
            gender: ev.gender,
            rows: rankedGroupRows
          });
        }
        return sortedSections;
      };

      const sortedHeatNums = Array.from(heatMap.keys()).sort((a, b) => a - b);
      const heatsData: HeatResults[] = sortedHeatNums.map(hNum => {
        const hRows = heatMap.get(hNum)!;
        return {
          heatNumber: hNum,
          stage: 'Heats',
          swimmerCount: hRows.length,
          ageGroups: processAgeGroupSections(hRows)
        };
      });

      let finalsData: HeatResults | undefined = undefined;
      if (finalsRows.length > 0) {
        finalsData = {
          heatNumber: 1,
          stage: 'Finals',
          swimmerCount: finalsRows.length,
          ageGroups: processAgeGroupSections(finalsRows)
        };
      }

      trees.push({
        event: ev,
        eventName: evName,
        totalSwimmers: rows.length,
        heats: heatsData,
        finals: finalsData,
        isFinalsOutdated
      });
    }

    setEventsWithResultsCount(countsMap);
    setEventTrees(trees);
    // Events and heats remain collapsed by default for a clean overview
  };

  // Expand / Collapse Helpers
  const toggleEventExpand = (eventId: number) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const toggleHeatExpand = (heatKey: string) => {
    setExpandedHeatKeys(prev => {
      const next = new Set(prev);
      if (next.has(heatKey)) next.delete(heatKey);
      else next.add(heatKey);
      return next;
    });
  };

  const expandAll = () => {
    const allEv = new Set<number>();
    const allH = new Set<string>();
    eventTrees.forEach(t => {
      allEv.add(t.event.id!);
      t.heats.forEach(h => allH.add(`${t.event.id}-H${h.heatNumber}`));
      if (t.finals) allH.add(`${t.event.id}-FINALS`);
    });
    setExpandedEventIds(allEv);
    setExpandedHeatKeys(allH);
  };

  const collapseAll = () => {
    setExpandedEventIds(new Set());
    setExpandedHeatKeys(new Set());
  };

  // Delete individual result
  const handleDeleteResult = (id?: number) => {
    if (!id) return;
    setDeleteTargetId(id);
  };

  const confirmDeleteResult = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await db.results.delete(deleteTargetId);
      await loadResultsTree();
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Delete error:', err);
      showNotice('Delete Error', 'Failed to delete timing result.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmBatchDeleteResults = async () => {
    if (selectedEventIdsForPrint.length === 0) return;
    setIsBatchDeleting(true);
    try {
      for (const evId of selectedEventIdsForPrint) {
        await db.results.where('eventId').equals(evId).delete();
      }
      const nextPrinted = new Set(printedEventIds);
      selectedEventIdsForPrint.forEach(id => nextPrinted.delete(id));
      setPrintedEventIds(nextPrinted);
      if (typeof window !== 'undefined') {
        localStorage.setItem('touchteck_printed_events', JSON.stringify(Array.from(nextPrinted)));
      }
      await loadResultsTree();
      setShowBatchDeleteConfirm(false);
      showNotice('Results Deleted', `Successfully deleted all timing results for ${selectedEventIdsForPrint.length} selected event(s).`);
    } catch (err) {
      console.error('Batch delete error:', err);
      showNotice('Delete Error', 'Failed to delete timing results for selected events.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const confirmClearAllResults = async () => {
    setIsClearingAll(true);
    try {
      if (selectedMeetId) {
        const evList = await db.events.where('meetId').equals(selectedMeetId).toArray();
        const evIds = evList.map(e => e.id!).filter(Boolean);
        for (const id of evIds) {
          await db.results.where('eventId').equals(id).delete();
        }
      } else {
        await db.results.clear();
      }
      await loadResultsTree();
      setShowClearConfirm(false);
      showNotice('Results Cleared', 'Timing results have been successfully cleared.');
    } catch (err) {
      console.error('Clear results error:', err);
      showNotice('Clear Error', 'Failed to clear timing results.');
    } finally {
      setIsClearingAll(false);
    }
  };

  // ─── PRINT ENGINE HTML GENERATION ──────────────────────────────────────────
  const buildHeatTableHTML = (agSections: AgeGroupSection[], showT1T2Flag: boolean) => {
    let html = '';
    agSections.forEach(ag => {
      const hasAnyQT = ag.rows.some(r => r.qualifyingTime && r.qualifyingTime > 0);

      const rowsHtml = ag.rows.map(r => {
        const isRanked = r.rank !== 999;
        const rankDisplay = r.rank === 1 
          ? `<span style="display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 3px; background: #fef08a; color: #854d0e; font-weight: 900; border: 1px solid #facc15; font-size: 8pt;">1</span>`
          : r.rank === 2
          ? `<span style="display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 3px; background: #f1f5f9; color: #334155; font-weight: 900; border: 1px solid #cbd5e1; font-size: 8pt;">2</span>`
          : r.rank === 3
          ? `<span style="display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 3px; background: #fed7aa; color: #9a3412; font-weight: 900; border: 1px solid #fdba74; font-size: 8pt;">3</span>`
          : (isRanked ? `<span style="font-weight: 700; color: #334155; font-size: 8pt;">${r.rank}</span>` : '--');
        const methodBadge = r.status === 'OK' && r.finalTime > 0 
          ? `<span style="font-weight: 700; padding: 1px 4px; border-radius: 3px; font-size: 8pt; background: ${r.timingMethod === 'T2' ? '#fef3c7' : '#ecfeff'}; color: ${r.timingMethod === 'T2' ? '#b45309' : '#0891b2'}; border: 1px solid ${r.timingMethod === 'T2' ? '#fde68a' : '#a5f3fc'};">${r.timingMethod || 'T1'}</span>`
          : '--';
        const t1Str = r.t1Time ? formatSecondsToTime(r.t1Time) : '--';
        const t2Str = r.t2Time ? formatSecondsToTime(r.t2Time) : '--';
        const cutoffStr = r.qualifyingTime ? formatSecondsToTime(r.qualifyingTime) : '--';
        const qStatusBadge = r.qualifyingTime && r.status === 'OK' && r.finalTime > 0
          ? (r.isQualified 
              ? '<span style="font-weight: 900; color: #16a34a; background: #dcfce7; padding: 1px 5px; border-radius: 3px; border: 1px solid #86efac; font-size: 8pt;">Q</span>' 
              : '<span style="font-weight: 900; color: #dc2626; background: #fee2e2; padding: 1px 5px; border-radius: 3px; border: 1px solid #fca5a5; font-size: 8pt;">NQ</span>')
          : '--';

        return `
          <tr>
            <td style="text-align: center; font-weight: bold;">${rankDisplay}</td>
            <td style="text-align: center; font-size: 8.5pt;">L${r.laneNumber}</td>
            <td><strong style="font-size: 8.5pt;">${r.swimmerName}</strong></td>
            <td style="font-size: 8pt;">${r.club}</td>
            <td style="text-align: center; font-size: 8pt;">${r.ageGroup}</td>
            ${showT1T2Flag ? `<td style="text-align: right; color: #0891b2; font-weight: bold; font-size: 8.5pt;">${t1Str}</td>` : ''}
            ${showT1T2Flag ? `<td style="text-align: right; color: #b45309; font-weight: bold; font-size: 8.5pt;">${t2Str}</td>` : ''}
            <td style="text-align: right; font-weight: bold; color: #0284c7; font-size: 8.5pt;">${r.status === 'OK' ? formatSecondsToTime(r.finalTime) : r.status}</td>
            ${hasAnyQT ? `<td style="text-align: right; color: #64748b; font-weight: 600; font-size: 8pt;">${cutoffStr}</td><td style="text-align: center;">${qStatusBadge}</td>` : ''}
            <td style="text-align: center;">${methodBadge}</td>
          </tr>
        `;
      }).join('');

      html += `
        <div style="margin-top: 10px; margin-bottom: 15px;">
          <div style="font-size: 11px; font-weight: bold; color: #0284c7; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase;">
            CATEGORY / AGE GROUP: ${ag.ageGroup} (${ag.gender === 'M' ? 'Men' : 'Women'})
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">Rank</th>
                <th style="width: 45px; text-align: center;">Lane</th>
                <th>Swimmer Name</th>
                <th>District / Club</th>
                <th style="width: 75px; text-align: center;">Age Group</th>
                ${showT1T2Flag ? '<th style="width: 75px; text-align: right;">T1 (Touchpad)</th>' : ''}
                ${showT1T2Flag ? '<th style="width: 75px; text-align: right;">T2 (Backup)</th>' : ''}
                <th style="width: 90px; text-align: right;">Final Time</th>
                ${hasAnyQT ? '<th style="width: 75px; text-align: right;">Cutoff (QT)</th><th style="width: 50px; text-align: center;">Status</th>' : ''}
                <th style="width: 55px; text-align: center;">Method</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });
    return html;
  };

  const buildOfficialReportHeader = (meetName: string, eventName: string, subTitle?: string, reportType?: string) => `
    <div class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; justify-content: center; width: 105px; flex-shrink: 0;">
        <img src="${TSA_LOGO_BASE64}" width="100" height="100" style="object-fit: contain;" alt="Telangana Swimming Association" />
      </div>

      <div class="title-area" style="flex: 1; text-align: center; padding: 0 15px;">
        <h1 style="font-size: 14.5pt; margin: 0 0 2px 0; color: #0f172a; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px;">${meetName}</h1>
        <h2 style="font-size: 11.5pt; margin: 0 0 2px 0; color: #0284c7; font-weight: 800;">${eventName}</h2>
        ${subTitle ? `<h3 style="font-size: 11pt; margin: 2px 0 0 0; color: #FFE600; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${subTitle}</h3>` : ''}
        <div class="meta" style="font-size: 8pt; color: #64748b; margin-top: 3px; font-weight: 600;">
          ${reportType || 'Official Timing & Results Report'} • Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; width: 120px; flex-shrink: 0;">
        <img src="${SAT_LOGO_BASE64}" width="118" height="118" style="object-fit: contain;" alt="Sports Authority of Telangana" />
      </div>
    </div>
  `;

  const buildOfficialReportFooter = () => `
    <div class="footer-attribution" style="margin-top: 18px; border-top: 1.5px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 40px; page-break-inside: avoid;">
      <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
        <div style="display: flex; flex-direction: column; align-items: center;">
          <img src="${LOGO_BASE64}" width="46" height="46" style="object-fit: contain;" alt="TouchTeck" />
          <div style="font-size: 8.5pt; font-weight: 900; letter-spacing: 1.5px; margin-top: 2px; text-transform: uppercase;">
            <span style="color: #000000;">TOUCH</span><span style="color: #FFE600; font-weight: 900;">TECK</span>
          </div>
        </div>
        <div style="font-size: 8pt; color: #64748b; line-height: 1.35;">
          <div style="font-weight: 700; color: #0f172a; font-size: 8.5pt;">Official Electronic Meet Management</div>
          <div>Certified Results by TouchTeck</div>
        </div>
      </div>

      <div style="display: flex; gap: 40px; margin-left: auto; flex-shrink: 0;">
        <div class="sig-line" style="width: 150px; border-top: 1.5px solid #0f172a; text-align: center; font-size: 8.5pt; font-weight: 700; color: #0f172a; padding-top: 4px;">Meet Official</div>
        <div class="sig-line" style="width: 150px; border-top: 1.5px solid #0f172a; text-align: center; font-size: 8.5pt; font-weight: 700; color: #0f172a; padding-top: 4px;">TouchTeck Official</div>
      </div>
    </div>
  `;

  // 1. PRINT SINGLE HEAT ONLY
  const handlePrintSingleHeat = (ev: Event, heat: HeatResults) => {
    const meetDesc = meets.find(m => m.id === ev.meetId);
    const meetNameStr = meetDesc ? meetDesc.name : '11th Telangana Masters IDSC 2026';
    const eventNameStr = `Event #${ev.eventNo || ev.id}: ${ev.distance}m ${ev.stroke} - ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})`;
    const titleStr = heat.stage === 'Finals' ? 'OFFICIAL FINALS RESULTS' : `OFFICIAL RESULTS — HEAT ${heat.heatNumber}`;

    const tablesHtml = buildHeatTableHTML(heat.ageGroups, showT1T2);

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${titleStr} - ${eventNameStr}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; padding: 12px 18px; line-height: 1.35; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9pt; }
            th { background-color: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8pt; }
            td { padding: 4px 7px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
            @media print {
              body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: portrait; margin: 6mm 8mm; }
            }
          </style>
        </head>
        <body>
          ${buildOfficialReportHeader(meetNameStr, eventNameStr, titleStr, 'Heat-wise Official Timing Report')}

          ${tablesHtml}

          ${buildOfficialReportFooter()}
        </body>
      </html>
    `;

    printHtmlDocument(titleStr, fullHtml);
  };

  // 2. PRINT FULL EVENT RESULTS (All Heats + Finals at End)
  const handlePrintFullEvent = (tree: EventTreeData) => {
    const meetDesc = meets.find(m => m.id === tree.event.meetId);
    const meetNameStr = meetDesc ? meetDesc.name : '11th Telangana Masters IDSC 2026';
    const eventNameStr = tree.eventName;

    let contentHtml = '';

    // Heats first
    tree.heats.forEach(h => {
      contentHtml += `
        <div style="margin-top: 14px; margin-bottom: 16px; page-break-inside: avoid;">
          <div style="background-color: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 6px 12px; border-radius: 3px; font-weight: 800; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">
            HEAT ${h.heatNumber} (${h.swimmerCount} SWIMMERS)
          </div>
          ${buildHeatTableHTML(h.ageGroups, showT1T2)}
        </div>
      `;
    });

    // Finals placed at the VERY END of the heats list for each event!
    if (tree.finals) {
      contentHtml += `
        <div style="margin-top: 18px; margin-bottom: 16px; page-break-inside: avoid; border: 1.5px solid #0284c7; padding: 8px; border-radius: 4px; background: #f0f9ff !important; -webkit-print-color-adjust: exact !important;">
          <div style="background-color: #0284c7 !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 6px 12px; border-radius: 3px; font-weight: 800; font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">
            FINALS RESULTS
          </div>
          ${buildHeatTableHTML(tree.finals.ageGroups, showT1T2)}
        </div>
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${eventNameStr} - Full Event Results</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; padding: 12px 18px; line-height: 1.35; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9pt; }
            th { background-color: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8pt; }
            td { padding: 4px 7px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
            @media print {
              body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: portrait; margin: 6mm 8mm; }
            }
          </style>
        </head>
        <body>
          ${buildOfficialReportHeader(meetNameStr, eventNameStr, 'OFFICIAL EVENT RESULTS & RANKINGS', 'Full Event Official Results Report')}

          ${contentHtml}

          ${buildOfficialReportFooter()}
        </body>
      </html>
    `;

    printHtmlDocument(eventNameStr, fullHtml);
  };

  // 3. PRINT ALL / MULTI-SELECTION CHECKLIST REPORT
  const handlePrintMultiSelection = () => {
    const selectedTrees = eventTrees.filter(t => selectedEventIdsForPrint.includes(t.event.id!));
    if (selectedTrees.length === 0) {
      showNotice('No Events Selected', 'Please check at least one event from the multi-print checklist.');
      return;
    }

    const meetDesc = meets.find(m => m.id === selectedMeetId);
    const meetNameStr = meetDesc ? meetDesc.name : '11th Telangana Masters IDSC 2026';

    let multiHtml = '';

    selectedTrees.forEach((tree, idx) => {
      let eventContentHtml = '';

      tree.heats.forEach(h => {
        eventContentHtml += `
          <div style="margin-top: 12px; margin-bottom: 14px; page-break-inside: avoid;">
            <div style="background-color: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 6px 12px; border-radius: 3px; font-weight: 800; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">
              HEAT ${h.heatNumber} (${h.swimmerCount} SWIMMERS)
            </div>
            ${buildHeatTableHTML(h.ageGroups, showT1T2)}
          </div>
        `;
      });

      if (tree.finals) {
        eventContentHtml += `
          <div style="margin-top: 14px; margin-bottom: 14px; page-break-inside: avoid; border: 1.5px solid #0284c7; padding: 8px; border-radius: 4px; background: #f0f9ff !important; -webkit-print-color-adjust: exact !important;">
            <div style="background-color: #0284c7 !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 6px 12px; border-radius: 3px; font-weight: 800; font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">
              FINALS RESULTS
            </div>
            ${buildHeatTableHTML(tree.finals.ageGroups, showT1T2)}
          </div>
        `;
      }

      multiHtml += `
        <div style="page-break-after: always; ${idx === selectedTrees.length - 1 ? 'page-break-after: auto;' : ''}">
          ${buildOfficialReportHeader(meetNameStr, tree.eventName, 'OFFICIAL CONSOLIDATED RESULTS', 'Championship Results Report')}

          ${eventContentHtml}

          ${buildOfficialReportFooter()}
        </div>
      `;
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${meetNameStr} - Consolidated Results Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; padding: 12px 18px; line-height: 1.35; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9pt; }
            th { background-color: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8pt; }
            td { padding: 4px 7px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
            @media print {
              body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: portrait; margin: 6mm 8mm; }
            }
          </style>
        </head>
        <body>
          ${multiHtml}
        </body>
      </html>
    `;

    printHtmlDocument(meetNameStr, fullHtml);
  };

  return (
    <div style={{ width: '100%' }}>
      <NoticeModal
        isOpen={notice.isOpen}
        title={notice.title}
        message={notice.message}
        onClose={() => setNotice({ isOpen: false, title: '', message: '' })}
      />

      <ConfirmationModal
        isOpen={deleteTargetId !== null}
        title="Delete Timing Result"
        message="Are you sure you want to delete this swimmer result? This action cannot be undone."
        confirmText={isDeleting ? 'Deleting...' : 'Delete Result'}
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteResult}
        onCancel={() => setDeleteTargetId(null)}
      />

      <ConfirmationModal
        isOpen={showBatchDeleteConfirm}
        title="Delete Results Confirmation"
        message={`Are you sure you want to delete all saved timing results for the ${selectedEventIdsForPrint.length} selected event(s)?\n\nThis will permanently remove the results data for these events. This action cannot be undone.`}
        confirmText={isBatchDeleting ? 'Deleting...' : 'Yes, Delete Results'}
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmBatchDeleteResults}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      />

      <ConfirmationModal
        isOpen={showClearConfirm}
        title="Clear All Timing Results"
        message="Are you sure you want to delete ALL timing results for this competition? This will reset official results data."
        confirmText={isClearingAll ? 'Clearing...' : 'Yes, Clear All Results'}
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmClearAllResults}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Header Bar - Clean Centered Title */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2 text-cyan" style={{ fontSize: '1.65rem', letterSpacing: '0.02em', marginBottom: '0.35rem' }}>
          <Award className="w-7 h-7 text-cyan" /> Results & Medalists Management
        </h2>
        <p className="text-sm text-text-secondary" style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          Hierarchical event & heat-wise results grouped by age category with 1-click printable reports.
        </p>
      </div>

      {/* Filters Bar */}
      <div 
        className="glass-card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: '1rem',
          marginBottom: '1.5rem',
          width: '100%'
        }}
      >
        <div className="form-group mb-0" style={{ flex: '1.2 1 180px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>SWIM MEET</label>
          <CustomSelect
            options={meets.map(m => ({ value: m.id!, label: m.name }))}
            value={selectedMeetId || ''}
            onChange={(val) => setSelectedMeetId(Number(val))}
            placeholder="Select Swim Meet..."
          />
        </div>

        <div className="form-group mb-0" style={{ flex: '1.4 1 200px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>SEARCH</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search Swimmer, District, Event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group mb-0" style={{ flex: '1.8 1 240px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>FILTER EVENT</label>
          <CustomSelect
            options={[
              { value: -1, label: `All Events (${events.length} Events)` },
              ...events.map(e => ({
                value: e.id!,
                label: `Event #${e.eventNo || e.id}: ${e.distance}m ${e.stroke} - ${e.gender === 'M' ? 'Men' : 'Women'} (${e.ageGroup})`
              }))
            ]}
            value={selectedEventId || -1}
            onChange={(val) => setSelectedEventId(Number(val))}
          />
        </div>

        <div className="form-group mb-0" style={{ flex: '0.9 1 130px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>STAGE</label>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Stages' },
              { value: 'Heats', label: 'Heats Only' },
              { value: 'Finals', label: 'Finals Only' }
            ]}
            value={selectedStage}
            onChange={(val) => setSelectedStage(val as any)}
          />
        </div>

        <div className="form-group mb-0" style={{ flexShrink: 0, marginLeft: 'auto' }}>
          <button
            type="button"
            className={`btn ${isSelectMode ? 'btn-cyan' : 'btn-secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: isSelectMode ? '#0f172a' : '#06b6d4',
              borderColor: 'rgba(6, 182, 212, 0.5)',
              backgroundColor: isSelectMode ? '#06b6d4' : 'rgba(6, 182, 212, 0.12)',
              fontWeight: 800,
              fontSize: '0.85rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '20px',
              whiteSpace: 'nowrap',
              height: '40px'
            }}
            onClick={() => setIsSelectMode(prev => !prev)}
            title="Toggle batch selection mode"
          >
            <CheckSquare size={16} /> {isSelectMode ? 'Exit Select' : 'Select'}
          </button>
        </div>
      </div>

      {/* Batch Select Operations Control Panel */}
      {isSelectMode && (
        <div 
          className="glass-card mb-5" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1.5px solid rgba(6, 182, 212, 0.5)',
            borderRadius: '14px',
            padding: '0.9rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckSquare size={20} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
                Batch Selection Mode ({selectedEventIdsForPrint.length} Selected)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8' }}
                onClick={() => setSelectedEventIdsForPrint(events.map(e => e.id!))}
              >
                Select All
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderColor: 'rgba(248,113,113,0.4)', color: '#f87171' }}
                onClick={() => setSelectedEventIdsForPrint([])}
              >
                Deselect All
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleMarkPrinted}
              disabled={selectedEventIdsForPrint.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 1rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: '#4ade80',
                borderColor: 'rgba(74, 222, 128, 0.4)',
                backgroundColor: 'rgba(74, 222, 128, 0.1)'
              }}
            >
              <CheckCircle2 size={16} /> Mark Printed ({selectedEventIdsForPrint.length})
            </button>
            <button
              type="button"
              className="btn btn-cyan"
              onClick={handlePrintMultiSelection}
              disabled={selectedEventIdsForPrint.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 1.1rem',
                fontSize: '0.84rem',
                fontWeight: 800
              }}
            >
              <Printer size={16} /> Print Heat Sheet ({selectedEventIdsForPrint.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary text-red hover:bg-red/10"
              onClick={() => setShowBatchDeleteConfirm(true)}
              disabled={selectedEventIdsForPrint.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 1rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)'
              }}
            >
              <Trash2 size={16} /> Delete Results ({selectedEventIdsForPrint.length})
            </button>

            {/* T1 & T2 Backup Times Toggle Button */}
            <button
              type="button"
              className="btn"
              onClick={() => setShowT1T2(prev => !prev)}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 1.15rem',
                fontSize: '0.84rem',
                fontWeight: 800,
                borderRadius: '20px',
                color: showT1T2 ? '#0f172a' : '#38bdf8',
                backgroundColor: showT1T2 ? '#38bdf8' : 'rgba(56, 189, 248, 0.12)',
                borderColor: 'rgba(56, 189, 248, 0.6)',
                borderWidth: '1.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Toggle inclusion of T1 (Touchpad) and T2 (Backup) columns in printed reports"
            >
              <Sliders size={16} /> {showT1T2 ? 'T1 & T2 Columns: ON' : 'T1 & T2 Columns: OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Main Hierarchical Tree View: Event Cards -> Heat Cards -> Age Group Tables */}
      <div className="flex flex-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
        {eventTrees.length === 0 ? (
          <div className="glass-card p-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <Filter size={36} className="mx-auto mb-3 text-cyan opacity-50" />
            <h3 className="text-lg font-bold text-text-primary">No Timing Results Found</h3>
            <p className="text-sm text-text-secondary mt-1">
              {searchQuery ? `No timing records matching "${searchQuery}"` : 'No timing results recorded for this selection. Run a heat on the Operator Desk and save results.'}
            </p>
          </div>
        ) : (
          eventTrees.map(tree => {
            const isEventExpanded = expandedEventIds.has(tree.event.id!);
            const isChecked = selectedEventIdsForPrint.includes(tree.event.id!);

            return (
              <div 
                key={tree.event.id}
                className="glass-card p-0 overflow-hidden"
                style={{
                  boxShadow: isChecked ? '0 0 16px rgba(6, 182, 212, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.25)',
                  borderColor: isChecked ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isChecked ? 'rgba(6, 182, 212, 0.06)' : 'rgba(15, 23, 42, 0.65)',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.5rem'
                }}
              >
                {/* Event Card Header */}
                <div 
                  className="flex flex-wrap items-center justify-between p-4 cursor-pointer select-none"
                  style={{
                    backgroundColor: isChecked 
                      ? 'rgba(6, 182, 212, 0.1)' 
                      : 'transparent',
                    borderBottom: isEventExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
                  }}
                  onClick={() => toggleEventExpand(tree.event.id!)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const next = new Set(selectedEventIdsForPrint);
                    if (next.has(tree.event.id!)) {
                      next.delete(tree.event.id!);
                    } else {
                      next.add(tree.event.id!);
                    }
                    setSelectedEventIdsForPrint(Array.from(next));
                  }}
                  title="Click to expand/collapse. Double-click to select/deselect for batch report."
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox for Print Selection - only in Select mode */}
                    {isSelectMode && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = new Set(selectedEventIdsForPrint);
                          if (next.has(tree.event.id!)) {
                            next.delete(tree.event.id!);
                          } else {
                            next.add(tree.event.id!);
                          }
                          setSelectedEventIdsForPrint(Array.from(next));
                        }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', paddingRight: '0.25rem' }}
                        title={isChecked ? 'Deselect event from print report' : 'Select event for print report'}
                      >
                        {isChecked ? (
                          <CheckSquare size={22} style={{ color: '#06b6d4' }} />
                        ) : (
                          <Square size={22} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                    )}

                    <button 
                      className="p-1 rounded hover:bg-white/10 text-cyan transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEventExpand(tree.event.id!);
                      }}
                    >
                      {isEventExpanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan/20 text-cyan border border-cyan/40">
                          Event #{tree.event.eventNo || tree.event.id}
                        </span>
                        {printedEventIds.has(tree.event.id!) && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-1">
                            <CheckCircle2 size={12} /> PRINTED
                          </span>
                        )}
                        <h3 className="text-base font-bold text-text-primary margin-0">
                          {tree.event.distance}m {tree.event.stroke} - {tree.event.gender === 'M' ? 'Men' : 'Women'} ({tree.event.ageGroup})
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1.5 flex-wrap">
                        <span>{tree.totalSwimmers} Swimmers</span>
                        <span>•</span>
                        <span>{tree.heats.length} Heat{tree.heats.length > 1 ? 's' : ''}</span>
                        {/* Interactive Heat Pills with Results Checkmarks */}
                        <div className="flex items-center gap-2 ml-2">
                          {tree.heats.map(h => {
                            const hasResults = h.ageGroups.some(ag => ag.rows.some(r => r.finalTime > 0));
                            return (
                              <button
                                key={h.heatNumber}
                                type="button"
                                style={{
                                  padding: '0.22rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  border: hasResults ? '1.5px solid rgba(74, 222, 128, 0.6)' : '1.5px solid rgba(245, 158, 11, 0.6)',
                                  backgroundColor: hasResults ? 'rgba(74, 222, 128, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                  color: hasResults ? '#4ade80' : '#fcd34d',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintSingleHeat(tree.event, h);
                                }}
                                title={hasResults ? `Click to print results for Heat ${h.heatNumber}` : `Heat ${h.heatNumber} (No timing results yet)`}
                              >
                                {hasResults && <span style={{ fontWeight: 900 }}>✓</span>}
                                Heat {h.heatNumber}
                              </button>
                            );
                          })}
                        </div>
                        {tree.finals && <span className="text-amber font-bold">• Finals Available</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)' }}
                      onClick={() => handlePrintFullEvent(tree)}
                    >
                      <Printer size={15} /> Print Event Results
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => toggleEventExpand(tree.event.id!)}
                    >
                      {isEventExpanded ? 'Close ▲' : 'View Heats ▼'}
                    </button>
                  </div>
                </div>

                {/* Event Details Content (Clean Direct Heats + Results Table) */}
                {isEventExpanded && (
                  <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
                    {/* Render Heats in Sequential Order (Heat 1, Heat 2, Heat 3...) */}
                    {tree.heats.map(heat => (
                      <div key={heat.heatNumber} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {/* Clean Heat Divider Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.4rem', borderBottom: '1.5px solid rgba(6, 182, 212, 0.3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#38bdf8', letterSpacing: '0.02em' }}>
                              HEAT {heat.heatNumber}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              • {heat.swimmerCount} Swimmer{heat.swimmerCount > 1 ? 's' : ''} in {heat.ageGroups.length} Category{heat.ageGroups.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="btn btn-cyan btn-sm"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '16px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintSingleHeat(tree.event, heat);
                            }}
                          >
                            <Printer size={13} /> Print Heat {heat.heatNumber} Results
                          </button>
                        </div>

                        {/* Age Group Results Tables */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {heat.ageGroups.map(ag => (
                            <div key={ag.ageGroup}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>AGE GROUP: {ag.ageGroup} (${ag.gender === 'M' ? 'Men' : 'Women'})</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{ag.rows.length} Swimmer{ag.rows.length > 1 ? 's' : ''}</span>
                              </div>

                              <div className="overflow-x-auto" style={{ borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <table className="data-table w-full text-xs">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                                      <th style={{ width: '50px', textAlign: 'center' }}>Lane</th>
                                      <th>Swimmer Name</th>
                                      <th>District / Club</th>
                                      <th style={{ width: '80px', textAlign: 'center' }}>Age Group</th>
                                      <th style={{ textAlign: 'right', width: '90px' }}>Final Time</th>
                                      <th style={{ textAlign: 'right', width: '80px' }}>Cutoff</th>
                                      <th style={{ width: '65px', textAlign: 'center' }}>Status</th>
                                      <th style={{ width: '65px', textAlign: 'center' }}>Method</th>
                                      <th style={{ width: '45px', textAlign: 'center' }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ag.rows.map(r => {
                                      const isRanked = r.rank !== 999;
                                      return (
                                        <tr key={r.id || `${r.laneNumber}-${r.swimmerName}`}>
                                          <td style={{ textAlign: 'center', fontWeight: 800, color: r.rank === 1 ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                                            {r.rank === 1 ? '🥇 #1' : (r.rank === 2 ? '🥈 #2' : (r.rank === 3 ? '🥉 #3' : (isRanked ? `#${r.rank}` : '--')))}
                                          </td>
                                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>L{r.laneNumber}</td>
                                          <td className="font-bold text-text-primary">{r.swimmerName}</td>
                                          <td>{r.club}</td>
                                          <td style={{ textAlign: 'center' }}>
                                            <span className="pill-info">{r.ageGroup}</span>
                                          </td>
                                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                            {r.status === 'OK' && r.finalTime > 0 ? (
                                              <span className="text-green">{formatSecondsToTime(r.finalTime)}</span>
                                            ) : (
                                              <span className="text-red">{r.status}</span>
                                            )}
                                          </td>
                                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                            {r.qualifyingTime ? formatSecondsToTime(r.qualifyingTime) : '--'}
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            {r.qualifyingTime && r.status === 'OK' && r.finalTime > 0 ? (
                                              r.isQualified ? (
                                                <span style={{ fontWeight: 800, color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.15)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(74, 222, 128, 0.4)', fontSize: '0.72rem' }}>✓ Q</span>
                                              ) : (
                                                <span style={{ fontWeight: 800, color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.72rem' }}>NQ</span>
                                              )
                                            ) : (
                                              <span style={{ color: 'var(--text-muted)' }}>--</span>
                                            )}
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            {r.status === 'OK' && r.finalTime > 0 ? (
                                              <span className="pill-info" style={{ fontSize: '0.68rem', color: r.timingMethod === 'T2' ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
                                                {r.timingMethod || 'T1'}
                                              </span>
                                            ) : '--'}
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              className="p-1 text-red hover:bg-red/10 rounded transition-colors"
                                              onClick={() => handleDeleteResult(r.id)}
                                              title="Delete Result"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* FINALS RESULTS (At the end of heats for the event) */}
                    {tree.finals && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem', borderTop: '2px solid rgba(234, 179, 8, 0.4)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            🏆 FINALS RESULTS
                          </span>
                          <button
                            type="button"
                            className="btn btn-yellow btn-sm"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '16px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintSingleHeat(tree.event, tree.finals!);
                            }}
                          >
                            <Printer size={13} /> Print Finals Results
                          </button>
                        </div>

                        {tree.finals.ageGroups.map(ag => (
                          <div key={ag.ageGroup} className="overflow-x-auto" style={{ borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                            <table className="data-table w-full text-xs">
                              <thead>
                                <tr>
                                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                                  <th style={{ width: '50px', textAlign: 'center' }}>Lane</th>
                                  <th>Swimmer Name</th>
                                  <th>District / Club</th>
                                  <th style={{ width: '80px', textAlign: 'center' }}>Age Group</th>
                                  <th style={{ textAlign: 'right', width: '90px' }}>Final Time</th>
                                  <th style={{ textAlign: 'right', width: '80px' }}>Cutoff</th>
                                  <th style={{ width: '65px', textAlign: 'center' }}>Status</th>
                                  <th style={{ width: '65px', textAlign: 'center' }}>Method</th>
                                  <th style={{ width: '45px', textAlign: 'center' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ag.rows.map(r => {
                                  const isRanked = r.rank !== 999;
                                  return (
                                    <tr key={r.id || `${r.laneNumber}-${r.swimmerName}`}>
                                      <td style={{ textAlign: 'center', fontWeight: 800, color: r.rank === 1 ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                                        {r.rank === 1 ? '🥇 #1' : (r.rank === 2 ? '🥈 #2' : (r.rank === 3 ? '🥉 #3' : (isRanked ? `#${r.rank}` : '--')))}
                                      </td>
                                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>L{r.laneNumber}</td>
                                      <td className="font-bold text-text-primary">{r.swimmerName}</td>
                                      <td>{r.club}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span className="pill-info">{r.ageGroup}</span>
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                        {r.status === 'OK' && r.finalTime > 0 ? (
                                          <span className="text-green">{formatSecondsToTime(r.finalTime)}</span>
                                        ) : (
                                          <span className="text-red">{r.status}</span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                        {r.qualifyingTime ? formatSecondsToTime(r.qualifyingTime) : '--'}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {r.qualifyingTime && r.status === 'OK' && r.finalTime > 0 ? (
                                          r.isQualified ? (
                                            <span style={{ fontWeight: 800, color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.15)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(74, 222, 128, 0.4)', fontSize: '0.72rem' }}>✓ Q</span>
                                          ) : (
                                            <span style={{ fontWeight: 800, color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.72rem' }}>NQ</span>
                                          )
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {r.status === 'OK' && r.finalTime > 0 ? (
                                          <span className="pill-info" style={{ fontSize: '0.68rem', color: r.timingMethod === 'T2' ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
                                            {r.timingMethod || 'T1'}
                                          </span>
                                        ) : '--'}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <button
                                              type="button"
                                              className="p-1 text-red hover:bg-red/10 rounded transition-colors"
                                              onClick={() => handleDeleteResult(r.id)}
                                              title="Delete Result"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
