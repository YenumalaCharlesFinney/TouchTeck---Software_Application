import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, Event, Result, Swimmer, QualifyingTime } from '../db';
import { Award, Download, Trash2, Filter, Printer, AlertTriangle, FileText, ChevronDown, ChevronRight, Layers, Sparkles, RefreshCw } from 'lucide-react';
import CustomSelect from './CustomSelect';
import ConfirmationModal from './ConfirmationModal';
import { useModalClose } from '../hooks/useModalClose';
import { LOGO_BASE64 } from '../utils/logoBase64';
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

  // Expanded card state tracking
  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(new Set());
  const [expandedHeatKeys, setExpandedHeatKeys] = useState<Set<string>>(new Set());

  // Deletion modals
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
        setSelectedEventIdsForPrint(eList.map(e => e.id!));
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

        const qt = await db.qualifyingTimes
          .where('[distance+stroke+gender+ageGroup]')
          .equals([ev.distance, ev.stroke, ev.gender, ev.ageGroup])
          .and(q => q.meetId === ev.meetId)
          .first();

        const finalTime = r.finalTime || 0;
        const rawStatus = r.status || 'OK';
        const status = (rawStatus === 'OK' && finalTime <= 0) ? 'NT' : rawStatus;
        const isQualified = (status === 'OK' && finalTime > 0 && qt) ? finalTime <= qt.time : false;
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

    // Auto-expand all event cards that have saved results so user sees saved results immediately
    const autoExpandedEvs = new Set<number>();
    const autoExpandedHeats = new Set<string>();
    trees.forEach(t => {
      if (t.event.id) autoExpandedEvs.add(t.event.id);
      t.heats.forEach(h => autoExpandedHeats.add(`${t.event.id}-H${h.heatNumber}`));
      if (t.finals) autoExpandedHeats.add(`${t.event.id}-FINALS`);
    });
    setExpandedEventIds(autoExpandedEvs);
    setExpandedHeatKeys(autoExpandedHeats);
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
      const rowsHtml = ag.rows.map(r => {
        const isRanked = r.rank !== 999;
        const rankDisplay = r.rank === 1 ? '🥇 1' : (r.rank === 2 ? '🥈 2' : (r.rank === 3 ? '🥉 3' : (isRanked ? `#${r.rank}` : '--')));
        const methodBadge = r.status === 'OK' && r.finalTime > 0 
          ? `<span style="font-weight: 700; padding: 2px 5px; border-radius: 3px; font-size: 10px; background: ${r.timingMethod === 'T2' ? '#fef3c7' : '#ecfeff'}; color: ${r.timingMethod === 'T2' ? '#b45309' : '#0891b2'}; border: 1px solid ${r.timingMethod === 'T2' ? '#fde68a' : '#a5f3fc'};">${r.timingMethod || 'T1'}</span>`
          : '--';
        const t1Str = r.t1Time ? formatSecondsToTime(r.t1Time) : '--';
        const t2Str = r.t2Time ? formatSecondsToTime(r.t2Time) : '--';

        return `
          <tr>
            <td style="text-align: center; font-weight: bold;">${rankDisplay}</td>
            <td style="text-align: center;">L${r.laneNumber}</td>
            <td><strong>${r.swimmerName}</strong></td>
            <td>${r.club}</td>
            <td style="text-align: center;">${r.ageGroup}</td>
            ${showT1T2Flag ? `<td style="text-align: right; color: #0891b2; font-weight: bold;">${t1Str}</td>` : ''}
            ${showT1T2Flag ? `<td style="text-align: right; color: #b45309; font-weight: bold;">${t2Str}</td>` : ''}
            <td style="text-align: right; font-weight: bold; color: #0284c7;">${r.status === 'OK' ? formatSecondsToTime(r.finalTime) : r.status}</td>
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
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #0f172a; margin: 0; padding: 20px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
            .title-area h1 { font-size: 16pt; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .title-area h2 { font-size: 13pt; margin: 0 0 4px 0; color: #0284c7; font-weight: 700; }
            .title-area h3 { font-size: 11pt; margin: 0; color: #eab308; font-weight: 800; text-transform: uppercase; }
            .meta { font-size: 9pt; color: #64748b; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
            th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8.5pt; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 9.5pt; color: #475569; font-weight: 600; }
            .sig-line { width: 200px; border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 4px; margin-top: 35px; }
            @media print {
              body { padding: 0; }
              @page { size: portrait; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <h1>${meetNameStr}</h1>
              <h2>${eventNameStr}</h2>
              <h3>${titleStr}</h3>
              <div class="meta">
                Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Heat-wise Official Timing Report
              </div>
            </div>
            <img src="${LOGO_BASE64}" width="60" height="60" style="object-fit: contain;" />
          </div>

          ${tablesHtml}

          <div class="signatures">
            <div class="sig-line">Chief Timekeeper Signature</div>
            <div class="sig-line">Referee Signature</div>
            <div class="sig-line">Meet Director Signature</div>
          </div>
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
        <div style="margin-top: 15px; margin-bottom: 20px; page-break-inside: avoid;">
          <h3 style="font-size: 12pt; background: #0f172a; color: #ffffff; padding: 6px 12px; margin: 0 0 8px 0; border-radius: 4px; font-weight: 800;">
            🔥 HEAT ${h.heatNumber} (${h.swimmerCount} Swimmers)
          </h3>
          ${buildHeatTableHTML(h.ageGroups, showT1T2)}
        </div>
      `;
    });

    // Finals placed at the VERY END of the heats list for each event!
    if (tree.finals) {
      contentHtml += `
        <div style="margin-top: 25px; margin-bottom: 20px; page-break-inside: avoid; border: 2px solid #eab308; padding: 10px; border-radius: 6px; background: #fefce8;">
          <h3 style="font-size: 13pt; background: #ca8a04; color: #ffffff; padding: 8px 12px; margin: 0 0 10px 0; border-radius: 4px; font-weight: 900; text-transform: uppercase;">
            🏆 FINALS RESULTS
          </h3>
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
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #0f172a; margin: 0; padding: 20px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
            .title-area h1 { font-size: 16pt; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .title-area h2 { font-size: 13pt; margin: 0 0 4px 0; color: #0284c7; font-weight: 700; }
            .meta { font-size: 9pt; color: #64748b; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
            th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8.5pt; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 9.5pt; color: #475569; font-weight: 600; }
            .sig-line { width: 200px; border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 4px; margin-top: 35px; }
            @media print {
              body { padding: 0; }
              @page { size: portrait; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <h1>${meetNameStr}</h1>
              <h2>${eventNameStr}</h2>
              <div class="meta">
                Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Official Event Results Report
              </div>
            </div>
            <img src="${LOGO_BASE64}" width="60" height="60" style="object-fit: contain;" />
          </div>

          ${contentHtml}

          <div class="signatures">
            <div class="sig-line">Chief Timekeeper Signature</div>
            <div class="sig-line">Referee Signature</div>
            <div class="sig-line">Meet Director Signature</div>
          </div>
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
          <div style="margin-top: 10px; margin-bottom: 15px; page-break-inside: avoid;">
            <h4 style="font-size: 11pt; background: #0f172a; color: #ffffff; padding: 5px 10px; margin: 0 0 6px 0; border-radius: 3px; font-weight: 700;">
              🔥 HEAT ${h.heatNumber} (${h.swimmerCount} Swimmers)
            </h4>
            ${buildHeatTableHTML(h.ageGroups, showT1T2)}
          </div>
        `;
      });

      if (tree.finals) {
        eventContentHtml += `
          <div style="margin-top: 15px; margin-bottom: 15px; page-break-inside: avoid; border: 1.5px solid #eab308; padding: 8px; border-radius: 5px; background: #fefce8;">
            <h4 style="font-size: 12pt; background: #ca8a04; color: #ffffff; padding: 6px 10px; margin: 0 0 8px 0; border-radius: 3px; font-weight: 800; text-transform: uppercase;">
              🏆 FINALS RESULTS
            </h4>
            ${buildHeatTableHTML(tree.finals.ageGroups, showT1T2)}
          </div>
        `;
      }

      multiHtml += `
        <div style="page-break-after: always; ${idx === selectedTrees.length - 1 ? 'page-break-after: auto;' : ''}">
          <div class="header">
            <div class="title-area">
              <h1>${meetNameStr}</h1>
              <h2>${tree.eventName}</h2>
              <div class="meta">
                Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Official Competition Results
              </div>
            </div>
            <img src="${LOGO_BASE64}" width="55" height="55" style="object-fit: contain;" />
          </div>

          ${eventContentHtml}

          <div class="signatures">
            <div class="sig-line">Chief Timekeeper Signature</div>
            <div class="sig-line">Referee Signature</div>
            <div class="sig-line">Meet Director Signature</div>
          </div>
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
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #0f172a; margin: 0; padding: 20px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
            .title-area h1 { font-size: 15pt; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .title-area h2 { font-size: 12pt; margin: 0 0 4px 0; color: #0284c7; font-weight: 700; }
            .meta { font-size: 8.5pt; color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
            th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #0f172a; text-transform: uppercase; font-size: 8pt; }
            td { padding: 5px 7px; border: 1px solid #cbd5e1; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .signatures { margin-top: 35px; display: flex; justify-content: space-between; font-size: 9pt; color: #475569; font-weight: 600; }
            .sig-line { width: 180px; border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 4px; margin-top: 30px; }
            @media print {
              body { padding: 0; }
              @page { size: portrait; margin: 12mm; }
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
    <div className="card shadow-lg p-6 rounded-xl border border-border bg-card">
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
        isOpen={showClearConfirm}
        title="Clear All Timing Results"
        message="Are you sure you want to delete ALL timing results for this competition? This will reset official results data."
        confirmText={isClearingAll ? 'Clearing...' : 'Yes, Clear All Results'}
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmClearAllResults}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-cyan">
            <Award className="w-6 h-6 text-cyan" /> Results & Medalists Management
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Hierarchical event & heat-wise results grouped by age category with 1-click printable reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={expandAll}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            <Layers size={14} /> Expand All
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={collapseAll}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            Collapse All
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrintMultiSelection}
            disabled={selectedEventIdsForPrint.length === 0}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <Printer size={16} /> Print Selected Reports ({selectedEventIdsForPrint.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary text-red hover:bg-red/10"
            onClick={() => setShowClearConfirm(true)}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card flex flex-wrap gap-4 p-4 items-end mb-6">
        <div className="form-group mb-0" style={{ flex: '2 1 240px' }}>
          <label className="form-label">Swim Meet</label>
          <CustomSelect
            options={meets.map(m => ({ value: m.id!, label: m.name }))}
            value={selectedMeetId || ''}
            onChange={(val) => setSelectedMeetId(Number(val))}
            placeholder="Select Swim Meet..."
          />
        </div>

        <div className="form-group mb-0" style={{ flex: '2.5 1 280px' }}>
          <label className="form-label">🔍 Quick Search Options</label>
          <input
            type="text"
            className="form-control"
            placeholder="Search by Swimmer Name, District, Event, Heat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="form-group mb-0" style={{ flex: '2.5 1 280px' }}>
          <label className="form-label">Filter Event</label>
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

        <div className="form-group mb-0" style={{ flex: '1 1 120px' }}>
          <label className="form-label">Stage</label>
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

        <div className="form-group mb-0" style={{ flex: '1 1 120px' }}>
          <label className="form-label">Heat Filter</label>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Heats' },
              ...Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `Heat ${i + 1}` }))
            ]}
            value={selectedHeatFilter}
            onChange={(val) => setSelectedHeatFilter(val === 'All' ? 'All' : Number(val))}
          />
        </div>
      </div>

      {/* Multi-Event Print Checklist Panel */}
      {selectedEventId === -1 && (
        <div 
          className="glass-card mb-6" 
          style={{ 
            borderColor: 'rgba(250, 204, 21, 0.4)', 
            backgroundColor: 'rgba(250, 204, 21, 0.04)',
            padding: '1rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h4 style={{ margin: 0, color: '#facc15', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={18} /> Multi-Print Checklist Selection ({selectedEventIdsForPrint.length} of {events.length} Selected)
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Check individual events to include in your consolidated print report.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)' }}
                onClick={() => setSelectedEventIdsForPrint(events.map(e => e.id!))}
              >
                Select All ({events.length})
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                onClick={() => {
                  const withResults = events.filter(e => eventsWithResultsCount.get(e.id!)! > 0).map(e => e.id!);
                  setSelectedEventIdsForPrint(withResults);
                }}
              >
                Events with Results Only ({events.filter(e => (eventsWithResultsCount.get(e.id!) || 0) > 0).length})
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.4)' }}
                onClick={() => setSelectedEventIdsForPrint([])}
              >
                Deselect All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Hierarchical Tree View: Event Cards -> Heat Cards -> Age Group Tables */}
      <div className="flex flex-col gap-6">
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

            return (
              <div 
                key={tree.event.id}
                className="glass-card p-0 overflow-hidden border border-border"
                style={{
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  borderColor: isEventExpanded ? 'var(--accent-cyan)' : 'var(--border-color)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Event Card Header */}
                <div 
                  className="flex flex-wrap items-center justify-between p-4 cursor-pointer select-none"
                  style={{
                    backgroundColor: isEventExpanded ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    borderBottom: isEventExpanded ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
                  }}
                  onClick={() => toggleEventExpand(tree.event.id!)}
                >
                  <div className="flex items-center gap-3">
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
                        <h3 className="text-base font-bold text-text-primary margin-0">
                          {tree.event.distance}m {tree.event.stroke} - {tree.event.gender === 'M' ? 'Men' : 'Women'} ({tree.event.ageGroup})
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                        <span>👥 {tree.totalSwimmers} Swimmers</span>
                        <span>•</span>
                        <span>🔥 {tree.heats.length} Heat{tree.heats.length > 1 ? 's' : ''}</span>
                        {tree.finals && <span className="text-amber font-bold">• 🏆 Finals Available</span>}
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
                      {isEventExpanded ? 'Collapse ▲' : 'View Heats ▼'}
                    </button>
                  </div>
                </div>

                {/* Event Details Content (Heats list + Finals at end) */}
                {isEventExpanded && (
                  <div className="p-4 flex flex-col gap-6 bg-background/50">
                    {/* Render Heats in Sequential Order (Heat 1, Heat 2, Heat 3...) */}
                    {tree.heats.map(heat => {
                      const heatKey = `${tree.event.id}-H${heat.heatNumber}`;
                      const isHeatExpanded = expandedHeatKeys.has(heatKey);

                      return (
                        <div 
                          key={heat.heatNumber}
                          className="rounded-lg border border-border/80 overflow-hidden bg-card/60"
                        >
                          {/* Heat Sub-Header Bar */}
                          <div 
                            className="flex items-center justify-between p-3.5 bg-cyan/5 border-b border-border cursor-pointer"
                            onClick={() => toggleHeatExpand(heatKey)}
                          >
                            <div className="flex items-center gap-2.5">
                              <button 
                                className="p-1 text-cyan hover:bg-white/10 rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleHeatExpand(heatKey);
                                }}
                              >
                                {isHeatExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              <span className="font-bold text-sm text-cyan flex items-center gap-1.5">
                                🔥 HEAT {heat.heatNumber}
                              </span>
                              <span className="text-xs text-text-muted">
                                ({heat.swimmerCount} Swimmers in {heat.ageGroups.length} Age Category{heat.ageGroups.length > 1 ? 's' : ''})
                              </span>
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn btn-cyan btn-sm"
                                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}
                                onClick={() => handlePrintSingleHeat(tree.event, heat)}
                              >
                                <Printer size={14} /> Print Heat {heat.heatNumber} Results
                              </button>
                            </div>
                          </div>

                          {/* Age Group Sections inside this Heat */}
                          {isHeatExpanded && (
                            <div className="p-3 flex flex-col gap-4">
                              {heat.ageGroups.map(ag => (
                                <div key={ag.ageGroup} className="rounded border border-border/60 p-3 bg-background/80">
                                  <div className="text-xs font-bold text-amber uppercase tracking-wider mb-2.5 pb-1 border-b border-border/40 flex justify-between items-center">
                                    <span>🏷️ AGE GROUP: {ag.ageGroup} ({ag.gender === 'M' ? 'Men' : 'Women'})</span>
                                    <span className="text-text-muted font-normal">{ag.rows.length} Swimmer{ag.rows.length > 1 ? 's' : ''}</span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="data-table w-full text-xs">
                                      <thead>
                                        <tr>
                                          <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                                          <th style={{ width: '50px', textAlign: 'center' }}>Lane</th>
                                          <th>Swimmer Name</th>
                                          <th>District / Club</th>
                                          <th style={{ width: '80px', textAlign: 'center' }}>Age Group</th>
                                          <th style={{ textAlign: 'right', width: '100px' }}>Final Time</th>
                                          <th style={{ width: '70px', textAlign: 'center' }}>Method</th>
                                          <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
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
                          )}
                        </div>
                      );
                    })}

                    {/* FINALS RESULTS (Kept at the VERY END of heats for each event) */}
                    {tree.finals && (
                      <div className="rounded-lg border-2 border-amber/60 overflow-hidden bg-amber/5 mt-2">
                        <div 
                          className="flex items-center justify-between p-3.5 bg-amber/15 border-b border-amber/40 cursor-pointer"
                          onClick={() => toggleHeatExpand(`${tree.event.id}-FINALS`)}
                        >
                          <div className="flex items-center gap-2.5">
                            <button 
                              className="p-1 text-amber hover:bg-white/10 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHeatExpand(`${tree.event.id}-FINALS`);
                              }}
                            >
                              {expandedHeatKeys.has(`${tree.event.id}-FINALS`) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                            <span className="font-bold text-sm text-amber flex items-center gap-1.5 uppercase tracking-wider">
                              🏆 FINALS RESULTS
                            </span>
                            <span className="text-xs text-text-muted">
                              ({tree.finals.swimmerCount} Finalists)
                            </span>
                            {tree.isFinalsOutdated && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red/20 text-red border border-red/40">
                                Outdated (Heats Re-run)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-yellow btn-sm"
                              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 800 }}
                              onClick={() => handlePrintSingleHeat(tree.event, tree.finals!)}
                            >
                              <Printer size={14} /> Print Finals Results
                            </button>
                          </div>
                        </div>

                        {/* Age group sections for Finals */}
                        {expandedHeatKeys.has(`${tree.event.id}-FINALS`) && (
                          <div className="p-3 flex flex-col gap-4">
                            {tree.finals.ageGroups.map(ag => (
                              <div key={ag.ageGroup} className="rounded border border-amber/40 p-3 bg-background/90">
                                <div className="text-xs font-bold text-amber uppercase tracking-wider mb-2.5 pb-1 border-b border-amber/30">
                                  🏆 FINALS — AGE GROUP: {ag.ageGroup} ({ag.gender === 'M' ? 'Men' : 'Women'})
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="data-table w-full text-xs">
                                    <thead>
                                      <tr>
                                        <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                                        <th style={{ width: '50px', textAlign: 'center' }}>Lane</th>
                                        <th>Swimmer Name</th>
                                        <th>District / Club</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Age Group</th>
                                        <th style={{ textAlign: 'right', width: '100px' }}>Final Time</th>
                                        <th style={{ width: '70px', textAlign: 'center' }}>Method</th>
                                        <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ag.rows.map(r => (
                                        <tr key={r.id || `${r.laneNumber}-${r.swimmerName}`}>
                                          <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--accent-amber)' }}>
                                            {r.rank === 1 ? '🥇 #1' : (r.rank === 2 ? '🥈 #2' : (r.rank === 3 ? '🥉 #3' : `#${r.rank}`))}
                                          </td>
                                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>L{r.laneNumber}</td>
                                          <td className="font-bold text-text-primary">{r.swimmerName}</td>
                                          <td>{r.club}</td>
                                          <td style={{ textAlign: 'center' }}><span className="pill-info">{r.ageGroup}</span></td>
                                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                            <span className="text-green">{formatSecondsToTime(r.finalTime)}</span>
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            <span className="pill-info" style={{ fontSize: '0.68rem', color: 'var(--accent-amber)' }}>
                                              {r.timingMethod || 'T1'}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              className="p-1 text-red hover:bg-red/10 rounded transition-colors"
                                              onClick={() => handleDeleteResult(r.id)}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
