import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, type Event, Swimmer, LaneAssignment, seedDatabase, AgeGroup } from '../db';
import { Calendar, Plus, Users, Award, ShieldAlert, UserX, Trash2, Edit, Save, RotateCcw, ChevronDown, ChevronUp, Search, ListFilter, PlayCircle, CheckCircle2, Clock, GitMerge, Layers, Printer, Zap, Download, CheckSquare, Square, GripVertical, ArrowUp, ArrowDown, ListChecks } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import { LOGO_BASE64 } from '../utils/logoBase64';
import { printHtmlDocument } from '../utils/printHelper';

interface MeetManagerProps {
  activeMeetId?: number | null;
  setActiveMeetId?: (id: number | null) => void;
  activeEventId?: number | null;
  setActiveEventId?: (id: number | null) => void;
  activeHeatNum?: number;
  setActiveHeatNum?: (num: number) => void;
}

const ALL_AGE_GROUPS: AgeGroup[] = [
  'Group A', 'Group B', 'Group C', 'Group D',
  '25-29', '30-34', '35-39', '40-44', '45-49',
  '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80 & above'
];

export default function MeetManager({
  activeMeetId,
  setActiveMeetId,
  activeEventId,
  setActiveEventId,
  activeHeatNum,
  setActiveHeatNum
}: MeetManagerProps = {}) {
  const [meets, setMeets] = useState<Meet[]>([]);
  const [internalMeetId, setInternalMeetId] = useState<number | null>(null);
  
  // Event & Heat States
  const [events, setEvents] = useState<Event[]>([]);
  const [internalEventId, setInternalEventId] = useState<number | null>(null);
  const [heats, setHeats] = useState<number[]>([]);
  const [internalHeatNum, setInternalHeatNum] = useState<number>(1);
  const [laneAssignments, setLaneAssignments] = useState<LaneAssignment[]>([]);
  const [eligibleSwimmers, setEligibleSwimmers] = useState<Swimmer[]>([]);
  const [allSwimmersMap, setAllSwimmersMap] = useState<Map<number, Swimmer>>(new Map());
  const [completedEventIds, setCompletedEventIds] = useState<Set<number>>(new Set());
  const [manuallyDoneEventIds, setManuallyDoneEventIds] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('touchteck_manual_done_events');
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  const toggleEventDoneStatus = async (eventId: number) => {
    const isDone = completedEventIds.has(eventId) || manuallyDoneEventIds.has(eventId);
    const evHeats = eventHeatsMap.get(eventId) || [1];

    if (isDone) {
      const matchingResults = await db.results.where('eventId').equals(eventId).toArray();
      for (const r of matchingResults) {
        if (r.id) await db.results.delete(r.id);
      }
      setManuallyDoneEventIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('touchteck_manual_done_events', JSON.stringify(Array.from(next)));
        }
        return next;
      });
    } else {
      for (const h of evHeats) {
        const existing = await db.results
          .filter(r => Number(r.eventId) === Number(eventId) && Number(r.heatNumber) === Number(h))
          .first();
        if (!existing) {
          await db.results.add({
            eventId: Number(eventId),
            heatNumber: h,
            laneNumber: 1,
            splits: [],
            finalTime: 0,
            stage: 'Heats',
            status: 'OK',
            recordedAt: Date.now()
          });
        }
      }
      setManuallyDoneEventIds(prev => {
        const next = new Set(prev);
        next.add(eventId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('touchteck_manual_done_events', JSON.stringify(Array.from(next)));
        }
        return next;
      });
    }

    await loadCompletedEvents();
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  // Interactive Event List States
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('');
  const [swimmerSearchQuery, setSwimmerSearchQuery] = useState<string>('');
  const [assignedSwimmerIdsForEvent, setAssignedSwimmerIdsForEvent] = useState<Set<number>>(new Set());
  const [filterSchedulerGender, setFilterSchedulerGender] = useState<string>('All');
  const [filterSchedulerCategory, setFilterSchedulerCategory] = useState<string>('All');

  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [expandedHeatNum, setExpandedHeatNum] = useState<number>(1);

  const selectedMeetId = activeMeetId !== undefined && activeMeetId !== null ? activeMeetId : internalMeetId;
  const selectedEventId = activeEventId !== undefined && activeEventId !== null ? activeEventId : internalEventId;
  const selectedHeatNum = activeHeatNum !== undefined && activeHeatNum !== null ? activeHeatNum : internalHeatNum;

  const setSelectedMeetId = (id: number | null) => {
    setInternalMeetId(id);
    setActiveMeetId?.(id);
  };

  const setSelectedEventId = (id: number | null) => {
    setInternalEventId(id);
    setActiveEventId?.(id);
  };

  const setSelectedHeatNum = (num: number) => {
    setInternalHeatNum(num);
    setActiveHeatNum?.(num);
  };

  const handleSchedulerGenderChange = (genderVal: string) => {
    setFilterSchedulerGender(genderVal);
    setSelectedEventId(null);
  };

  const handleSchedulerCategoryChange = (catVal: string) => {
    setFilterSchedulerCategory(catVal);
    setSelectedEventId(null);
  };

  // Meet Create Form State
  const [meetName, setMeetName] = useState('');
  const [meetDate, setMeetDate] = useState('');
  const [meetLocation, setMeetLocation] = useState('');

  // Event Create Form State
  const [distance, setDistance] = useState<number>(50);
  const [stroke, setStroke] = useState<Event['stroke']>('Freestyle');
  const [gender, setGender] = useState<Event['gender']>('M');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('25-29');

  const getAvailableDistances = (selectedStroke: string): number[] => {
    switch (selectedStroke) {
      case 'Backstroke':
      case 'Breaststroke':
      case 'Butterfly':
        return [50, 100, 200];
      case 'Individual Medley':
        return [200, 400];
      case 'Freestyle':
      default:
        return [50, 100, 200, 400, 800, 1500];
    }
  };

  const handleStrokeChange = (newStroke: Event['stroke']) => {
    setStroke(newStroke);
    const valid = getAvailableDistances(newStroke);
    if (!valid.includes(distance)) {
      setDistance(valid[0]);
    }
  };

  useEffect(() => {
    loadMeets();
    loadCompletedEvents();
    const listener = () => loadCompletedEvents();
    window.addEventListener('lane-assignments-updated', listener);
    return () => window.removeEventListener('lane-assignments-updated', listener);
  }, []);

  const [savedHeatKeys, setSavedHeatKeys] = useState<Set<string>>(new Set());
  const [eventHeatsMap, setEventHeatsMap] = useState<Map<number, number[]>>(new Map());

  const loadCompletedEvents = async () => {
    const allResults = await db.results.toArray();
    const allAssignments = await db.laneAssignments.toArray();

    const savedHeatsMap = new Map<number, Set<number>>();
    const heatKeys = new Set<string>();

    allResults.forEach(r => {
      if (r.eventId) {
        if (!savedHeatsMap.has(r.eventId)) savedHeatsMap.set(r.eventId, new Set());
        if (r.heatNumber) {
          savedHeatsMap.get(r.eventId)!.add(r.heatNumber);
          heatKeys.add(`${r.eventId}-${r.heatNumber}`);
        }
      }
    });

    const totalHeatsMap = new Map<number, Set<number>>();
    allAssignments.forEach(a => {
      if (a.eventId) {
        if (!totalHeatsMap.has(a.eventId)) totalHeatsMap.set(a.eventId, new Set());
        if (a.heatNumber) totalHeatsMap.get(a.eventId)!.add(a.heatNumber);
      }
    });

    const heatsListMap = new Map<number, number[]>();
    totalHeatsMap.forEach((set, evId) => {
      heatsListMap.set(evId, Array.from(set).sort((a, b) => a - b));
    });
    setEventHeatsMap(heatsListMap);

    const doneIds = new Set<number>();
    const allEventsList = await db.events.toArray();

    allEventsList.forEach(ev => {
      if (!ev.id) return;
      const savedSet = savedHeatsMap.get(ev.id);
      const totalSet = totalHeatsMap.get(ev.id);

      const heatSet = new Set<number>();
      if (totalSet) totalSet.forEach(h => heatSet.add(h));
      if (savedSet) savedSet.forEach(h => heatSet.add(h));
      if (heatSet.size === 0) heatSet.add(1);

      const heatArray = Array.from(heatSet).sort((a, b) => a - b);
      heatsListMap.set(ev.id, heatArray);

      if (savedSet && savedSet.size > 0) {
        let allSaved = true;
        for (const h of heatArray) {
          if (!savedSet.has(h)) {
            allSaved = false;
            break;
          }
        }
        if (allSaved) {
          doneIds.add(ev.id);
        }
      }
    });

    setEventHeatsMap(heatsListMap);
    setCompletedEventIds(doneIds);
    setSavedHeatKeys(heatKeys);
  };

  useEffect(() => {
    if (selectedMeetId) {
      loadEvents(selectedMeetId);
      loadAllSwimmers(selectedMeetId);
    } else {
      setEvents([]);
      setSelectedEventId(null);
    }
  }, [selectedMeetId]);

  useEffect(() => {
    if (expandedEventId) {
      loadHeatsAndAssignments(expandedEventId, expandedHeatNum);
      loadEligibleSwimmers(expandedEventId);
    } else {
      setLaneAssignments([]);
      setEligibleSwimmers([]);
    }
  }, [expandedEventId, expandedHeatNum]);

  const loadMeets = async () => {
    const list = await db.meets.toArray();
    setMeets(list);
    if (list.length > 0 && !selectedMeetId) {
      setSelectedMeetId(list[0].id || null);
    }
  };

  const loadAllSwimmers = async (meetId: number) => {
    const list = await db.swimmers.filter(s => (s.meetId || 1) === meetId).toArray();
    const map = new Map<number, Swimmer>();
    list.forEach(s => {
      if (s.id) map.set(s.id, s);
    });
    setAllSwimmersMap(map);
  };

  const loadEvents = async (meetId: number) => {
    const list = await db.events.where('meetId').equals(meetId).toArray();
    // Club all Men's events together first, and all Women's events together second,
    // while strictly preserving each event's age group, event number & stroke!
    list.sort((a, b) => {
      if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
      return (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0);
    });
    setEvents(list);
    setSelectedEventId(null);
    setSelectedHeatNum(1);
  };

  const loadHeatsAndAssignments = async (eventId: number, heatNum: number) => {
    const assignments = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(eventId) && Number(a.heatNumber) === Number(heatNum))
      .toArray();

    const fullLanes: LaneAssignment[] = [];
    for (let lane = 1; lane <= 8; lane++) {
      const match = assignments.find(a => a.laneNumber === lane);
      if (match) {
        fullLanes.push(match);
      } else {
        fullLanes.push({
          eventId,
          heatNumber: heatNum,
          laneNumber: lane,
          swimmerId: undefined
        });
      }
    }
    setLaneAssignments(fullLanes);

    const allAssignmentsForEvent = await db.laneAssignments.where('eventId').equals(eventId).toArray();
    const uniqueHeats = Array.from(new Set(allAssignmentsForEvent.map(a => a.heatNumber)));
    if (!uniqueHeats.includes(heatNum)) {
      uniqueHeats.push(heatNum);
    }
    setHeats(uniqueHeats.sort((a, b) => a - b));

    const assignedIds = new Set<number>();
    allAssignmentsForEvent.forEach(a => {
      if (a.swimmerId) assignedIds.add(a.swimmerId);
    });
    setAssignedSwimmerIdsForEvent(assignedIds);
  };

  const loadEligibleSwimmers = async (eventId: number) => {
    const event = await db.events.get(eventId);
    if (!event) return;

    const allSwimmersInMeet = await db.swimmers
      .filter(s => (s.meetId || 1) === (event.meetId || 1))
      .toArray();

    // 1. Strict Gender Filter: Men for Men's events, Women for Women's events!
    let list = allSwimmersInMeet.filter(s => s.gender === event.gender);
    if (list.length === 0) {
      list = allSwimmersInMeet;
    }

    // 2. Strict Category / Age Group Filter (Group A, Group B, etc.)
    if (event.ageGroup && event.ageGroup !== 'All Age Groups' && !event.ageGroup.toLowerCase().includes('merged') && !(event as any).isMerged) {
      const matchCat = list.filter(s => s.ageGroup === event.ageGroup);
      if (matchCat.length > 0) {
        list = matchCat;
      }
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    setEligibleSwimmers(list);
  };

  const [isCreatingMeet, setIsCreatingMeet] = useState<boolean>(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);

  const [editingMeetId, setEditingMeetId] = useState<number | null>(null);
  const [showDeleteMeetConfirm, setShowDeleteMeetConfirm] = useState<boolean>(false);
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState<boolean>(false);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [selectedMergeType, setSelectedMergeType] = useState<string | null>(null);

  const [showPrintHeatModal, setShowPrintHeatModal] = useState<boolean>(false);
  const [printTargetEventId, setPrintTargetEventId] = useState<number | null>(null);
  const [printTargetHeatNum, setPrintTargetHeatNum] = useState<number | 'ALL'>('ALL');

  // Batch Select Mode State & Single Action Selection
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [activeBatchAction, setActiveBatchAction] = useState<'DONE' | 'MERGE' | 'PRINT' | 'REORDER' | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const toggleSelectEvent = (id: number) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleHeatDoneStatus = async (eventId: number, heatNum: number) => {
    const heatKey = `${eventId}-${heatNum}`;
    const isDone = savedHeatKeys.has(heatKey);

    if (isDone) {
      const matchingResults = await db.results
        .filter(r => Number(r.eventId) === Number(eventId) && Number(r.heatNumber) === Number(heatNum))
        .toArray();
      for (const r of matchingResults) {
        if (r.id) await db.results.delete(r.id);
      }
    } else {
      const existing = await db.results
        .filter(r => Number(r.eventId) === Number(eventId) && Number(r.heatNumber) === Number(heatNum))
        .first();
      if (!existing) {
        await db.results.add({
          eventId: Number(eventId),
          heatNumber: heatNum,
          laneNumber: 1,
          splits: [],
          finalTime: 0,
          stage: 'Heats',
          status: 'OK',
          recordedAt: Date.now()
        });
      }
    }

    await loadCompletedEvents();
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  const handleSelectAllEvents = () => {
    const allIds = new Set(sortedEvents.map(e => e.id!));
    setSelectedEventIds(allIds);
  };

  const handleDeselectAllEvents = () => {
    setSelectedEventIds(new Set());
  };

  const toggleSingleEventDoneStatus = async (eventId: number) => {
    const evHeats = eventHeatsMap.get(eventId) || [1];
    const areAllHeatsSaved = evHeats.length > 0 && evHeats.every(h => savedHeatKeys.has(`${eventId}-${h}`));
    const isDone = completedEventIds.has(eventId) || manuallyDoneEventIds.has(eventId) || areAllHeatsSaved;

    const nextManual = new Set(manuallyDoneEventIds);
    if (isDone) {
      nextManual.delete(eventId);
      const results = await db.results
        .filter(r => Number(r.eventId) === Number(eventId))
        .toArray();
      for (const r of results) {
        if (r.id) await db.results.delete(r.id);
      }
    } else {
      nextManual.add(eventId);
      for (const h of evHeats) {
        const existing = await db.results
          .filter(r => Number(r.eventId) === Number(eventId) && Number(r.heatNumber) === Number(h))
          .first();
        if (!existing) {
          await db.results.add({
            eventId: Number(eventId),
            heatNumber: h,
            laneNumber: 1,
            splits: [],
            finalTime: 0,
            stage: 'Heats',
            status: 'OK',
            recordedAt: Date.now()
          });
        }
      }
    }

    setManuallyDoneEventIds(nextManual);
    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_manual_done_events', JSON.stringify(Array.from(nextManual)));
    }
    await loadCompletedEvents();
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  const handleBatchMarkDone = async () => {
    if (selectedEventIds.size === 0) {
      alert('Please select at least one event first!');
      return;
    }
    const selectedIds = Array.from(selectedEventIds);
    const allSelectedAreDone = selectedIds.every(id => {
      const evHeats = eventHeatsMap.get(id) || [1];
      const areAllHeatsSaved = evHeats.length > 0 && evHeats.every(h => savedHeatKeys.has(`${id}-${h}`));
      return completedEventIds.has(id) || manuallyDoneEventIds.has(id) || areAllHeatsSaved;
    });

    const nextManual = new Set(manuallyDoneEventIds);

    if (allSelectedAreDone) {
      for (const eventId of selectedIds) {
        nextManual.delete(eventId);
        const results = await db.results
          .filter(r => Number(r.eventId) === Number(eventId))
          .toArray();
        for (const r of results) {
          if (r.id) await db.results.delete(r.id);
        }
      }
    } else {
      for (const eventId of selectedIds) {
        nextManual.add(eventId);
        const evHeats = eventHeatsMap.get(eventId) || [1];
        for (const h of evHeats) {
          const existing = await db.results
            .filter(r => Number(r.eventId) === Number(eventId) && Number(r.heatNumber) === Number(h))
            .first();
          if (!existing) {
            await db.results.add({
              eventId: Number(eventId),
              heatNumber: h,
              laneNumber: 1,
              splits: [],
              finalTime: 0,
              stage: 'Heats',
              status: 'OK',
              recordedAt: Date.now()
            });
          }
        }
      }
    }

    setManuallyDoneEventIds(nextManual);
    if (typeof window !== 'undefined') {
      localStorage.setItem('touchteck_manual_done_events', JSON.stringify(Array.from(nextManual)));
    }
    await loadCompletedEvents();
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  const handleMoveEventPosition = async (currentIndex: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedEvents.length) return;

    const list = [...sortedEvents];
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    const updated = list.map((ev, idx) => ({ ...ev, eventNo: idx + 1 }));
    setEvents(updated);

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].id) {
        await db.events.update(updated[i].id!, { eventNo: i + 1 });
      }
    }
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const list = [...sortedEvents];
    const [moved] = list.splice(draggedIndex, 1);
    list.splice(dropIndex, 0, moved);

    const updated = list.map((ev, idx) => ({ ...ev, eventNo: idx + 1 }));
    setEvents(updated);
    setDraggedIndex(null);

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].id) {
        await db.events.update(updated[i].id!, { eventNo: i + 1 });
      }
    }
    window.dispatchEvent(new Event('lane-assignments-updated'));
  };

  // Official World Aquatics / FINA Spearhead Lane Seeding Order:
  // L4 (1st fastest), L5 (2nd), L3 (3rd), L6 (4th), L2 (5th), L7 (6th), L1 (7th), L8 (8th)
  const SPEARHEAD_ORDER = [4, 5, 3, 6, 2, 7, 1, 8];

  const handleAutoSeedSpearhead = async (eventId: number, heatNum: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const eligible = eligibleSwimmers.filter(s => s.ageGroup === event.ageGroup && s.gender === event.gender);
    const pool = eligible.length > 0 ? eligible : eligibleSwimmers;
    if (pool.length === 0) return;

    const existing = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(eventId) && Number(a.heatNumber) === Number(heatNum))
      .toArray();

    for (const a of existing) {
      if (a.id) await db.laneAssignments.delete(a.id);
    }

    const countToSeed = Math.min(pool.length, 8);
    for (let i = 0; i < countToSeed; i++) {
      const targetLane = SPEARHEAD_ORDER[i];
      await db.laneAssignments.add({
        eventId,
        heatNumber: heatNum,
        laneNumber: targetLane,
        swimmerId: pool[i].id
      });
    }

    for (let lane = 1; lane <= 8; lane++) {
      const exists = await db.laneAssignments
        .filter(a => Number(a.eventId) === Number(eventId) && Number(a.heatNumber) === Number(heatNum) && Number(a.laneNumber) === lane)
        .first();
      if (!exists) {
        await db.laneAssignments.add({
          eventId,
          heatNumber: heatNum,
          laneNumber: lane,
          swimmerId: undefined
        });
      }
    }

    await loadHeatsAndAssignments(eventId, heatNum);
  };

  const handleBatchPrint = async () => {
    if (selectedEventIds.size === 0) {
      alert('Please select at least one event first!');
      return;
    }
    const selectedEventsList = sortedEvents.filter(ev => selectedEventIds.has(ev.id!));
    if (selectedEventsList.length === 0) return;

    if (selectedEventsList.length <= 3) {
      await handlePrintDetailedEventsList(selectedEventsList);
    } else {
      await handlePrintCompactEventsList(selectedEventsList);
    }
  };

  const handlePrintHeatSheet = async (eventId: number, heatNumToPrint?: number | 'ALL') => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    await handlePrintDetailedEventsList([ev], heatNumToPrint);
  };

  const handlePrintDetailedEventsList = async (selectedEvs: typeof events, heatNumToPrint?: number | 'ALL') => {
    const currentMeet = meets.find(m => m.id === selectedMeetId) || meets[0];
    const meetNameStr = currentMeet ? currentMeet.name : '11th Telangana Masters IDSC 2026';

    let fullPagesHtml = '';

    for (const ev of selectedEvs) {
      const allAssignments = await db.laneAssignments.where('eventId').equals(ev.id!).toArray();
      let heatNumbers = Array.from(new Set(allAssignments.map(a => a.heatNumber))).sort((a, b) => a - b);

      if (heatNumbers.length === 0) {
        heatNumbers.push(1);
      }

      const selectedHeats = (heatNumToPrint && heatNumToPrint !== 'ALL') ? [Number(heatNumToPrint)] : heatNumbers;

      for (let i = 0; i < selectedHeats.length; i++) {
        const hNum = selectedHeats[i];
        const assignments = allAssignments.filter(a => a.heatNumber === hNum);

        let tableRows = '';
        for (let laneNum = 1; laneNum <= 8; laneNum++) {
          const assign = assignments.find(a => a.laneNumber === laneNum);
          const swimmer = assign?.swimmerId ? await db.swimmers.get(assign.swimmerId) : null;

          tableRows += `
            <tr>
              <td style="text-align: center; font-weight: 800; font-size: 14px; color: #0f172a;">L${laneNum}</td>
              <td style="font-family: monospace; font-size: 12px; font-weight: 700; color: #0284c7;">${swimmer?.sfiUid ? '[' + swimmer.sfiUid + ']' : '--'}</td>
              <td style="font-weight: 700; font-size: 13px; color: #0f172a;">${swimmer ? `${swimmer.name} <span style="font-size: 11px; color: #0284c7; font-weight: 700;">(${swimmer.gender === 'M' ? 'Men' : 'Women'})</span>` : '<span style="color: #94a3b8; font-weight: 400;">Empty Lane</span>'}</td>
              <td>${swimmer?.club || '--'}</td>
              <td>${swimmer?.ageGroup || ev.ageGroup}</td>
              <td style="font-family: monospace; font-weight: 700; text-align: right;">${swimmer ? 'NT' : '--'}</td>
              <td style="border-bottom: 1px dashed #cbd5e1;"></td>
            </tr>
          `;
        }

        fullPagesHtml += `
          <div class="heat-page" style="margin-bottom: 16px; break-inside: avoid;">
            <div class="header" style="position: relative; border-bottom: 1px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
              <img src="${LOGO_BASE64}" style="position: absolute; right: 0; top: 0; height: 44px; width: auto; max-width: 90px; object-fit: contain;" />
              <div style="padding-right: 100px;">
                <h1 style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a;">${meetNameStr}</h1>
                <h2 style="font-size: 12px; font-weight: 700; color: #0284c7; margin: 2px 0 0 0;">OFFICIAL HEAT START LIST — HEAT ${hNum} OF ${heatNumbers.length}</h2>
              </div>
              <div class="meta-info" style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-top: 6px; background: #f8fafc; padding: 5px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                <span><strong>Event #${ev.eventNo || ev.id}:</strong> ${ev.distance}m ${ev.stroke} • ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})</span>
                <span>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff;">
                  <th style="width: 45px; text-align: center; padding: 5px; font-size: 10px;">Lane</th>
                  <th style="width: 130px; padding: 5px; font-size: 10px;">SFI UID / Reg</th>
                  <th style="padding: 5px; font-size: 10px;">Swimmer Name</th>
                  <th style="padding: 5px; font-size: 10px;">District / Club</th>
                  <th style="width: 90px; padding: 5px; font-size: 10px;">Age Group</th>
                  <th style="width: 80px; text-align: right; padding: 5px; font-size: 10px;">Seed Time</th>
                  <th style="width: 110px; padding: 5px; font-size: 10px;">Official Time</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    await printHtmlDocument(`Heat Sheet - Selected Events`, fullPagesHtml);
  };

  const handlePrintCompactEventsList = async (selectedEvs: typeof events) => {
    const currentMeet = meets.find(m => m.id === selectedMeetId) || meets[0];
    const meetNameStr = currentMeet ? currentMeet.name : '11th Telangana Masters IDSC 2026';

    const allAssignments = await db.laneAssignments.toArray();
    const sortedEvs = [...selectedEvs].sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));

    let masterHtml = '';

    for (const ev of sortedEvs) {
      const eventAssigns = allAssignments.filter(a => Number(a.eventId) === Number(ev.id));
      const heatNumbers = Array.from(new Set(eventAssigns.map(a => Number(a.heatNumber)))).sort((a, b) => a - b);
      if (heatNumbers.length === 0) heatNumbers.push(1);

      let eventHeatsHtml = '';
      for (const hNum of heatNumbers) {
        const assignments = eventAssigns.filter(a => Number(a.heatNumber) === hNum);
        
        let laneRows = '';
        for (let laneNum = 1; laneNum <= 8; laneNum++) {
          const assign = assignments.find(a => Number(a.laneNumber) === laneNum);
          const swimmer = assign?.swimmerId ? await db.swimmers.get(assign.swimmerId) : null;

          laneRows += `
            <tr>
              <td style="text-align: center; font-weight: 800; font-size: 9px; padding: 2px 3px; width: 22px;">L${laneNum}</td>
              <td style="font-family: monospace; font-size: 8.5px; font-weight: 700; color: #0284c7; padding: 2px 3px; width: 90px;">${swimmer?.sfiUid ? '[' + swimmer.sfiUid + ']' : '--'}</td>
              <td style="font-weight: 700; font-size: 9px; color: #0f172a; padding: 2px 3px;">${swimmer ? `${swimmer.name} <span style="font-size: 8px; color: #0284c7;">(${swimmer.gender === 'M' ? 'Men' : 'Women'})</span>` : '<span style="color: #94a3b8; font-weight: 400;">Unassigned</span>'}</td>
              <td style="font-size: 8.5px; padding: 2px 3px; color: #475569; width: 85px;">${swimmer?.club || '--'}</td>
              <td style="font-size: 8.5px; padding: 2px 3px; color: #0f172a; font-weight: 600; width: 50px;">${swimmer?.ageGroup || ev.ageGroup}</td>
              <td style="font-family: monospace; font-size: 8.5px; font-weight: 700; padding: 2px 3px; text-align: right; width: 40px;">${swimmer ? 'NT' : '--'}</td>
            </tr>
          `;
        }

        eventHeatsHtml += `
          <div style="margin-bottom: 4px; break-inside: avoid;">
            <div style="background: #f1f5f9; padding: 2px 5px; font-size: 9px; font-weight: 800; color: #0f172a; border-left: 3px solid #0284c7; display: flex; justify-content: space-between;">
              <span>HEAT ${hNum} OF ${heatNumbers.length}</span>
              <span>L1-L8</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 1px;">
              <thead>
                <tr style="background: #0f172a; color: #fff; font-size: 8px; text-align: left;">
                  <th style="padding: 2px 3px; text-align: center;">Lane</th>
                  <th style="padding: 2px 3px;">SFI UID / Reg</th>
                  <th style="padding: 2px 3px;">Swimmer Name</th>
                  <th style="padding: 2px 3px;">District / Club</th>
                  <th style="padding: 2px 3px;">Age Group</th>
                  <th style="padding: 2px 3px; text-align: right;">Seed</th>
                </tr>
              </thead>
              <tbody>
                ${laneRows}
              </tbody>
            </table>
          </div>
        `;
      }

      masterHtml += `
        <div style="margin-bottom: 8px; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px; background: #fff;">
          <div style="font-size: 10px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 3px; display: flex; justify-content: space-between;">
            <span>EVENT #${ev.eventNo || ev.id}: ${ev.distance}m ${ev.stroke}</span>
            <span style="color: #0284c7;">${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})</span>
          </div>
          ${eventHeatsHtml}
        </div>
      `;
    }

    const finalHtml = `
      <div class="header" style="position: relative; border-bottom: 1px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
        <img src="${LOGO_BASE64}" style="position: absolute; right: 0; top: 0; height: 44px; width: auto; max-width: 90px; object-fit: contain;" />
        <div style="padding-right: 100px;">
          <h1 style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a;">${meetNameStr}</h1>
          <h2 style="font-size: 12px; font-weight: 700; color: #0284c7; margin: 2px 0 0 0;">OFFICIAL MASTER MEET START LIST (PAPER-SAVER SUMMARY) — ${selectedEvs.length} EVENTS</h2>
        </div>
        <div style="font-size: 9px; text-align: right; color: #64748b; margin-top: 4px;">
          Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div class="compact-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        ${masterHtml}
      </div>
    `;

    await printHtmlDocument(`Master Meet Start List - ${meetNameStr}`, finalHtml);
  };

  const handleDownloadMasterEventListCSV = async () => {
    const currentMeet = meets.find(m => m.id === selectedMeetId) || meets[0];
    const meetNameStr = currentMeet ? currentMeet.name : '11th Telangana Masters IDSC 2026';

    const allAssignments = await db.laneAssignments.toArray();
    const sortedEvs = [...events].sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));

    let csvContent = `Event No,Distance,Stroke,Gender,Age Group,Heat No,Lane No,SFI UID,Swimmer Name,District/Club\n`;

    for (const ev of sortedEvs) {
      const eventAssigns = allAssignments.filter(a => Number(a.eventId) === Number(ev.id));
      const heatNumbers = Array.from(new Set(eventAssigns.map(a => Number(a.heatNumber)))).sort((a, b) => a - b);
      if (heatNumbers.length === 0) heatNumbers.push(1);

      for (const hNum of heatNumbers) {
        const assignments = eventAssigns.filter(a => Number(a.heatNumber) === hNum);

        for (let laneNum = 1; laneNum <= 8; laneNum++) {
          const assign = assignments.find(a => Number(a.laneNumber) === laneNum);
          const swimmer = assign?.swimmerId ? await db.swimmers.get(assign.swimmerId) : null;

          const evNo = ev.eventNo || ev.id;
          const dist = ev.distance;
          const strk = ev.stroke;
          const gndr = ev.gender === 'M' ? 'Men' : 'Women';
          const age = ev.ageGroup;
          const uid = swimmer?.sfiUid || '';
          const name = swimmer ? swimmer.name.replace(/,/g, ' ') : 'Unassigned';
          const club = swimmer?.club ? swimmer.club.replace(/,/g, ' ') : '';

          csvContent += `"${evNo}","${dist}m","${strk}","${gndr}","${age}","Heat ${hNum}","Lane ${laneNum}","${uid}","${name}","${club}"\n`;
        }
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Telangana_Masters_2026_Heat_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartEditMeet = () => {
    const current = meets.find(m => m.id === selectedMeetId);
    if (!current) return;
    setEditingMeetId(current.id!);
    setMeetName(current.name);
    setMeetLocation(current.location || '');
    setMeetDate(current.date || '');
    setIsCreatingMeet(true);
  };

  const handleCancelEditMeet = () => {
    setEditingMeetId(null);
    setIsCreatingMeet(false);
    setMeetName('');
    setMeetLocation('');
    setMeetDate('');
  };

  const handleSaveMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetName.trim()) return;

    if (editingMeetId) {
      await db.meets.update(editingMeetId, {
        name: meetName,
        date: meetDate || new Date().toISOString().split('T')[0],
        location: meetLocation
      });
      setEditingMeetId(null);
    } else {
      const id = await db.meets.add({
        name: meetName,
        date: meetDate || new Date().toISOString().split('T')[0],
        location: meetLocation
      });
      setSelectedMeetId(id);
    }
    setIsCreatingMeet(false);
    setMeetName('');
    setMeetLocation('');
    setMeetDate('');
    loadMeets();
  };

  const handleConfirmDeleteMeet = async () => {
    if (!selectedMeetId) return;
    await db.meets.delete(selectedMeetId);
    const eventsToDelete = await db.events.where('meetId').equals(selectedMeetId).toArray();
    for (const ev of eventsToDelete) {
      if (ev.id) {
        await db.laneAssignments.where('eventId').equals(ev.id).delete();
        await db.results.where('eventId').equals(ev.id).delete();
        await db.events.delete(ev.id);
      }
    }
    await db.swimmers.where('meetId').equals(selectedMeetId).delete();
    setShowDeleteMeetConfirm(false);
    setSelectedMeetId(null);
    loadMeets();
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetId) return;

    const newId = await db.events.add({
      meetId: selectedMeetId,
      distance: Number(distance),
      stroke,
      gender,
      ageGroup
    });

    setIsCreatingEvent(false);
    await loadEvents(selectedMeetId);
    setSelectedEventId(newId);
    setSelectedHeatNum(1);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!expandedEventId) return;
    await db.laneAssignments.where('eventId').equals(expandedEventId).delete();
    await db.results.where('eventId').equals(expandedEventId).delete();
    await db.events.delete(expandedEventId);
    setShowDeleteEventConfirm(false);
    setExpandedEventId(null);
    if (selectedMeetId) {
      loadEvents(selectedMeetId);
    }
  };

  const handleLaneChange = async (laneNumber: number, swimmerIdValue: string) => {
    if (!expandedEventId) return;
    const swimmerId = swimmerIdValue ? Number(swimmerIdValue) : undefined;

    const existing = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(expandedEventId) && Number(a.heatNumber) === Number(expandedHeatNum) && Number(a.laneNumber) === Number(laneNumber))
      .first();

    if (existing && existing.id) {
      await db.laneAssignments.update(existing.id, { swimmerId });
    } else {
      await db.laneAssignments.add({
        eventId: expandedEventId,
        heatNumber: expandedHeatNum,
        laneNumber,
        swimmerId
      });
    }

    loadHeatsAndAssignments(expandedEventId, expandedHeatNum);
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  const addHeat = () => {
    const nextHeat = heats.length > 0 ? Math.max(...heats) + 1 : 1;
    setExpandedHeatNum(nextHeat);
  };

  const handleClearAllLanes = async () => {
    if (!expandedEventId) return;
    if (!window.confirm(`Clear all swimmer assignments for Heat ${expandedHeatNum}?`)) return;

    const assignments = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(expandedEventId) && Number(a.heatNumber) === Number(expandedHeatNum))
      .toArray();

    for (const a of assignments) {
      if (a.id) {
        await db.laneAssignments.update(a.id, { swimmerId: undefined });
      }
    }
    loadHeatsAndAssignments(expandedEventId, expandedHeatNum);
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  const getSwimmerName = (swimmerId?: number) => {
    if (!swimmerId) return '';
    const match = allSwimmersMap.get(swimmerId) || eligibleSwimmers.find(s => s.id === swimmerId);
    if (match) {
      return `${match.sfiUid ? `[${match.sfiUid}] ` : ''}${match.name} (${match.club})`;
    }
    return '';
  };

  const handleResetDemoData = async () => {
    if (window.confirm('Restore official 109 SFI registered swimmers data for "11th Telangana Masters IDSC 2026"?')) {
      const newMeetId = await seedDatabase(true);
      const allMeets = await db.meets.toArray();
      setMeets(allMeets);
      if (newMeetId) {
        setSelectedMeetId(newMeetId);
        if (setActiveMeetId) setActiveMeetId(newMeetId);
        loadEvents(newMeetId);
        loadAllSwimmers(newMeetId);
      }
    }
  };

  const filteredEvents = events.filter(ev => {
    const matchG = !filterSchedulerGender || filterSchedulerGender === 'All' || ev.gender === filterSchedulerGender;
    const matchC = !filterSchedulerCategory || filterSchedulerCategory === 'All' || ev.ageGroup === filterSchedulerCategory;
    const q = eventSearchQuery.toLowerCase().trim();
    const matchQ = !q || 
      String(ev.eventNo || ev.id).includes(q) || 
      ev.stroke.toLowerCase().includes(q) || 
      String(ev.distance).includes(q) ||
      ev.ageGroup.toLowerCase().includes(q);

    return matchG && matchC && matchQ;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));
  const firstUncompletedEventId = sortedEvents.find(e => !completedEventIds.has(e.id!) && !manuallyDoneEventIds.has(e.id!))?.id;
  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
      
      {/* Sidebar: Meet and Event configuration */}
      <div className="flex flex-col gap-4">
        {/* Meet Setup Card */}
        <div className="glass-card">
          <h3 className="settings-header"><Calendar size={18} /> Meet Setup</h3>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label mb-0">Active Meet</label>
              {selectedMeetId && (
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={handleStartEditMeet}
                    title="Edit Active Meet Details"
                  >
                    <Edit size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }}
                    onClick={() => setShowDeleteMeetConfirm(true)}
                    title="Delete Active Meet"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
            
            <CustomSelect
              options={meets.map(m => ({ value: m.id!, label: m.name }))}
              value={selectedMeetId || ''}
              onChange={(val) => {
                setSelectedMeetId(Number(val));
              }}
            />
          </div>

          {!isCreatingMeet ? (
            <div className="flex flex-col gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderStyle: 'dashed' }}
                onClick={() => {
                  setEditingMeetId(null);
                  setMeetName('');
                  setMeetLocation('');
                  setMeetDate('');
                  setIsCreatingMeet(true);
                }}
              >
                <Plus size={16} /> Create New Meet
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}
                onClick={handleResetDemoData}
                title="Restore 109 Registered Swimmers Data"
              >
                <RotateCcw size={15} /> Restore Demo Data
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveMeet} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {editingMeetId ? 'Edit Meet Details' : 'Create New Meet'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={handleCancelEditMeet}
                >
                  Cancel
                </button>
              </div>
              <div className="form-group mt-2">
                <input
                  type="text"
                  placeholder="Meet Name"
                  required
                  className="form-control"
                  value={meetName}
                  onChange={(e) => setMeetName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Location"
                  className="form-control"
                  value={meetLocation}
                  onChange={(e) => setMeetLocation(e.target.value)}
                />
              </div>
              <div className="form-group">
                <input
                  type="date"
                  className="form-control"
                  value={meetDate}
                  onChange={(e) => setMeetDate(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingMeetId ? <Save size={16} /> : <Plus size={16} />} {editingMeetId ? 'Save Changes' : 'Save Meet'}
              </button>
            </form>
          )}
        </div>

        {/* Event Scheduler Card */}
        {selectedMeetId && (
          <div className="glass-card">
            <h3 className="settings-header"><Award size={18} /> Event Scheduler</h3>
            
            {/* Separate Gender & Category Filters for Event Scheduler */}
            <div className="form-row mb-3">
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GENDER</label>
                <CustomSelect
                  options={[
                    { value: 'All', label: 'All Genders' },
                    { value: 'M', label: 'Men' },
                    { value: 'F', label: 'Women' }
                  ]}
                  value={filterSchedulerGender || 'All'}
                  onChange={(val) => handleSchedulerGenderChange(val)}
                />
              </div>

              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CATEGORY / GROUP</label>
                <CustomSelect
                  options={[
                    { value: 'All', label: 'All Categories' },
                    ...ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))
                  ]}
                  value={filterSchedulerCategory || 'All'}
                  onChange={(val) => handleSchedulerCategoryChange(val)}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label mb-0">ACTIVE EVENT</label>
                {selectedEventId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }}
                    onClick={() => setShowDeleteEventConfirm(true)}
                    title="Delete Selected Event"
                  >
                    <Trash2 size={13} /> Delete Event
                  </button>
                )}
              </div>

              <CustomSelect
                options={events
                  .filter(ev => {
                    const matchG = !filterSchedulerGender || filterSchedulerGender === 'All' || ev.gender === filterSchedulerGender;
                    const matchC = !filterSchedulerCategory || filterSchedulerCategory === 'All' || ev.ageGroup === filterSchedulerCategory;
                    return matchG && matchC;
                  })
                  .map(ev => ({
                    value: ev.id!,
                    label: `Event #${ev.eventNo || ev.id}: ${ev.distance}m ${ev.stroke}`
                  }))
                }
                value={selectedEventId || ''}
                placeholder="No matching events found"
                onChange={(val) => {
                  setSelectedEventId(Number(val));
                  setSelectedHeatNum(1);
                }}
              />
            </div>

            {!isCreatingEvent ? (
              <button
                type="button"
                className="btn btn-secondary mt-3"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderStyle: 'dashed' }}
                onClick={() => setIsCreatingEvent(true)}
              >
                <Plus size={16} /> Add New Event
              </button>
            ) : (
              <form onSubmit={handleCreateEvent} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Add New Event</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                    onClick={() => setIsCreatingEvent(false)}
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="form-group mt-2">
                  <label className="form-label">Stroke</label>
                  <CustomSelect
                    options={[
                      { value: 'Freestyle', label: 'Freestyle' },
                      { value: 'Backstroke', label: 'Backstroke' },
                      { value: 'Breaststroke', label: 'Breaststroke' },
                      { value: 'Butterfly', label: 'Butterfly' },
                      { value: 'Individual Medley', label: 'Individual Medley' }
                    ]}
                    value={stroke}
                    onChange={(val) => handleStrokeChange(val as Event['stroke'])}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Distance</label>
                  <CustomSelect
                    options={getAvailableDistances(stroke).map(d => ({ value: d, label: `${d}m` }))}
                    value={distance}
                    onChange={(val) => setDistance(Number(val))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <CustomSelect
                    options={[
                      { value: 'M', label: 'Men' },
                      { value: 'F', label: 'Women' }
                    ]}
                    value={gender}
                    onChange={(val) => setGender(val as Event['gender'])}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Age Group / Category</label>
                  <CustomSelect
                    options={ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))}
                    value={ageGroup}
                    onChange={(val) => setAgeGroup(val as AgeGroup)}
                  />
                </div>

                <button type="submit" className="btn btn-primary mt-3" style={{ width: '100%' }}>
                  <Plus size={16} /> Save Event
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Scrollable Interactive Event Order List */}
      <div className="flex flex-col gap-4">
        {/* Event Order Header & Filters */}
        <div className="glass-card">
          <div className="card-header flex justify-between items-center mb-4">
            <div>
              <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                Order Of Events — 11th Telangana Masters IDSC 2026
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-cyan)', fontWeight: 600 }}>
                {sortedEvents.length} Championship Events • Ordered Strictly by Official Schedule
              </span>
            </div>
          </div>

          <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
            <div className="form-group mb-0" style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search event #, stroke, distance..."
                  className="form-control"
                  style={{ paddingLeft: '36px' }}
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group mb-0" style={{ minWidth: '150px' }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Genders' },
                  { value: 'M', label: 'Men' },
                  { value: 'F', label: 'Women' }
                ]}
                value={filterSchedulerGender}
                onChange={(val) => handleSchedulerGenderChange(val)}
              />
            </div>

            <div className="form-group mb-0" style={{ minWidth: '170px' }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Categories' },
                  ...ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))
                ]}
                value={filterSchedulerCategory}
                onChange={(val) => handleSchedulerCategoryChange(val)}
              />
            </div>

            <div className="form-group mb-0">
              <button
                type="button"
                className={`btn ${isSelectMode ? 'btn-cyan' : 'btn-secondary'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: isSelectMode ? '#0f172a' : '#06b6d4',
                  borderColor: 'rgba(6, 182, 212, 0.5)',
                  backgroundColor: isSelectMode ? '#06b6d4' : 'rgba(6, 182, 212, 0.12)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.9rem',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setIsSelectMode(prev => !prev)}
                title="Enable batch selection mode for events"
              >
                <CheckSquare size={16} /> {isSelectMode ? 'Exit Select' : 'Select'}
              </button>
            </div>
          </div>

          {/* Batch Select Operations Control Panel */}
          {isSelectMode && (
            <div 
              style={{
                marginTop: '1.25rem',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1.5px solid rgba(6, 182, 212, 0.5)',
                borderRadius: '14px',
                padding: '0.9rem 1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
              }}
            >
              {/* Top Row: Title + Quick Select (Select All / Deselect All) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CheckSquare size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
                    Batch Selection Mode ({selectedEventIds.size} Selected)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8' }}
                    onClick={handleSelectAllEvents}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderColor: 'rgba(248,113,113,0.4)', color: '#f87171' }}
                    onClick={handleDeselectAllEvents}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Single Action Options: Marked Done, Merger, Print Heat Sheet, Print Entire List, Download CSV, Change Order */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn ${activeBatchAction === 'DONE' ? 'btn-cyan' : 'btn-secondary'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    backgroundColor: activeBatchAction === 'DONE' ? undefined : 'rgba(34, 197, 94, 0.12)',
                    borderColor: activeBatchAction === 'DONE' ? undefined : 'rgba(34, 197, 94, 0.45)',
                    color: activeBatchAction === 'DONE' ? undefined : '#4ade80'
                  }}
                  onClick={() => {
                    setActiveBatchAction('DONE');
                    handleBatchMarkDone();
                  }}
                >
                  <CheckCircle2 size={16} /> Marked Done ({selectedEventIds.size})
                </button>

                <button
                  type="button"
                  className={`btn ${activeBatchAction === 'MERGE' ? 'btn-yellow' : 'btn-secondary'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    backgroundColor: activeBatchAction === 'MERGE' ? undefined : 'rgba(234, 179, 8, 0.12)',
                    borderColor: activeBatchAction === 'MERGE' ? undefined : 'rgba(234, 179, 8, 0.45)',
                    color: activeBatchAction === 'MERGE' ? undefined : '#eab308'
                  }}
                  onClick={() => {
                    setActiveBatchAction('MERGE');
                    setShowMergeModal(true);
                  }}
                >
                  <GitMerge size={16} /> Merger ({selectedEventIds.size})
                </button>

                <button
                  type="button"
                  className={`btn ${activeBatchAction === 'PRINT' ? 'btn-cyan' : 'btn-secondary'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    backgroundColor: activeBatchAction === 'PRINT' ? undefined : 'rgba(56, 189, 248, 0.12)',
                    borderColor: activeBatchAction === 'PRINT' ? undefined : 'rgba(56, 189, 248, 0.45)',
                    color: activeBatchAction === 'PRINT' ? undefined : '#38bdf8'
                  }}
                  onClick={() => {
                    setActiveBatchAction('PRINT');
                    handleBatchPrint();
                  }}
                >
                  <Printer size={16} /> Print Heat Sheet ({selectedEventIds.size})
                </button>



                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    backgroundColor: 'rgba(167, 139, 250, 0.12)',
                    borderColor: 'rgba(167, 139, 250, 0.45)',
                    color: '#a78bfa'
                  }}
                  onClick={handleDownloadMasterEventListCSV}
                  title="Download entire schedule as Excel CSV spreadsheet"
                >
                  <Download size={16} /> Download Excel / CSV
                </button>

                <button
                  type="button"
                  className={`btn ${activeBatchAction === 'REORDER' ? 'btn-yellow' : 'btn-secondary'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    backgroundColor: activeBatchAction === 'REORDER' ? undefined : 'rgba(192, 132, 252, 0.12)',
                    borderColor: activeBatchAction === 'REORDER' ? undefined : 'rgba(192, 132, 252, 0.45)',
                    color: activeBatchAction === 'REORDER' ? undefined : '#c084fc'
                  }}
                  onClick={() => {
                    setActiveBatchAction(prev => prev === 'REORDER' ? null : 'REORDER');
                  }}
                >
                  <GripVertical size={16} /> Change Order of the Event {activeBatchAction === 'REORDER' ? '(Drag Mode ON)' : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Event List Container */}
        {sortedEvents.length === 0 ? (
          <div className="glass-card text-center" style={{ padding: '3rem 1.5rem' }}>
            <Award size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>No Events Found</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Try adjusting your search query or gender/category filters.</p>
          </div>
        ) : (
          <div 
            style={{ 
              maxHeight: '620px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem', 
              paddingRight: '0.4rem' 
            }}
          >
            {(() => {
              const uncompletedEvents = sortedEvents.filter(ev => {
                const evHeats = eventHeatsMap.get(ev.id!) || [1];
                const areAllHeatsSaved = evHeats.length > 0 && evHeats.every(h => savedHeatKeys.has(`${ev.id}-${h}`));
                const isAutoCompleted = completedEventIds.has(ev.id!);
                const isManuallyDone = manuallyDoneEventIds.has(ev.id!);
                return !(isAutoCompleted || isManuallyDone || areAllHeatsSaved);
              });
              const ongoingEventId = uncompletedEvents.length > 0 ? uncompletedEvents[0].id : null;
              const upcomingEventId = uncompletedEvents.length > 1 ? uncompletedEvents[1].id : null;

              return sortedEvents.map((ev, index) => {
                const isSelected = expandedEventId === ev.id;
                const evHeats = eventHeatsMap.get(ev.id!) || [1];
                const areAllHeatsSaved = evHeats.length > 0 && evHeats.every(h => savedHeatKeys.has(`${ev.id}-${h}`));

                const isAutoCompleted = completedEventIds.has(ev.id!);
                const isManuallyDone = manuallyDoneEventIds.has(ev.id!);
                const isCompleted = isAutoCompleted || isManuallyDone || areAllHeatsSaved;
                const isOngoing = !isCompleted && ev.id === ongoingEventId;
                const isUpcoming = !isCompleted && ev.id === upcomingEventId;
                const isChecked = selectedEventIds.has(ev.id!);

                let showStatusBadge = false;
                let statusText = '';
                let statusBg = '';
                let statusColor = '';
                let statusBorder = '';
                let StatusIcon = Clock;

                if (isCompleted) {
                  showStatusBadge = true;
                  statusText = 'DONE';
                  statusBg = 'rgba(34, 197, 94, 0.25)';
                  statusColor = '#4ade80';
                  statusBorder = '1px solid #22c55e';
                  StatusIcon = CheckCircle2;
                } else if (isOngoing) {
                  showStatusBadge = true;
                  statusText = 'ONGOING';
                  statusBg = 'rgba(6, 182, 212, 0.2)';
                  statusColor = '#22d3ee';
                  statusBorder = '1px solid #06b6d4';
                  StatusIcon = PlayCircle;
                } else if (isUpcoming) {
                  showStatusBadge = true;
                  statusText = 'UPCOMING';
                  statusBg = 'rgba(148, 163, 184, 0.12)';
                  statusColor = '#94a3b8';
                  statusBorder = '1px solid rgba(148, 163, 184, 0.3)';
                  StatusIcon = Clock;
                }

              return (
              <div 
                key={ev.id} 
                className="glass-card" 
                draggable={isSelectMode || activeBatchAction === 'REORDER'}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                style={{ 
                  borderColor: isChecked
                    ? '#06b6d4'
                    : isCompleted 
                      ? '#22c55e' 
                      : isSelected 
                        ? 'var(--accent-yellow)' 
                        : 'var(--border-color)',
                  backgroundColor: isChecked
                    ? 'rgba(6, 182, 212, 0.12)'
                    : isCompleted 
                      ? 'rgba(34, 197, 94, 0.16)' 
                      : isSelected 
                        ? 'rgba(234, 179, 8, 0.05)' 
                        : 'rgba(15, 23, 42, 0.5)',
                  boxShadow: isChecked
                    ? '0 0 15px rgba(6, 182, 212, 0.25)'
                    : isCompleted 
                      ? '0 0 18px rgba(34, 197, 94, 0.25)' 
                      : isSelected 
                        ? '0 0 15px rgba(234, 179, 8, 0.2)' 
                        : 'none',
                  transition: 'all 0.2s ease',
                  marginBottom: 0
                }}
              >
                {/* Event Header Row */}
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelectEvent(ev.id!);
                    } else if (expandedEventId === ev.id) {
                      setExpandedEventId(null);
                    } else {
                      setExpandedEventId(ev.id!);
                      setExpandedHeatNum(1);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Checkbox for Batch Select Mode */}
                    {isSelectMode && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectEvent(ev.id!);
                        }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', paddingRight: '0.2rem' }}
                      >
                        {isChecked ? (
                          <CheckSquare size={22} style={{ color: '#06b6d4' }} />
                        ) : (
                          <Square size={22} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                    )}

                    {/* Drag Handle & Quick Reorder Buttons */}
                    {(isSelectMode || activeBatchAction === 'REORDER') && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'rgba(167, 139, 250, 0.12)',
                          border: '1px solid rgba(167, 139, 250, 0.35)',
                          padding: '0.25rem 0.45rem',
                          borderRadius: '8px',
                          cursor: 'grab'
                        }}
                        title="Drag card up or down to change event order"
                      >
                        <GripVertical size={18} style={{ color: '#c084fc' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <button
                            type="button"
                            style={{ border: 'none', background: 'transparent', color: '#c084fc', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            onClick={() => handleMoveEventPosition(index, 'UP')}
                            disabled={index === 0}
                            title="Move event UP"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            style={{ border: 'none', background: 'transparent', color: '#c084fc', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            onClick={() => handleMoveEventPosition(index, 'DOWN')}
                            disabled={index === sortedEvents.length - 1}
                            title="Move event DOWN"
                          >
                            <ArrowDown size={11} />
                          </button>
                        </div>
                      </div>
                    )}

                    <span 
                      style={{ 
                        background: isCompleted
                          ? 'rgba(34, 197, 94, 0.25)'
                          : isSelected 
                            ? 'var(--accent-yellow)' 
                            : 'rgba(56, 189, 248, 0.15)', 
                        color: isCompleted
                          ? '#4ade80'
                          : isSelected 
                            ? '#0f172a' 
                            : '#38bdf8', 
                        border: isCompleted
                          ? '1px solid #22c55e'
                          : isSelected
                            ? '1px solid var(--accent-yellow)'
                            : '1px solid rgba(56, 189, 248, 0.3)',
                        fontWeight: 800, 
                        padding: '0.35rem 0.65rem', 
                        borderRadius: '6px',
                        fontSize: '0.9rem'
                      }}
                    >
                      Event #{ev.eventNo || (index + 1)}
                    </span>

                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ev.distance}m {ev.stroke}
                        {(ev.ageGroup === 'All Age Groups' || ev.ageGroup?.toLowerCase().includes('merged') || (ev as any)?.isMerged) && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#0f172a', letterSpacing: '0.5px' }}>
                            🔀 MERGED
                          </span>
                        )}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <span>{ev.gender === 'M' ? 'Men' : 'Women'} ({ev.ageGroup})</span>
                        {(() => {
                          const evHeats = eventHeatsMap.get(ev.id!) || [1];
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.4rem' }}>
                              {evHeats.map(h => {
                                const isHeatDone = savedHeatKeys.has(`${ev.id}-${h}`);
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHeatDoneStatus(ev.id!, h);
                                    }}
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '0.15rem 0.55rem',
                                      borderRadius: '12px',
                                      backgroundColor: isHeatDone ? 'rgba(34, 197, 94, 0.22)' : 'rgba(234, 179, 8, 0.18)',
                                      color: isHeatDone ? '#4ade80' : '#fde047',
                                      border: isHeatDone ? '1px solid rgba(34, 197, 94, 0.6)' : '1px solid rgba(234, 179, 8, 0.45)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={isHeatDone ? `Heat ${h} is DONE (Click to unmark)` : `Click to mark Heat ${h} as DONE`}
                                  >
                                    {isHeatDone ? '✓ ' : ''}Heat {h}
                                  </button>
                                );
                              })}
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                  </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Event Status Badge Indicator */}
                      {showStatusBadge && (
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isCompleted) {
                              e.stopPropagation();
                              toggleSingleEventDoneStatus(ev.id!);
                            }
                          }}
                          style={{ 
                            background: statusBg, 
                            color: statusColor, 
                            border: statusBorder, 
                            fontWeight: 800, 
                            fontSize: '0.72rem', 
                            padding: '0.25rem 0.65rem', 
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            letterSpacing: '0.5px',
                            cursor: isCompleted ? 'pointer' : 'default'
                          }}
                          title={isCompleted ? "Click to UNMARK DONE (Remove Green Status)" : undefined}
                        >
                          <StatusIcon size={13} /> {statusText}
                        </button>
                      )}

                      <span className="pill-info" style={{ borderColor: 'rgba(234, 179, 8, 0.4)', color: '#fde047', fontWeight: 700 }}>
                        {heats.length > 0 && isSelected ? `${heats.length} Heat${heats.length > 1 ? 's' : ''}` : 'Tap to Expand'}
                      </span>
                      {isSelected ? <ChevronUp size={20} style={{ color: 'var(--accent-yellow)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </div>

                  {/* Expanded Heat Lane Assignments Section */}
                  {isSelected && (
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1rem', paddingTop: '1rem' }}>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--accent-yellow)' }}>
                            Lane Assignments — Event #{ev.eventNo || ev.id}: {ev.distance}m {ev.stroke}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {ev.gender === 'M' ? 'Men' : 'Women'} ({ev.ageGroup}) • Heat {expandedHeatNum}
                          </span>
                        </div>

                        {/* Heat Controls */}
                        <div className="flex gap-2 items-center">
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>HEAT:</span>
                          <div className="flex gap-1 items-center">
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {heats.map(h => {
                                const isSaved = savedHeatKeys.has(`${ev.id}-${h}`);
                                return (
                                  <button
                                    key={h}
                                    className={`btn ${expandedHeatNum === h ? 'btn-yellow' : (isSaved ? 'btn-success' : 'btn-secondary')}`}
                                    style={{
                                      padding: '0.35rem 0.75rem',
                                      fontSize: '0.85rem',
                                      backgroundColor: expandedHeatNum === h ? '#facc15' : (isSaved ? 'rgba(34, 197, 94, 0.22)' : undefined),
                                      borderColor: expandedHeatNum === h ? '#facc15' : (isSaved ? '#4ade80' : undefined),
                                      color: expandedHeatNum === h ? '#0f172a' : (isSaved ? '#4ade80' : undefined),
                                      fontWeight: isSaved || expandedHeatNum === h ? 800 : 600
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedHeatNum(h);
                                    }}
                                  >
                                    {isSaved ? '✓ ' : ''}Heat {h}
                                  </button>
                                );
                              })}
                            </div>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.35rem 0.6rem' }} 
                              onClick={(e) => {
                                e.stopPropagation();
                                addHeat();
                              }} 
                              title="Add New Heat"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.4)',
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              fontSize: '0.8rem',
                              padding: '0.35rem 0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 700
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintHeatSheet(ev.id!, expandedHeatNum);
                            }}
                            title={`Print Heat Start List for Heat ${expandedHeatNum} only`}
                          >
                            <Printer size={14} /> Print Heat {expandedHeatNum}
                          </button>

                          {heats.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                color: '#facc15',
                                borderColor: 'rgba(250, 204, 21, 0.4)',
                                backgroundColor: 'rgba(250, 204, 21, 0.1)',
                                fontSize: '0.8rem',
                                padding: '0.35rem 0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontWeight: 700
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintHeatSheet(ev.id!, 'ALL');
                              }}
                              title="Print Heat Start List for ALL heats"
                            >
                              <Printer size={14} /> Print All Heats ({heats.length})
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              color: '#c084fc',
                              borderColor: 'rgba(192, 132, 252, 0.4)',
                              backgroundColor: 'rgba(192, 132, 252, 0.1)',
                              fontSize: '0.8rem',
                              padding: '0.35rem 0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 700
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAutoSeedSpearhead(ev.id!, expandedHeatNum);
                            }}
                            title="Auto-seed swimmers into standard FINA Spearhead order: L4, L5, L3, L6, L2, L7, L1, L8"
                          >
                            <Zap size={14} /> Spearhead Auto-Seed
                          </button>

                          {laneAssignments.some(a => a.swimmerId) && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ color: 'var(--accent-red)', fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: 'rgba(239, 68, 68, 0.3)' }} 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearAllLanes();
                              }}
                              title="Clear all assigned swimmers from this heat"
                            >
                              <Trash2 size={14} /> Clear Heat
                            </button>
                          )}
                        </div>
                      </div>

                      {eligibleSwimmers.length === 0 && (
                        <div className="flex items-center gap-2 p-3 mb-4 text-amber" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.9rem' }}>
                          <ShieldAlert size={20} />
                          <span>No swimmers registered match the age group ({ev.ageGroup}) and gender ({ev.gender === 'M' ? 'Men' : 'Women'}) criteria. Go to Swimmer Registry tab to add participants!</span>
                        </div>
                      )}

                      {/* Quick Search Bar for Swimmer Selection */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#38bdf8' }} />
                          <input
                            type="text"
                            className="input-field"
                            style={{ paddingLeft: '2.4rem', fontSize: '0.85rem', width: '100%', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#f8fafc' }}
                            placeholder={`🔍 Quick Search unassigned ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup}) by Name, SFI UID, or Club...`}
                            value={swimmerSearchQuery}
                            onChange={(e) => setSwimmerSearchQuery(e.target.value)}
                          />
                        </div>
                        {swimmerSearchQuery && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', color: 'var(--accent-yellow)', borderColor: 'rgba(234, 179, 8, 0.3)' }}
                            onClick={() => setSwimmerSearchQuery('')}
                          >
                            Clear Search
                          </button>
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                          Available: {eligibleSwimmers.filter(s => !assignedSwimmerIdsForEvent.has(s.id!)).length} Swimmers
                        </span>
                      </div>

                      {/* 8 Lanes Scoreboard Grid */}
                      <div className="scoreboard-container" style={{ gap: '0.5rem' }}>
                        {laneAssignments.map(assignment => {
                          // Filter out swimmers who are ALREADY assigned to any heat in this event (unless assigned to this exact lane)
                          let availableSwimmers = eligibleSwimmers.filter(s => 
                            !assignedSwimmerIdsForEvent.has(s.id!) || s.id === assignment.swimmerId
                          );

                          if (swimmerSearchQuery.trim()) {
                            const q = swimmerSearchQuery.toLowerCase().trim();
                            availableSwimmers = availableSwimmers.filter(s => 
                              s.name.toLowerCase().includes(q) ||
                              (s.sfiUid && s.sfiUid.toLowerCase().includes(q)) ||
                              (s.club && s.club.toLowerCase().includes(q)) ||
                              s.id === assignment.swimmerId
                            );
                          }

                          const selectOptions = [
                            { value: '', label: '[ Empty Lane ]' },
                            ...availableSwimmers.map(swimmer => ({
                              value: swimmer.id!,
                              label: `${swimmer.sfiUid ? `[${swimmer.sfiUid}] ` : ''}${swimmer.name} (${swimmer.gender === 'M' ? 'Men' : 'Women'}) (${swimmer.club || 'No Club'})`
                            })),
                            ...(assignment.swimmerId && !availableSwimmers.find(s => s.id === assignment.swimmerId)
                              ? [{ value: assignment.swimmerId, label: getSwimmerName(assignment.swimmerId) }]
                              : [])
                          ];

                          return (
                          <div 
                            key={assignment.laneNumber} 
                            className="lane-card"
                            style={{ 
                              gridTemplateColumns: '60px 100px 1fr', 
                              padding: '0.6rem 1rem',
                              borderLeftColor: assignment.swimmerId ? 'var(--accent-cyan)' : 'var(--border-color)',
                              position: 'relative',
                              zIndex: 20 - assignment.laneNumber
                            }}
                          >
                            <div className="lane-number-badge" style={{ width: '32px', height: '32px', fontSize: '1.25rem' }}>
                              {assignment.laneNumber}
                            </div>
                            
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Lane {assignment.laneNumber}
                            </span>

                            <div className="flex gap-2 items-center" style={{ width: '100%' }}>
                              <CustomSelect
                                style={{ flex: 1 }}
                                value={assignment.swimmerId || ''}
                                placeholder="[ Empty Lane ]"
                                onChange={(val) => handleLaneChange(assignment.laneNumber, val)}
                                options={selectOptions}
                              />

                              {assignment.swimmerId && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ 
                                    padding: '0.45rem 0.75rem', 
                                    color: 'var(--accent-red)', 
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontSize: '0.8rem'
                                  }}
                                  title="Remove swimmer from lane"
                                  onClick={() => handleLaneChange(assignment.laneNumber, '')}
                                >
                                  <UserX size={15} /> Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </div>

                      <div className="flex justify-between items-center mt-4">
                        <span className="pill-info">
                          <Users size={14} /> Total Eligible Swimmers: {eligibleSwimmers.length}
                        </span>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          * Assigning a swimmer automatically saves the changes. Empty lanes will not receive timing updates.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
          </div>
        )}
      </div>
    </div>

    {/* Confirmation Modals */}
    <ConfirmationModal
      isOpen={showDeleteMeetConfirm}
      title="Delete Swim Meet"
      message={`Are you sure you want to delete "${meets.find(m => m.id === selectedMeetId)?.name}"? All events, lane assignments, and registered swimmers for this meet will be permanently removed.`}
      confirmLabel="Delete Meet"
      cancelLabel="Cancel"
      onConfirm={handleConfirmDeleteMeet}
      onCancel={() => setShowDeleteMeetConfirm(false)}
    />

    <ConfirmationModal
      isOpen={showDeleteEventConfirm}
      title="Delete Competition Event"
      message={`Are you sure you want to delete Event #${selectedEventId}? All lane assignments and heat timing results for this event will be permanently deleted.`}
      confirmLabel="Delete Event"
      cancelLabel="Cancel"
      onConfirm={handleConfirmDeleteEvent}
      onCancel={() => setShowDeleteEventConfirm(false)}
    />

    {/* Merge Options Modal Popup */}
    {showMergeModal && createPortal(
      <div 
        className="modal-overlay"
        onClick={() => setShowMergeModal(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
      >
        <div 
          className="glass-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '90%',
            maxWidth: '520px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: '1px solid rgba(250, 204, 21, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(250, 204, 21, 0.2)',
            borderRadius: '16px',
            padding: '1.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#facc15', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitMerge size={22} /> Event & Heat Merge Options
            </h3>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
              onClick={() => setShowMergeModal(false)}
            >
              ✕
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
            Select a merge mode below to configure heat or event consolidation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* 1. HEAT Merger */}
            <button
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.2rem',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                textAlign: 'left'
              }}
              onClick={() => {
                setSelectedMergeType('HEAT');
                alert('HEAT Merger option selected!');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Layers size={22} />
                <div>
                  <div>HEAT Merger</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Consolidate sparse heats within an event</div>
                </div>
              </div>
              <span style={{ fontSize: '1.2rem' }}>➔</span>
            </button>

            {/* 2. Men & Women Merge */}
            <button
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.2rem',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#f472b6',
                borderColor: 'rgba(244, 114, 182, 0.4)',
                backgroundColor: 'rgba(244, 114, 182, 0.1)',
                textAlign: 'left'
              }}
              onClick={() => {
                setSelectedMergeType('GENDER');
                alert('Men and Women Merge option selected!');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={22} />
                <div>
                  <div>Men & Women Merge</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Combine Men and Women divisions into mixed heats</div>
                </div>
              </div>
              <span style={{ fontSize: '1.2rem' }}>➔</span>
            </button>

            {/* 3. Event Merge */}
            <button
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.2rem',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#facc15',
                borderColor: 'rgba(250, 204, 21, 0.4)',
                backgroundColor: 'rgba(250, 204, 21, 0.1)',
                textAlign: 'left'
              }}
              onClick={() => {
                setSelectedMergeType('EVENT');
                alert('Event Merge option selected!');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={22} />
                <div>
                  <div>Event Merge</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Merge multiple events into a single race card</div>
                </div>
              </div>
              <span style={{ fontSize: '1.2rem' }}>➔</span>
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowMergeModal(false)}
              style={{ padding: '0.4rem 1rem' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
}
