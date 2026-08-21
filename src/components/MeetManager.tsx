import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Meet, type Event, Swimmer, LaneAssignment, seedDatabase, AgeGroup } from '../db';
import { Calendar, Plus, Users, Award, ShieldAlert, UserX, Trash2, Edit, Save, RotateCcw, ChevronDown, ChevronUp, Search, ListFilter, PlayCircle, CheckCircle2, Clock, GitMerge, Layers, Printer, Zap, Download, CheckSquare, Square, GripVertical, ArrowUp, ArrowDown, ListChecks, X, Waves, UploadCloud, FolderOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import HoverScrollText from './HoverScrollText';
import SmartImportModal from './SmartImportModal';
import { LOGO_BASE64 } from '../utils/logoBase64';
import { TSA_LOGO_BASE64, SAT_LOGO_BASE64 } from '../utils/reportLogos';
import { printHtmlDocument } from '../utils/printHelper';
import { syncMeetEventsToDisk } from '../utils/eventStorage';

interface MeetManagerProps {
  activeMeetId?: number | null;
  setActiveMeetId?: (id: number | null) => void;
  activeEventId?: number | null;
  setActiveEventId?: (id: number | null) => void;
  activeHeatNum?: number;
  setActiveHeatNum?: (num: number) => void;
}

const ALL_AGE_GROUPS: AgeGroup[] = [
  'Group A (15-17)', 'Group B (12-14)', 'Group C (10-11)', 'Group D (8-9)',
  'Group A', 'Group B', 'Group C', 'Group D',
  'Group I', 'Group II', 'Group III', 'Group IV',
  '25-29', '30-34', '35-39', '40-44', '45-49',
  '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80 & above',
  'All Age Groups'
];

export interface PresetEventOption {
  id: string;
  distance: number;
  stroke: Event['stroke'];
  label: string;
  enabled: boolean;
}

export const DEFAULT_PRESET_EVENTS: PresetEventOption[] = [
  // Freestyle
  { id: 'free-50', distance: 50, stroke: 'Freestyle', label: '50m Free', enabled: true },
  { id: 'free-100', distance: 100, stroke: 'Freestyle', label: '100m Free', enabled: true },
  { id: 'free-200', distance: 200, stroke: 'Freestyle', label: '200m Free', enabled: true },
  { id: 'free-400', distance: 400, stroke: 'Freestyle', label: '400m Free', enabled: true },
  { id: 'free-800', distance: 800, stroke: 'Freestyle', label: '800m Free', enabled: true },
  { id: 'free-1500', distance: 1500, stroke: 'Freestyle', label: '1500m Free', enabled: true },

  // Backstroke
  { id: 'back-50', distance: 50, stroke: 'Backstroke', label: '50m Back', enabled: true },
  { id: 'back-100', distance: 100, stroke: 'Backstroke', label: '100m Back', enabled: true },
  { id: 'back-200', distance: 200, stroke: 'Backstroke', label: '200m Back', enabled: true },

  // Breaststroke
  { id: 'breast-50', distance: 50, stroke: 'Breaststroke', label: '50m Breast', enabled: true },
  { id: 'breast-100', distance: 100, stroke: 'Breaststroke', label: '100m Breast', enabled: true },
  { id: 'breast-200', distance: 200, stroke: 'Breaststroke', label: '200m Breast', enabled: true },

  // Butterfly
  { id: 'fly-50', distance: 50, stroke: 'Butterfly', label: '50m Fly', enabled: true },
  { id: 'fly-100', distance: 100, stroke: 'Butterfly', label: '100m Fly', enabled: true },
  { id: 'fly-200', distance: 200, stroke: 'Butterfly', label: '200m Fly', enabled: true },

  // Individual Medley
  { id: 'im-200', distance: 200, stroke: 'Individual Medley', label: '200m IM', enabled: true },
  { id: 'im-400', distance: 400, stroke: 'Individual Medley', label: '400m IM', enabled: true }
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

  useEffect(() => {
    loadMeets();
  }, []);

  const loadMeets = async (preferredMeetId?: number) => {
    try {
      let list = await db.meets.toArray();
      if (list.length === 0) {
        await seedDatabase(true);
        list = await db.meets.toArray();
      }
      setMeets(list);
      if (list.length > 0) {
        const targetId = preferredMeetId !== undefined 
          ? preferredMeetId 
          : ((selectedMeetId && list.some(m => m.id === selectedMeetId)) 
            ? selectedMeetId 
            : ((activeMeetId !== undefined && activeMeetId !== null && list.some(m => m.id === activeMeetId)) ? activeMeetId : list[0].id!));
        setSelectedMeetId(targetId);
        if (setActiveMeetId && activeMeetId !== targetId) setActiveMeetId(targetId);
        await loadEvents(targetId);
        await loadAllSwimmers(targetId);
      }
    } catch (e) {
      console.error('Error loading meets in MeetManager:', e);
    }
  };
  
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
  const [mainListGender, setMainListGender] = useState<string>('All');
  const [mainListCategory, setMainListCategory] = useState<string>('All');

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
    if (genderVal === 'All') return;
    const targetEv = events.find(e => e.gender === genderVal && !completedEventIds.has(e.id!) && !manuallyDoneEventIds.has(e.id!)) 
      || events.find(e => e.gender === genderVal);
    if (targetEv && targetEv.id) {
      setSelectedEventId(targetEv.id);
    }
  };

  const handleSchedulerCategoryChange = (catVal: string) => {
    if (catVal === 'All') return;
    const targetEv = events.find(e => {
      const isMerged = e.ageGroup === 'All Age Groups' || e.ageGroup?.toLowerCase().includes('merged');
      const matchCat = catVal === 'Merged' ? isMerged : e.ageGroup === catVal;
      return matchCat && !completedEventIds.has(e.id!) && !manuallyDoneEventIds.has(e.id!);
    }) || events.find(e => {
      const isMerged = e.ageGroup === 'All Age Groups' || e.ageGroup?.toLowerCase().includes('merged');
      return catVal === 'Merged' ? isMerged : e.ageGroup === catVal;
    });
    if (targetEv && targetEv.id) {
      setSelectedEventId(targetEv.id);
    }
  };

  // Meet Create & Setup Wizard Form State
  const [meetName, setMeetName] = useState('');
  const [meetDate, setMeetDate] = useState('');
  const [meetLocation, setMeetLocation] = useState('');
  const [meetPoolType, setMeetPoolType] = useState<'50m' | '25m'>('50m');
  const [meetLanes, setMeetLanes] = useState<number>(8); // Default is 8 lanes!
  const [meetCategoryPreset, setMeetCategoryPreset] = useState<'masters' | 'juniors' | 'open'>('masters');
  const [meetAffiliationType, setMeetAffiliationType] = useState<'District' | 'State' | 'Club'>('District');
  const [meetAutoEvents, setMeetAutoEvents] = useState<boolean>(true);
  const [presetEvents, setPresetEvents] = useState<PresetEventOption[]>(DEFAULT_PRESET_EVENTS);

  const togglePresetEvent = (id: string) => {
    setPresetEvents(prev => prev.map(pe => pe.id === id ? { ...pe, enabled: !pe.enabled } : pe));
  };

  const selectAllPresetEvents = (enabled: boolean) => {
    setPresetEvents(prev => prev.map(pe => ({ ...pe, enabled })));
  };

  const [showImportModal, setShowImportModal] = useState<boolean>(false);

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

  const loadCompletedEvents = async (overrideSelectedEventId?: number | null, overrideSelectedHeatNum?: number) => {
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
        const evId = Number(a.eventId);
        if (!totalHeatsMap.has(evId)) totalHeatsMap.set(evId, new Set());
        if (a.heatNumber) totalHeatsMap.get(evId)!.add(Number(a.heatNumber));
      }
    });

    const dbEvs = selectedMeetId 
      ? await db.events.where('meetId').equals(selectedMeetId).toArray()
      : await db.events.toArray();
    dbEvs.sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));

    const doneIds = new Set<number>();
    const heatsListMap = new Map<number, number[]>();

    dbEvs.forEach(ev => {
      if (!ev.id) return;
      const evId = Number(ev.id);
      const assignedSet = totalHeatsMap.get(evId);
      const savedSet = savedHeatsMap.get(evId);

      const combinedHeats = new Set<number>();
      if (assignedSet) assignedSet.forEach(h => combinedHeats.add(h));
      if (savedSet) savedSet.forEach(h => combinedHeats.add(h));
      if (combinedHeats.size === 0) combinedHeats.add(1);

      const heatArray = Array.from(combinedHeats).sort((a, b) => a - b);
      heatsListMap.set(evId, heatArray);

      if (savedSet && savedSet.size > 0) {
        const allSaved = heatArray.every(h => savedSet.has(h));
        if (allSaved) {
          doneIds.add(evId);
        }
      }
    });

    setEventHeatsMap(heatsListMap);
    setCompletedEventIds(doneIds);
    setSavedHeatKeys(heatKeys);

    // If an explicit override was provided by toggleHeatDoneStatus, use it directly
    if (overrideSelectedEventId !== undefined) {
      if (overrideSelectedEventId !== null) {
        setSelectedEventId(overrideSelectedEventId);
        if (overrideSelectedHeatNum !== undefined) {
          setSelectedHeatNum(overrideSelectedHeatNum);
        }
      }
      return;
    }

    if (dbEvs.length > 0) {
      const isDoneEvent = (eId: number) => {
        const evHeats = heatsListMap.get(eId) || [1];
        // The core rule: An event is ONLY done when ALL of its heats have been swum/saved!
        return evHeats.length > 0 && evHeats.every(h => heatKeys.has(`${eId}-${h}`));
      };

      // Find the first ongoing uncompleted event in strict schedule order
      const firstOngoing = dbEvs.find(e => e.id && !isDoneEvent(e.id)) || dbEvs[0];

      if (firstOngoing && firstOngoing.id) {
        const firstOngoingIdx = dbEvs.findIndex(e => e.id === firstOngoing.id);
        const currentSelectedIdx = selectedEventId ? dbEvs.findIndex(e => e.id === selectedEventId) : -1;

        // If no selection, or current selection is done, or current selection jumped ahead of earlier uncompleted events:
        if (!selectedEventId || isDoneEvent(selectedEventId) || (currentSelectedIdx > firstOngoingIdx)) {
          setSelectedEventId(firstOngoing.id);
          const heats = heatsListMap.get(firstOngoing.id) || [1];
          const firstUnsaved = heats.find(h => !heatKeys.has(`${firstOngoing.id}-${h}`)) || 1;
          setSelectedHeatNum(firstUnsaved);
        } else {
          const heats = heatsListMap.get(selectedEventId) || [1];
          const nextUnsaved = heats.find(h => !heatKeys.has(`${selectedEventId}-${h}`)) || heats[0];
          setSelectedHeatNum(nextUnsaved);
        }
      }
    }
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
    list.sort((a, b) => (a.eventNo || a.id || 0) - (b.eventNo || b.id || 0));
    setEvents(list);

    const isValidActive = selectedEventId && list.some(e => e.id === selectedEventId);
    if (!isValidActive && list.length > 0) {
      const firstOngoing = list.find(e => e.id && !completedEventIds.has(e.id) && !manuallyDoneEventIds.has(e.id));
      const targetId = firstOngoing ? firstOngoing.id! : list[0].id!;
      setSelectedEventId(targetId);
      setSelectedHeatNum(1);
    }
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
    const evHeats = eventHeatsMap.get(eventId) || [1];
    const wasEventFullyDone = evHeats.every(h => savedHeatKeys.has(`${eventId}-${h}`));

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

    // Re-check this event's completion against the DB we just wrote to, then
    // move the active event/heat to match: finishing the active event's last
    // heat advances to the next ongoing event, while un-marking a heat that
    // had completed the event brings that event back into focus.
    const remainingResults = await db.results.where('eventId').equals(eventId).toArray();
    const doneHeats = new Set(remainingResults.map(r => r.heatNumber));
    const isEventFullyDoneNow = evHeats.every(h => doneHeats.has(h));

    let overrideEventId: number | null | undefined = undefined;
    let overrideHeatNum: number | undefined = undefined;

    if (wasEventFullyDone && !isEventFullyDoneNow) {
      // Event was fully done, now un-done: jump back to this event
      const firstUndone = evHeats.find(h => !doneHeats.has(h)) || heatNum;
      overrideEventId = eventId;
      overrideHeatNum = firstUndone;
    } else if (!wasEventFullyDone && isEventFullyDoneNow && eventId === selectedEventId) {
      // Active event just finished: jump to next ongoing event
      const currentIdx = events.findIndex(e => e.id === eventId);
      const isOtherOngoing = (e: any) => !!e.id && e.id !== eventId && !completedEventIds.has(e.id) && !manuallyDoneEventIds.has(e.id);
      const nextOngoing = events.find((e, idx) => idx > currentIdx && isOtherOngoing(e)) || events.find(isOtherOngoing);
      if (nextOngoing && nextOngoing.id) {
        overrideEventId = nextOngoing.id;
        overrideHeatNum = 1;
      }
    } else if (!wasEventFullyDone && !isEventFullyDoneNow && eventId === selectedEventId) {
      // Heat within active event just completed — advance to next unsaved heat
      const nextUnsaved = evHeats.find(h => !doneHeats.has(h));
      if (nextUnsaved) {
        overrideEventId = eventId;
        overrideHeatNum = nextUnsaved;
      }
    }

    await loadCompletedEvents(overrideEventId, overrideHeatNum);
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

    if (isDone) {
      // Was done, just undone: bring it back into focus as the active event.
      setSelectedEventId(eventId);
      setSelectedHeatNum(1);
    } else if (eventId === selectedEventId) {
      // Was the active event and just got marked done: advance to the next one.
      const currentIdx = events.findIndex(e => e.id === eventId);
      const isOtherOngoing = (e: Event) => !!e.id && e.id !== eventId && !completedEventIds.has(e.id) && !nextManual.has(e.id);
      const nextOngoing = events.find((e, idx) => idx > currentIdx && isOtherOngoing(e)) || events.find(isOtherOngoing);
      if (nextOngoing && nextOngoing.id) {
        setSelectedEventId(nextOngoing.id);
        setSelectedHeatNum(1);
      }
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

    if (allSelectedAreDone) {
      // These were done, just undone: bring the first of them back into focus.
      const target = events.find(e => e.id && selectedIds.includes(e.id));
      if (target && target.id) {
        setSelectedEventId(target.id);
        setSelectedHeatNum(1);
      }
    } else if (selectedEventId && selectedIds.includes(selectedEventId)) {
      // The active event was part of the batch just marked done: advance.
      const currentIdx = events.findIndex(e => e.id === selectedEventId);
      const isOtherOngoing = (e: Event) => !!e.id && !nextManual.has(e.id) && !completedEventIds.has(e.id);
      const nextOngoing = events.find((e, idx) => idx > currentIdx && isOtherOngoing(e)) || events.find(isOtherOngoing);
      if (nextOngoing && nextOngoing.id) {
        setSelectedEventId(nextOngoing.id);
        setSelectedHeatNum(1);
      }
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
          <div class="heat-page" style="margin-bottom: 20px; break-inside: avoid;">
            <div class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 105px; flex-shrink: 0;">
                <img src="${TSA_LOGO_BASE64}" width="100" height="100" style="object-fit: contain;" alt="TSA" />
              </div>

              <div style="flex: 1; text-align: center; padding: 0 14px;">
                <h1 style="font-size: 15pt; margin: 0 0 2px 0; color: #0f172a; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px;">${meetNameStr}</h1>
                <h2 style="font-size: 11.5pt; margin: 0 0 2px 0; color: #0284c7; font-weight: 800;">OFFICIAL HEAT START LIST — HEAT ${hNum} OF ${heatNumbers.length}</h2>
                <div style="font-size: 9pt; font-weight: 700; color: #334155;">
                  Event #${ev.eventNo || ev.id}: ${ev.distance}m ${ev.stroke} • ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})
                </div>
                <div style="font-size: 8pt; color: #64748b; margin-top: 3px;">
                  Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: center; width: 120px; flex-shrink: 0;">
                <img src="${SAT_LOGO_BASE64}" width="118" height="118" style="object-fit: contain;" alt="SAT" />
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

            <div style="margin-top: 35px; border-top: 1.5px dashed #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 45px;">
              <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <img src="${LOGO_BASE64}" width="50" height="50" style="object-fit: contain;" alt="TouchTeck" />
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
                <div style="width: 150px; border-top: 1.5px solid #0f172a; text-align: center; font-size: 8.5pt; font-weight: 700; color: #0f172a; padding-top: 4px;">Meet Official</div>
                <div style="width: 150px; border-top: 1.5px solid #0f172a; text-align: center; font-size: 8.5pt; font-weight: 700; color: #0f172a; padding-top: 4px;">TouchTeck Official</div>
              </div>
            </div>
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
      <div class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; justify-content: center; width: 55px; flex-shrink: 0;">
          <img src="${TSA_LOGO_BASE64}" width="50" height="50" style="object-fit: contain;" alt="TSA" />
        </div>

        <div style="flex: 1; text-align: center; padding: 0 10px;">
          <h1 style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a;">${meetNameStr}</h1>
          <h2 style="font-size: 11px; font-weight: 700; color: #0284c7; margin: 2px 0 0 0;">OFFICIAL MASTER MEET START LIST (PAPER-SAVER SUMMARY) — ${selectedEvs.length} EVENTS</h2>
          <div style="font-size: 8px; color: #64748b; margin-top: 2px;">
            Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; width: 55px; flex-shrink: 0;">
          <img src="${SAT_LOGO_BASE64}" width="50" height="50" style="object-fit: contain;" alt="SAT" />
        </div>
      </div>

      <div class="compact-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        ${masterHtml}
      </div>

      <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <img src="${LOGO_BASE64}" width="22" height="22" style="object-fit: contain;" alt="TouchTeck" />
          <span style="font-size: 7pt; font-weight: 900; color: #0891b2; letter-spacing: 1px; text-transform: uppercase;">TOUCHTECK TIMING</span>
        </div>
        <div style="font-size: 7.5pt; color: #64748b;">Official Championship Paper-Saver Summary</div>
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
    setMeetPoolType(current.poolType || '50m');
    setMeetLanes(current.lanes || 8);
    setMeetCategoryPreset(current.categoryPreset || 'masters');
    setMeetAffiliationType(current.affiliationType || 'District');
    setMeetAutoEvents(false);
    setIsCreatingMeet(true);
  };

  const handleCancelEditMeet = () => {
    setEditingMeetId(null);
    setIsCreatingMeet(false);
    setMeetName('');
    setMeetLocation('');
    setMeetDate('');
    setMeetAffiliationType('District');
  };

  const handleSaveMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetName.trim()) return;

    if (editingMeetId) {
      await db.meets.update(editingMeetId, {
        name: meetName,
        date: meetDate || new Date().toISOString().split('T')[0],
        location: meetLocation,
        poolType: meetPoolType,
        lanes: meetLanes,
        categoryPreset: meetCategoryPreset,
        affiliationType: meetAffiliationType
      });
      setEditingMeetId(null);
    } else {
      const id = await db.meets.add({
        name: meetName,
        date: meetDate || new Date().toISOString().split('T')[0],
        location: meetLocation,
        poolType: meetPoolType,
        lanes: meetLanes,
        categoryPreset: meetCategoryPreset,
        affiliationType: meetAffiliationType
      });
      const newMeetId = Number(id);
      setSelectedMeetId(newMeetId);
      if (setActiveMeetId) setActiveMeetId(newMeetId);

      // Auto-generate standard competition event list if selected
      if (meetAutoEvents) {
        const selectedPresetEvents = presetEvents.filter(pe => pe.enabled);
        let eventNumber = 1;
        if (meetCategoryPreset === 'juniors') {
          const juniorGroups = ['Group A', 'Group B', 'Group C', 'Group D'];
          for (const ev of selectedPresetEvents) {
            for (const grp of juniorGroups) {
              for (const g of ['M', 'F'] as ('M' | 'F')[]) {
                await db.events.add({
                  meetId: newMeetId,
                  eventNo: eventNumber,
                  distance: ev.distance,
                  stroke: ev.stroke,
                  gender: g,
                  ageGroup: grp
                });
                eventNumber++;
              }
            }
          }
        } else {
          for (const ev of selectedPresetEvents) {
            for (const g of ['M', 'F'] as ('M' | 'F')[]) {
              await db.events.add({
                meetId: newMeetId,
                eventNo: eventNumber,
                distance: ev.distance,
                stroke: ev.stroke,
                gender: g,
                ageGroup: meetCategoryPreset === 'open' ? 'Open' : (meetCategoryPreset === 'masters' ? 'Masters' : 'Open')
              });
              eventNumber++;
            }
          }
        }
      }
      setIsCreatingMeet(false);
      setMeetName('');
      setMeetLocation('');
      setMeetDate('');
      await loadMeets(newMeetId);
    }
  };

  const [isDeletingMeet, setIsDeletingMeet] = useState<boolean>(false);

  const handleConfirmDeleteMeet = async () => {
    if (!selectedMeetId || isDeletingMeet) return;
    const targetMeetId = selectedMeetId;
    setIsDeletingMeet(true);
    setShowDeleteMeetConfirm(false);

    try {
      await db.meets.delete(targetMeetId);
      const eventsToDelete = await db.events.where('meetId').equals(targetMeetId).toArray();
      for (const ev of eventsToDelete) {
        if (ev.id) {
          await db.laneAssignments.where('eventId').equals(ev.id).delete();
          await db.results.where('eventId').equals(ev.id).delete();
          await db.events.delete(ev.id);
        }
      }
      await db.swimmers.where('meetId').equals(targetMeetId).delete();
      setSelectedMeetId(null);
      setSelectedEventId(null);
      setSelectedHeatNum(1);
      await loadMeets();
      window.dispatchEvent(new Event('lane-assignments-updated'));
    } catch (err) {
      console.error('Error deleting meet:', err);
    } finally {
      setIsDeletingMeet(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetId) return;

    const existingEvents = await db.events.where('meetId').equals(selectedMeetId).toArray();
    const nextEventNo = existingEvents.length > 0 ? Math.max(...existingEvents.map(e => e.eventNo || 0)) + 1 : 1;

    const newId = await db.events.add({
      meetId: selectedMeetId,
      eventNo: nextEventNo,
      distance: Number(distance),
      stroke,
      gender,
      ageGroup
    });

    const laneCount = meets.find(m => m.id === selectedMeetId)?.lanes || 8;
    for (let lane = 1; lane <= laneCount; lane++) {
      await db.laneAssignments.add({
        eventId: Number(newId),
        heatNumber: 1,
        laneNumber: lane,
        swimmerId: undefined
      });
    }

    setIsCreatingEvent(false);
    await loadEvents(selectedMeetId);
    await loadCompletedEvents();
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
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

  const addHeat = async () => {
    if (!expandedEventId) return;
    const currentHeats = heats.length > 0 ? heats : (eventHeatsMap.get(expandedEventId) || [1]);
    const nextHeat = Math.max(1, ...currentHeats) + 1;

    // Persist 8 empty lanes for the new heat in db.laneAssignments so it is permanently saved in the database
    for (let lane = 1; lane <= 8; lane++) {
      await db.laneAssignments.add({
        eventId: expandedEventId,
        heatNumber: nextHeat,
        laneNumber: lane,
        swimmerId: undefined
      });
    }

    setExpandedHeatNum(nextHeat);
    await loadHeatsAndAssignments(expandedEventId, nextHeat);
    await loadCompletedEvents();
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
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
    try {
      const newMeetId = await seedDatabase(true);
      const allMeets = await db.meets.toArray();
      setMeets(allMeets);
      const targetId = newMeetId || allMeets[0]?.id || 1;
      setSelectedMeetId(targetId);
      if (setActiveMeetId) setActiveMeetId(targetId);
      await loadEvents(targetId);
      await loadAllSwimmers(targetId);
    } catch (e) {
      console.error('Error in handleResetDemoData:', e);
    }
  };

  const filteredEvents = events.filter(ev => {
    const matchG = !mainListGender || mainListGender === 'All' || ev.gender === mainListGender;
    const isMergedEvent = ev.ageGroup === 'All Age Groups' || ev.ageGroup?.toLowerCase().includes('merged') || (ev as any)?.isMerged;
    const matchC = !mainListCategory || mainListCategory === 'All' 
      || (mainListCategory === 'Merged' ? isMergedEvent : ev.ageGroup === mainListCategory);
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
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', overflow: 'hidden' }}>
      
      {/* Sidebar: Meet and Event configuration */}
      <div className="flex flex-col gap-4" style={{ minWidth: 0, overflow: 'hidden' }}>
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
                const newMeetId = Number(val);
                setSelectedMeetId(newMeetId);
                if (setActiveMeetId) setActiveMeetId(newMeetId);
              }}
            />
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderStyle: 'dashed' }}
              onClick={() => {
                setEditingMeetId(null);
                setMeetName('');
                setMeetLocation('');
                setMeetDate(new Date().toISOString().split('T')[0]);
                setMeetPoolType('50m');
                setMeetLanes(8);
                setMeetCategoryPreset('masters');
                setMeetAutoEvents(true);
                setIsCreatingMeet(true);
              }}
            >
              <Plus size={16} /> Create New Meet
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.45)', fontWeight: 800, background: 'rgba(250, 204, 21, 0.1)' }}
              onClick={() => setShowImportModal(true)}
              title="Import Excel, CSV, or Event JSON files into this meet"
            >
              <UploadCloud size={16} /> Import File
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)', fontWeight: 700 }}
              onClick={async () => {
                const activeMeetObj = meets.find(m => m.id === selectedMeetId);
                if (selectedMeetId) {
                  await syncMeetEventsToDisk(selectedMeetId);
                }
                if (window.touchteckApp?.openDataFolder) {
                  window.touchteckApp.openDataFolder(activeMeetObj?.name);
                }
              }}
              title="Open Meet Data Folder in Windows Explorer"
            >
              <FolderOpen size={15} /> Open Meet Folder
            </button>
          </div>
        </div>

        {/* Event Scheduler Card */}
        {selectedMeetId && (
          <div className="glass-card">
            <h3 className="settings-header"><Award size={18} /> Event Scheduler</h3>
            
            {/* Live Feed Gender & Category for Event Scheduler */}
            {(() => {
              const activeEvObj = events.find(e => e.id === selectedEventId);
              const isMergedActive = activeEvObj ? (activeEvObj.ageGroup === 'All Age Groups' || activeEvObj.ageGroup?.toLowerCase().includes('merged') || (activeEvObj as any)?.isMerged) : false;
              const activeGenderVal = activeEvObj ? activeEvObj.gender : 'M';
              const activeCategoryVal = activeEvObj ? (isMergedActive ? 'Merged' : activeEvObj.ageGroup) : '';

              // Collect all unique categories present in the meet's events
              const meetEventCategories = Array.from(new Set(events.map(e => e.ageGroup).filter(Boolean)));
              const allCategoriesList = Array.from(new Set([
                ...meetEventCategories,
                ...ALL_AGE_GROUPS
              ]));

              const categoryOptions = [
                { value: 'Merged', label: 'Merged (All Categories)' },
                ...allCategoriesList.map(ag => ({ value: ag, label: ag }))
              ];

              const onSchedulerGenderChange = (newGender: 'M' | 'F') => {
                if (!newGender) return;
                const match = events.find(e => e.gender === newGender && (activeCategoryVal ? e.ageGroup === activeCategoryVal : true))
                  || events.find(e => e.gender === newGender);
                if (match && match.id) {
                  setSelectedEventId(match.id);
                  setSelectedHeatNum(1);
                }
              };

              const onSchedulerCategoryChange = (newCat: string) => {
                if (!newCat) return;
                const match = events.find(e => (newCat === 'Merged' ? (e.ageGroup === 'All Age Groups' || e.ageGroup?.toLowerCase().includes('merged')) : e.ageGroup === newCat) && (activeGenderVal ? e.gender === activeGenderVal : true))
                  || events.find(e => newCat === 'Merged' ? (e.ageGroup === 'All Age Groups' || e.ageGroup?.toLowerCase().includes('merged')) : e.ageGroup === newCat);
                if (match && match.id) {
                  setSelectedEventId(match.id);
                  setSelectedHeatNum(1);
                }
              };

              return (
                <div className="form-row mb-3">
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GENDER</label>
                    <CustomSelect
                      options={[
                        { value: 'M', label: 'Men' },
                        { value: 'F', label: 'Women' }
                      ]}
                      value={activeGenderVal}
                      onChange={(val) => onSchedulerGenderChange(val as 'M' | 'F')}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CATEGORY / GROUP</label>
                    <CustomSelect
                      options={categoryOptions}
                      value={activeCategoryVal}
                      placeholder="Select Category..."
                      onChange={(val) => onSchedulerCategoryChange(val)}
                    />
                  </div>
                </div>
              );
            })()}

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

              {(() => {
                const currentEvIndex = events.findIndex(e => e.id === selectedEventId);
                const hasPrevEv = currentEvIndex > 0;
                const hasNextEv = currentEvIndex >= 0 && currentEvIndex < events.length - 1;
                const activeEventHeats = selectedEventId ? (eventHeatsMap.get(selectedEventId) || [1]) : [1];

                return (
                  <>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                        disabled={!hasPrevEv}
                        onClick={() => {
                          if (hasPrevEv) {
                            const prevEv = events[currentEvIndex - 1];
                            setSelectedEventId(prevEv.id!);
                            setSelectedHeatNum(1);
                          }
                        }}
                        title="Previous Event"
                      >
                        ◀
                      </button>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <CustomSelect
                          options={events.map(ev => {
                            const isDone = completedEventIds.has(ev.id!) || manuallyDoneEventIds.has(ev.id!);
                            const isCurrentlyActive = ev.id === selectedEventId;
                            const statusTag = isDone ? '✓ [DONE]' : (isCurrentlyActive ? '● [ACTIVE]' : '');
                            return {
                              value: ev.id!,
                              label: `#${ev.eventNo || ev.id}: ${ev.distance}m ${ev.stroke} (${ev.gender === 'M' ? 'M' : 'W'})${statusTag ? ' ' + statusTag : ''}`
                            };
                          })}
                          value={selectedEventId || ''}
                          placeholder="Select Active Event..."
                          onChange={(val) => {
                            if (val) {
                              setSelectedEventId(Number(val));
                              setSelectedHeatNum(1);
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                        disabled={!hasNextEv}
                        onClick={() => {
                          if (hasNextEv) {
                            const nextEv = events[currentEvIndex + 1];
                            setSelectedEventId(nextEv.id!);
                            setSelectedHeatNum(1);
                          }
                        }}
                        title="Next Event"
                      >
                        ▶
                      </button>
                    </div>

                    {/* ACTIVE HEAT SELECTOR */}
                    {selectedEventId && (
                      <div style={{ marginTop: '0.65rem', backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: '#94a3b8' }}>ACTIVE HEAT</span>
                          <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700 }}>
                            Heat {selectedHeatNum} of {activeEventHeats.length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {activeEventHeats.map(h => {
                            const isSaved = savedHeatKeys.has(`${selectedEventId}-${h}`);
                            return (
                              <button
                                key={h}
                                type="button"
                                className={`btn ${selectedHeatNum === h ? 'btn-yellow' : (isSaved ? 'btn-success' : 'btn-secondary')}`}
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.78rem',
                                  fontWeight: selectedHeatNum === h || isSaved ? 800 : 600,
                                  backgroundColor: selectedHeatNum === h ? '#facc15' : (isSaved ? 'rgba(34, 197, 94, 0.22)' : undefined),
                                  borderColor: selectedHeatNum === h ? '#facc15' : (isSaved ? '#4ade80' : undefined),
                                  color: selectedHeatNum === h ? '#0f172a' : (isSaved ? '#4ade80' : undefined),
                                  cursor: 'pointer'
                                }}
                                onClick={() => setSelectedHeatNum(h)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedEventId) {
                                    toggleHeatDoneStatus(selectedEventId, h);
                                  }
                                }}
                                title={isSaved ? `Heat ${h} is DONE (Double-click to UNMARK UNDONE)` : `Heat ${h} (Single-click to select Active, Double-click to mark DONE)`}
                              >
                                {isSaved ? '✓ ' : ''}Heat {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
      <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
        {/* Event Order Header & Filters */}
        <div className="glass-card">
          {(() => {
            const activeMeetObj = meets.find(m => m.id === selectedMeetId);
            return (
              <div className="card-header flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                    Order Of Events — {activeMeetObj?.name || 'Championship Events'}
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-cyan)', fontWeight: 600 }}>
                    {sortedEvents.length} Championship Events • Ordered Strictly by Official Schedule
                  </span>
                </div>

                {/* Top Right Pool Course & Lanes Badge */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '-0.3rem' }}>
                  <div 
                    style={{
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(59, 130, 246, 0.18))',
                      border: '1.5px solid rgba(6, 182, 212, 0.55)',
                      color: '#67e8f9',
                      borderRadius: '20px',
                      padding: '0.35rem 0.95rem',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      letterSpacing: '0.4px',
                      boxShadow: '0 0 16px rgba(6, 182, 212, 0.2)'
                    }}
                  >
                    <Waves size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
                    <span>{activeMeetObj?.poolType === '25m' ? '25m (Short Course)' : '50m (Long Course)'}</span>
                    <span style={{ opacity: 0.35 }}>•</span>
                    <span style={{ color: '#facc15' }}>{activeMeetObj?.lanes || 8} Lanes</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3 items-center" style={{ flexWrap: 'nowrap' }}>
            <div className="form-group mb-0" style={{ flex: 1, minWidth: '160px' }}>
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

            <div className="form-group mb-0" style={{ width: '140px', flexShrink: 0 }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Genders' },
                  { value: 'M', label: 'Men' },
                  { value: 'F', label: 'Women' }
                ]}
                value={mainListGender}
                onChange={(val) => setMainListGender(val)}
              />
            </div>

            <div className="form-group mb-0" style={{ width: '220px', flexShrink: 0 }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Categories' },
                  { value: 'Merged', label: 'Merged Events' },
                  ...Array.from(new Set([
                    ...events.map(e => e.ageGroup).filter(Boolean),
                    ...ALL_AGE_GROUPS
                  ])).map(ag => ({ value: ag, label: ag }))
                ]}
                value={mainListCategory}
                onChange={(val) => setMainListCategory(val)}
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
          <div style={{ position: 'relative' }}>
            <div 
              style={{ 
                maxHeight: '620px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem', 
                paddingRight: '0.4rem',
                paddingBottom: '2.5rem'
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
              const activeTargetId = selectedEventId || (uncompletedEvents.length > 0 ? uncompletedEvents[0].id : null);
              
              // Only the event immediately following the active ongoing event is designated as UPCOMING
              const activeIdxInUncompleted = uncompletedEvents.findIndex(e => e.id === activeTargetId);
              const nextUpcomingEv = activeIdxInUncompleted >= 0 && activeIdxInUncompleted < uncompletedEvents.length - 1
                ? uncompletedEvents[activeIdxInUncompleted + 1]
                : (activeIdxInUncompleted === -1 && uncompletedEvents.length > 0 ? uncompletedEvents[0] : null);
              const upcomingTargetId = nextUpcomingEv ? nextUpcomingEv.id : null;

              return sortedEvents.map((ev, index) => {
                const isSelected = expandedEventId === ev.id;
                const evHeats = eventHeatsMap.get(ev.id!) || [1];
                const areAllHeatsSaved = evHeats.length > 0 && evHeats.every(h => savedHeatKeys.has(`${ev.id}-${h}`));

                const isAutoCompleted = completedEventIds.has(ev.id!);
                const isManuallyDone = manuallyDoneEventIds.has(ev.id!);
                const isCompleted = isAutoCompleted || isManuallyDone || areAllHeatsSaved;
                const isOngoing = !isCompleted && ev.id === activeTargetId;
                const isUpcoming = !isCompleted && !isOngoing && ev.id === upcomingTargetId;
                const isChecked = selectedEventIds.has(ev.id!);

                let showStatusBadge = isCompleted || isOngoing || isUpcoming;
                let statusText = '';
                let statusBg = '';
                let statusColor = '';
                let statusBorder = '';
                let StatusIcon = Clock;

                if (isCompleted) {
                  statusText = 'DONE';
                  statusBg = 'rgba(34, 197, 94, 0.25)';
                  statusColor = '#4ade80';
                  statusBorder = '1px solid #22c55e';
                  StatusIcon = CheckCircle2;
                } else if (isOngoing) {
                  statusText = 'ACTIVE EVENT';
                  statusBg = 'rgba(6, 182, 212, 0.25)';
                  statusColor = '#22d3ee';
                  statusBorder = '1px solid #06b6d4';
                  StatusIcon = PlayCircle;
                } else if (isUpcoming) {
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
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', minWidth: 0, overflow: 'hidden' }}
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
                          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                          : isSelected 
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                            : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', 
                        color: '#0f172a', 
                        border: 'none',
                        boxShadow: isCompleted
                          ? '0 0 10px rgba(34, 197, 94, 0.4)'
                          : isSelected
                            ? '0 0 10px rgba(245, 158, 11, 0.4)'
                            : '0 0 10px rgba(6, 182, 212, 0.4)',
                        fontWeight: 900, 
                        padding: '0.35rem 0.75rem', 
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        letterSpacing: '0.02em',
                        flexShrink: 0
                      }}
                    >
                      Event #{ev.eventNo || (index + 1)}
                    </span>

                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700, minWidth: 0 }}>
                        <HoverScrollText>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{ev.distance}m {ev.stroke}</span>
                            {Boolean((ev as any)?.isMerged || ev.ageGroup?.toLowerCase().includes('merged')) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 900, padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#0f172a', letterSpacing: '0.5px', flexShrink: 0 }}>
                                <GitMerge size={11} /> MERGED
                              </span>
                            )}
                          </span>
                        </HoverScrollText>
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', overflow: 'hidden' }}>
                        <span>{ev.gender === 'M' ? 'Men' : 'Women'} ({ev.ageGroup})</span>
                        {(() => {
                          const storedHeats = eventHeatsMap.get(Number(ev.id)) || [];
                          const activeSelectedHeats = (isSelected && heats.length > 0) ? heats : [];
                          const evHeats = Array.from(new Set([...storedHeats, ...activeSelectedHeats])).sort((a, b) => a - b);
                          if (evHeats.length === 0) evHeats.push(1);
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
                                      setSelectedEventId(ev.id!);
                                      setSelectedHeatNum(h);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      toggleHeatDoneStatus(ev.id!, h);
                                    }}
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '0.15rem 0.55rem',
                                      borderRadius: '12px',
                                      backgroundColor: isHeatDone ? 'rgba(34, 197, 94, 0.22)' : (selectedEventId === ev.id && selectedHeatNum === h ? '#facc15' : 'rgba(234, 179, 8, 0.18)'),
                                      color: isHeatDone ? '#4ade80' : (selectedEventId === ev.id && selectedHeatNum === h ? '#0f172a' : '#fde047'),
                                      border: isHeatDone ? '1px solid rgba(34, 197, 94, 0.6)' : '1px solid rgba(234, 179, 8, 0.45)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={isHeatDone ? `Heat ${h} is DONE (Double-click to UNMARK UNDONE)` : `Heat ${h} (Single-click to select Active, Double-click to mark DONE)`}
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
                            e.stopPropagation();
                            if (isCompleted) {
                              toggleSingleEventDoneStatus(ev.id!);
                            } else {
                              setSelectedEventId(ev.id!);
                              setSelectedHeatNum(1);
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

                      {(() => {
                        const storedHeats = eventHeatsMap.get(Number(ev.id)) || [];
                        const activeSelectedHeats = (isSelected && heats.length > 0) ? heats : [];
                        const totalHeatsCount = Math.max(1, Array.from(new Set([...storedHeats, ...activeSelectedHeats])).length);
                        return (
                          <span className="pill-info" style={{ borderColor: 'rgba(234, 179, 8, 0.4)', color: '#fde047', fontWeight: 700 }}>
                            {`${totalHeatsCount} Heat${totalHeatsCount > 1 ? 's' : ''}`}
                          </span>
                        );
                      })()}
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
            {/* Smooth Bottom Fade Gradient */}
            <div 
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '42px',
                background: 'linear-gradient(to bottom, rgba(13, 19, 34, 0) 0%, rgba(13, 19, 34, 0.95) 100%)',
                pointerEvents: 'none',
                borderRadius: '0 0 12px 12px'
              }}
            />
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

    {/* Create / Edit Meet Setup Wizard Modal Popup */}
    {isCreatingMeet && createPortal(
      <div 
        className="modal-overlay"
        onClick={handleCancelEditMeet}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}
      >
        <div 
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '620px',
            width: '92vw',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
            border: '1.5px solid rgba(250, 204, 21, 0.4)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(250, 204, 21, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}
        >
          <div className="modal-header flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} /> {editingMeetId ? 'Edit Meet Details' : 'Create New Meet & Championship Setup'}
            </h3>
            <button 
              type="button"
              className="btn btn-secondary" 
              style={{ padding: '0.2rem 0.5rem' }}
              onClick={handleCancelEditMeet}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveMeet}>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>MEET NAME</label>
                <input
                  type="text"
                  placeholder="e.g. 11th State Aquatic Championship 2026"
                  required
                  className="form-control"
                  value={meetName}
                  onChange={(e) => setMeetName(e.target.value)}
                />
              </div>

              <div className="form-row mb-3">
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>LOCATION / VENUE</label>
                  <input
                    type="text"
                    placeholder="e.g. GHMC Swimming Pool, Amberpet"
                    className="form-control"
                    value={meetLocation}
                    onChange={(e) => setMeetLocation(e.target.value)}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>START DATE</label>
                  <input
                    type="date"
                    className="form-control"
                    value={meetDate}
                    onChange={(e) => setMeetDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row mb-3">
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>POOL COURSE</label>
                  <CustomSelect
                    options={[
                      { value: '50m', label: '50m (Long Course / Olympic)' },
                      { value: '25m', label: '25m (Short Course)' }
                    ]}
                    value={meetPoolType}
                    onChange={(val) => setMeetPoolType(val as '50m' | '25m')}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>LANES (DEFAULT 8)</label>
                  <CustomSelect
                    options={[
                      { value: '6', label: '6 Lanes' },
                      { value: '8', label: '8 Lanes (Standard)' },
                      { value: '10', label: '10 Lanes' }
                    ]}
                    value={String(meetLanes)}
                    onChange={(val) => setMeetLanes(Number(val))}
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>CATEGORY TEMPLATE</label>
                <CustomSelect
                  options={[
                    { value: 'masters', label: 'Masters Swimming (25-29, 30-34 ... 80+)' },
                    { value: 'juniors', label: 'Junior / Sub-Junior (Group A, Group B, Group C, Group D)' },
                    { value: 'open', label: 'Universal / Open (All Age Groups)' }
                  ]}
                  value={meetCategoryPreset}
                  onChange={(val) => setMeetCategoryPreset(val as 'masters' | 'juniors' | 'open')}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-yellow)' }}>AFFILIATION / LOCATION TYPE</label>
                <CustomSelect
                  options={[
                    { value: 'District', label: 'District (Inter-District / State Championships)' },
                    { value: 'State', label: 'State (Inter-State / National Championships)' },
                    { value: 'Club', label: 'Club (Club Invitationals / School Meets)' }
                  ]}
                  value={meetAffiliationType}
                  onChange={(val) => setMeetAffiliationType(val as 'District' | 'State' | 'Club')}
                />
              </div>

              {!editingMeetId && (
                <div className="form-group mb-3" style={{ background: 'rgba(8, 12, 22, 0.85)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1.5px solid rgba(250, 204, 21, 0.35)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: meetAutoEvents ? '0.75rem' : 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: '#facc15', margin: 0, fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={meetAutoEvents}
                        onChange={(e) => setMeetAutoEvents(e.target.checked)}
                        style={{ accentColor: '#facc15', width: '17px', height: '17px' }}
                      />
                      Auto-generate official competition events ({presetEvents.filter(pe => pe.enabled).length} active)
                    </label>

                    {meetAutoEvents && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.15rem 0.55rem', fontSize: '0.7rem', color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.3)', fontWeight: 700 }}
                          onClick={() => selectAllPresetEvents(true)}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.15rem 0.55rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}
                          onClick={() => selectAllPresetEvents(false)}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {meetAutoEvents && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid rgba(250, 204, 21, 0.15)', paddingTop: '0.7rem' }}>
                      {/* Freestyle Section */}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', marginBottom: '0.3rem', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#facc15' }} />
                          FREESTYLE
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {presetEvents.filter(pe => pe.stroke === 'Freestyle').map(pe => (
                            <button
                              key={pe.id}
                              type="button"
                              onClick={() => togglePresetEvent(pe.id)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: pe.enabled ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
                                background: pe.enabled ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(202, 138, 4, 0.15) 100%)' : 'rgba(255,255,255,0.02)',
                                color: pe.enabled ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                boxShadow: pe.enabled ? '0 0 10px rgba(250, 204, 21, 0.2)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {pe.enabled ? <span style={{ color: '#facc15', marginRight: '3px' }}>✓</span> : ''}{pe.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Backstroke Section */}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', marginBottom: '0.3rem', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#facc15' }} />
                          BACKSTROKE
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {presetEvents.filter(pe => pe.stroke === 'Backstroke').map(pe => (
                            <button
                              key={pe.id}
                              type="button"
                              onClick={() => togglePresetEvent(pe.id)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: pe.enabled ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
                                background: pe.enabled ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(202, 138, 4, 0.15) 100%)' : 'rgba(255,255,255,0.02)',
                                color: pe.enabled ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                boxShadow: pe.enabled ? '0 0 10px rgba(250, 204, 21, 0.2)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {pe.enabled ? <span style={{ color: '#facc15', marginRight: '3px' }}>✓</span> : ''}{pe.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Breaststroke Section */}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', marginBottom: '0.3rem', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#facc15' }} />
                          BREASTSTROKE
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {presetEvents.filter(pe => pe.stroke === 'Breaststroke').map(pe => (
                            <button
                              key={pe.id}
                              type="button"
                              onClick={() => togglePresetEvent(pe.id)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: pe.enabled ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
                                background: pe.enabled ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(202, 138, 4, 0.15) 100%)' : 'rgba(255,255,255,0.02)',
                                color: pe.enabled ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                boxShadow: pe.enabled ? '0 0 10px rgba(250, 204, 21, 0.2)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {pe.enabled ? <span style={{ color: '#facc15', marginRight: '3px' }}>✓</span> : ''}{pe.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Butterfly Section */}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', marginBottom: '0.3rem', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#facc15' }} />
                          BUTTERFLY
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {presetEvents.filter(pe => pe.stroke === 'Butterfly').map(pe => (
                            <button
                              key={pe.id}
                              type="button"
                              onClick={() => togglePresetEvent(pe.id)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: pe.enabled ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
                                background: pe.enabled ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(202, 138, 4, 0.15) 100%)' : 'rgba(255,255,255,0.02)',
                                color: pe.enabled ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                boxShadow: pe.enabled ? '0 0 10px rgba(250, 204, 21, 0.2)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {pe.enabled ? <span style={{ color: '#facc15', marginRight: '3px' }}>✓</span> : ''}{pe.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Individual Medley Section */}
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', marginBottom: '0.3rem', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#facc15' }} />
                          INDIVIDUAL MEDLEY (IM)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {presetEvents.filter(pe => pe.stroke === 'Individual Medley').map(pe => (
                            <button
                              key={pe.id}
                              type="button"
                              onClick={() => togglePresetEvent(pe.id)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: pe.enabled ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
                                background: pe.enabled ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(202, 138, 4, 0.15) 100%)' : 'rgba(255,255,255,0.02)',
                                color: pe.enabled ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                boxShadow: pe.enabled ? '0 0 10px rgba(250, 204, 21, 0.2)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {pe.enabled ? <span style={{ color: '#facc15', marginRight: '3px' }}>✓</span> : ''}{pe.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEditMeet}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {editingMeetId ? <Save size={16} /> : <Plus size={16} />} {editingMeetId ? 'Save Changes' : 'Create & Initialize Meet'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}

    <SmartImportModal
      isOpen={showImportModal}
      onClose={() => setShowImportModal(false)}
      activeMeetId={selectedMeetId}
      onImportComplete={async () => {
        await loadMeets(selectedMeetId || undefined);
        if (selectedMeetId) {
          await loadEvents(selectedMeetId);
          await loadAllSwimmers(selectedMeetId);
          await loadCompletedEvents();
          if (expandedEventId) {
            await loadHeatsAndAssignments(expandedEventId, expandedHeatNum);
            await loadEligibleSwimmers(expandedEventId);
          }
        }
      }}
    />
  </>
  );
}
