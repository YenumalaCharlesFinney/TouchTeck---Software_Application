import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { db, Event, Swimmer, AgeGroup, LaneAssignment } from '../db';
import { UploadCloud, CheckCircle2, AlertTriangle, X, Database, Users, Award, Flag, Layers, Search, Edit, Trash2, Plus, Save, ChevronDown, ChevronUp, User, Activity, Filter, CheckSquare, Square } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { EventDataFilePayload, syncMeetEventsToDisk } from '../utils/eventStorage';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMeetId?: number | null;
  onImportComplete?: () => void | Promise<void>;
}

export interface StagedAssignment {
  eventKey: string;
  eventNo?: number;
  distance: number;
  stroke: string;
  gender: 'M' | 'F';
  ageGroup: string;
  heatNumber: number;
  laneNumber: number;
}

export interface StagedSwimmer {
  tempId: string;
  sfiUid: string;
  name: string;
  firstName?: string;
  lastName?: string;
  gender: 'M' | 'F';
  birthYear?: number;
  ageGroup: AgeGroup;
  club: string;
  assignments: StagedAssignment[];
}

export interface StagedEvent {
  eventKey: string;
  eventNo: number;
  distance: number;
  stroke: Event['stroke'];
  gender: 'M' | 'F';
  ageGroup: AgeGroup;
}

const ALL_AGE_GROUPS: AgeGroup[] = [
  'Group A', 'Group B', 'Group C', 'Group D',
  'Group I', 'Group II', 'Group III', 'Group IV',
  '25-29', '30-34', '35-39', '40-44', '45-49',
  '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80 & above',
  'All Age Groups'
];

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  activeMeetId,
  onImportComplete
}) => {
  // ALL HOOKS DECLARED UNCONDITIONALLY AT TOP LEVEL
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Staged Interactive Review State
  const [stagedSwimmers, setStagedSwimmers] = useState<StagedSwimmer[] | null>(null);
  const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
  const [stagedMeetConfig, setStagedMeetConfig] = useState<any>(null);
  const [customAffiliationType, setCustomAffiliationType] = useState<'District' | 'State' | 'Club' | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('all');

  // Edit / Add Swimmer Modal State (Dual Tab)
  const [editingSwimmer, setEditingSwimmer] = useState<StagedSwimmer | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [editModalTab, setEditModalTab] = useState<'profile' | 'events'>('profile');
  const [editEventSearch, setEditEventSearch] = useState<string>('');
  const [editEventFilterCategory, setEditEventFilterCategory] = useState<'matching' | 'all'>('matching');

  // Individual Form Fields for Swimmer Profile Edit
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');

  const [expandedSwimmerIds, setExpandedSwimmerIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Load meet affiliation type from database on open
  useEffect(() => {
    const loadMeetSettings = async () => {
      if (!isOpen) return;
      const targetId = activeMeetId || 1;
      const meet = await db.meets.get(targetId);
      if (meet) {
        if (meet.affiliationType) {
          setCustomAffiliationType(meet.affiliationType);
        } else {
          const lower = meet.name.toLowerCase();
          if (lower.includes('district')) setCustomAffiliationType('District');
          else if (lower.includes('national') || (lower.includes('state') && !lower.includes('district'))) setCustomAffiliationType('State');
          else if (lower.includes('club') || lower.includes('invitational')) setCustomAffiliationType('Club');
          else setCustomAffiliationType('District');
        }
      }
    };
    loadMeetSettings();
  }, [activeMeetId, isOpen]);

  const uniqueClubsList = useMemo(() => {
    if (!stagedSwimmers) return [];
    return Array.from(new Set(stagedSwimmers.map(s => s.club || 'Unattached'))).filter(Boolean).sort();
  }, [stagedSwimmers]);

  const affiliationLabel = useMemo(() => {
    if (customAffiliationType) return customAffiliationType;
    const meetTitle = stagedMeetConfig?.name || selectedFileName || '';
    const lower = meetTitle.toLowerCase();
    if (lower.includes('district')) return 'District';
    if (lower.includes('national') || (lower.includes('state') && !lower.includes('district'))) return 'State';
    if (lower.includes('club') || lower.includes('invitational')) return 'Club';
    return 'District';
  }, [customAffiliationType, stagedMeetConfig, selectedFileName]);

  const totalHeatsCount = useMemo(() => {
    if (!stagedSwimmers) return 0;
    const heatKeys = new Set<string>();
    stagedSwimmers.forEach(s => {
      s.assignments.forEach(a => {
        heatKeys.add(`${a.eventKey}_${a.heatNumber}`);
      });
    });
    return heatKeys.size || stagedEvents.length;
  }, [stagedSwimmers, stagedEvents]);

  const filteredStagedSwimmers = useMemo(() => {
    if (!stagedSwimmers) return [];
    return stagedSwimmers.filter(sw => {
      if (selectedClubFilter !== 'all' && sw.club !== selectedClubFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = sw.name.toLowerCase().includes(q);
        const inUid = sw.sfiUid.toLowerCase().includes(q);
        const inClub = sw.club.toLowerCase().includes(q);
        const inEvents = sw.assignments.some(a => `${a.distance}m ${a.stroke}`.toLowerCase().includes(q));
        return inName || inUid || inClub || inEvents;
      }
      return true;
    });
  }, [stagedSwimmers, searchQuery, selectedClubFilter]);

  const toggleSwimmerExpand = (tempId: string) => {
    setExpandedSwimmerIds(prev => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const handleCancelAndClose = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    setStagedSwimmers(null);
    setStagedEvents([]);
    setEditingSwimmer(null);
    setExpandedSwimmerIds(new Set());
    setErrorMsg(null);
    onClose();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const parseStroke = (eventStr: string): Event['stroke'] => {
    const str = String(eventStr).toLowerCase();
    if (str.includes('back')) return 'Backstroke';
    if (str.includes('breast')) return 'Breaststroke';
    if (str.includes('fly') || str.includes('butterfly')) return 'Butterfly';
    if (str.includes('im') || str.includes('medley')) return 'Individual Medley';
    return 'Freestyle';
  };

  const parseDistance = (eventStr: string): number => {
    const m = /(\d+)\s*m?/i.exec(String(eventStr));
    return m ? parseInt(m[1]) : 50;
  };

  const processFile = async (file: File) => {
    isCancelledRef.current = false;
    setErrorMsg(null);
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setProgressPercent(0);
    setProgressStatus('Reading file structure...');

    try {
      const meetId = activeMeetId || (await db.meets.toArray())[0]?.id || 1;
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.json')) {
        await processJsonFile(file, meetId);
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
        await processSpreadsheetFile(file, meetId);
      } else {
        throw new Error('Unsupported format. Please upload Excel (.xlsx, .xls), CSV (.csv), or JSON (.json).');
      }
    } catch (err: any) {
      if (isCancelledRef.current) return;
      console.error('Import error:', err);
      setErrorMsg(err.message || 'Failed to parse file.');
      setIsProcessing(false);
    }
  };

  const processJsonFile = async (file: File, meetId: number) => {
    setProgressPercent(30);
    setProgressStatus('Parsing JSON event payload...');
    const text = await file.text();
    if (isCancelledRef.current) return;
    const parsed = JSON.parse(text);

    const swimmersMap = new Map<string, StagedSwimmer>();
    const eventsList: StagedEvent[] = [];

    if (parsed.event && parsed.heats) {
      const payload = parsed as EventDataFilePayload;
      const evKey = `ev_${payload.event.eventNo || 1}_${payload.event.distance}_${payload.event.stroke}_${payload.event.gender}_${payload.event.ageGroup}`;
      
      const stEv: StagedEvent = {
        eventKey: evKey,
        eventNo: payload.event.eventNo || 1,
        distance: payload.event.distance,
        stroke: payload.event.stroke as Event['stroke'],
        gender: payload.event.gender,
        ageGroup: payload.event.ageGroup as AgeGroup
      };
      eventsList.push(stEv);

      for (const h of payload.heats) {
        for (const l of h.lanes) {
          if (l.swimmer && l.swimmer.name) {
            const cleanUid = l.swimmer.sfiUid ? l.swimmer.sfiUid.toLowerCase().trim() : '';
            const cleanName = l.swimmer.name.toLowerCase().trim();
            const swKey = cleanUid || cleanName;

            let swRecord = swimmersMap.get(swKey);
            if (!swRecord) {
              const nameParts = l.swimmer.name.trim().split(/\s+/);
              swRecord = {
                tempId: `sw_${Date.now()}_${Math.random()}`,
                sfiUid: l.swimmer.sfiUid || '',
                name: l.swimmer.name.trim(),
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                gender: (l.swimmer.gender as 'M' | 'F') || payload.event.gender,
                birthYear: l.swimmer.birthYear,
                ageGroup: (l.swimmer.ageGroup as AgeGroup) || payload.event.ageGroup,
                club: l.swimmer.club || 'Unattached',
                assignments: []
              };
              swimmersMap.set(swKey, swRecord);
            }

            swRecord.assignments.push({
              eventKey: evKey,
              eventNo: payload.event.eventNo || 1,
              distance: payload.event.distance,
              stroke: payload.event.stroke,
              gender: payload.event.gender,
              ageGroup: payload.event.ageGroup,
              heatNumber: h.heatNumber,
              laneNumber: l.laneNumber
            });
          }
        }
      }
    }

    setProgressPercent(100);
    setProgressStatus('Entries Loaded Successfully!');
    setStagedSwimmers(Array.from(swimmersMap.values()));
    setStagedEvents(eventsList);
    setIsProcessing(false);
  };

  const processSpreadsheetFile = async (file: File, meetId: number) => {
    setProgressPercent(5);
    setProgressStatus('Reading sheets & schedule configuration...');

    const arrayBuffer = await file.arrayBuffer();
    if (isCancelledRef.current) return;
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 1. Check Meet Info sheet
    const meetInfoSheet = workbook.Sheets['Meet Info'];
    let meetConfig: any = null;
    if (meetInfoSheet) {
      const info2D: any[][] = XLSX.utils.sheet_to_json(meetInfoSheet, { header: 1 });
      let parsedMeetName = '';
      let parsedDate = '';
      let parsedLocation = '';
      let parsedPoolLength: '50m' | '25m' = '50m';
      let parsedLanes = 8;

      info2D.forEach(row => {
        if (Array.isArray(row) && row.length >= 2) {
          const key = String(row[0] || '').toLowerCase().trim();
          const val = String(row[1] || '').trim();
          if (key.includes('meet name')) parsedMeetName = val;
          if (key === 'date') parsedDate = val;
          if (key.includes('location')) parsedLocation = val;
          if (key.includes('pool length')) parsedPoolLength = val.toLowerCase().includes('25') ? '25m' : '50m';
          if (key.includes('lanes')) parsedLanes = parseInt(val) || 8;
        }
      });

      if (parsedMeetName) {
        meetConfig = {
          name: parsedMeetName,
          date: parsedDate || new Date().toISOString().split('T')[0],
          location: parsedLocation,
          poolType: parsedPoolLength,
          lanes: parsedLanes
        };
      }
    }
    setStagedMeetConfig(meetConfig);

    const targetSheetName = workbook.SheetNames.find(s => 
      s.toLowerCase().includes('heat') || s.toLowerCase().includes('entr') || s.toLowerCase().includes('start')
    ) || (workbook.SheetNames.find(s => !s.toLowerCase().includes('meet info')) || workbook.SheetNames[0]);

    const worksheet = workbook.Sheets[targetSheetName];
    const raw2D: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!raw2D || raw2D.length === 0) {
      throw new Error('Spreadsheet contains no data rows.');
    }

    let headerRowIdx = raw2D.findIndex(r => Array.isArray(r) && r.some(c => {
      const str = String(c || '').toLowerCase();
      return str.includes('swimmer') || str.includes('player') || str.includes('athlete') || (str.includes('event') && str.includes('no'));
    }));

    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = (raw2D[headerRowIdx] || []).map(h => String(h || '').trim());
    const rawRows: any[] = [];

    for (let i = headerRowIdx + 1; i < raw2D.length; i++) {
      const r = raw2D[i];
      if (!r || r.length === 0) continue;
      const rowObj: any = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = r[colIdx] !== undefined ? r[colIdx] : '';
      });
      rawRows.push(rowObj);
    }

    if (rawRows.length === 0) {
      throw new Error('No athlete or event entries found below the header row.');
    }

    const getField = (row: any, candidates: string[]) => {
      for (const k of Object.keys(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const cand of candidates) {
          if (cleanK === cand.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const uniqueSwimmersMap = new Map<string, StagedSwimmer>();
    const uniqueEventsMap = new Map<string, StagedEvent>();

    const totalRows = rawRows.length;
    for (let rIdx = 0; rIdx < totalRows; rIdx++) {
      if (isCancelledRef.current) return;
      const row = rawRows[rIdx];

      const name = getField(row, ['swimmer', 'name', 'fullname', 'swimmername', 'athlete', 'playername']);
      const firstName = getField(row, ['firstname', 'fname', 'first']);
      const lastName = getField(row, ['lastname', 'lname', 'surname', 'last']);
      const sfiUid = getField(row, ['sfiuid', 'uid', 'registrationno', 'regno', 'id']);
      const genderRaw = getField(row, ['gender', 'sex', 'mf', 'm/f']);
      const club = getField(row, ['districtclub', 'district / club', 'district/state/club', 'district', 'state', 'club', 'team', 'affiliation', 'unit']) || 'Unattached';
      const ageGroupRaw = getField(row, ['group', 'agegroup', 'category', 'agecat']) || 'All Age Groups';
      const birthYearRaw = getField(row, ['birthyear', 'dob', 'year', 'yob', 'birth']);
      const eventNoRaw = getField(row, ['eventno', 'eventnumber', 'no']);
      const eventName = getField(row, ['event', 'eventname', 'stroke', 'distance']);
      const heatNoRaw = getField(row, ['heat', 'heatno', 'heatnumber']);
      const laneNoRaw = getField(row, ['lane', 'laneno', 'lanenumber']);

      let finalName = name;
      let finalFirst = firstName;
      let finalLast = lastName;

      if (!finalName && (firstName || lastName)) {
        finalName = `${firstName} ${lastName}`.trim();
      } else if (finalName && !finalFirst) {
        const parts = finalName.split(/\s+/);
        finalFirst = parts[0] || '';
        finalLast = parts.slice(1).join(' ') || '';
      }
      if (!finalName) continue;

      if (rIdx % 10 === 0 || rIdx === totalRows - 1) {
        const pct = Math.min(99, Math.round(((rIdx + 1) / totalRows) * 100));
        setProgressPercent(pct);
        setProgressStatus(`Loading Athlete ${rIdx + 1} / ${totalRows}: ${finalName} (${pct}%)`);
        await new Promise(r => setTimeout(r, 0));
      }

      const gLower = String(genderRaw || '').toLowerCase().trim();
      const gender: 'M' | 'F' = (gLower.startsWith('w') || gLower.startsWith('f') || gLower.includes('girl') || gLower.includes('women') || gLower.includes('female')) ? 'F' : 'M';
      const birthYear = parseInt(birthYearRaw) || undefined;
      const eventNo = parseInt(eventNoRaw) || undefined;

      const cleanUid = sfiUid ? sfiUid.toLowerCase().trim() : '';
      const cleanName = finalName.toLowerCase().trim();
      const swimmerKey = cleanUid || cleanName;

      let swimmerRecord = uniqueSwimmersMap.get(swimmerKey);
      if (!swimmerRecord) {
        swimmerRecord = {
          tempId: `sw_${rIdx}_${Date.now()}`,
          sfiUid: sfiUid || '',
          name: finalName,
          firstName: finalFirst,
          lastName: finalLast,
          gender,
          birthYear,
          ageGroup: (ageGroupRaw as AgeGroup) || 'All Age Groups',
          club,
          assignments: []
        };
        uniqueSwimmersMap.set(swimmerKey, swimmerRecord);
      }

      if (eventName || eventNo) {
        const distance = parseDistance(eventName) || 50;
        const stroke = parseStroke(eventName);
        const heatNum = parseInt(heatNoRaw) || 1;
        const laneNum = parseInt(laneNoRaw) || 1;

        const eventKey = `ev_${eventNo || ''}_${distance}_${stroke}_${gender}_${ageGroupRaw}`;
        if (!uniqueEventsMap.has(eventKey)) {
          uniqueEventsMap.set(eventKey, {
            eventKey,
            eventNo: eventNo || (uniqueEventsMap.size + 1),
            distance,
            stroke,
            gender,
            ageGroup: (ageGroupRaw as AgeGroup) || 'All Age Groups'
          });
        }

        swimmerRecord.assignments.push({
          eventKey,
          eventNo: eventNo || uniqueEventsMap.get(eventKey)?.eventNo,
          distance,
          stroke,
          gender,
          ageGroup: (ageGroupRaw as AgeGroup) || 'All Age Groups',
          heatNumber: heatNum,
          laneNumber: laneNum
        });
      }
    }

    if (isCancelledRef.current) return;

    setProgressPercent(100);
    setProgressStatus('Entries Loaded Successfully!');

    setStagedSwimmers(Array.from(uniqueSwimmersMap.values()));
    setStagedEvents(Array.from(uniqueEventsMap.values()));
    setIsProcessing(false);
  };

  const openEditSwimmerModal = (sw: StagedSwimmer, isNew: boolean = false) => {
    setIsAddingNew(isNew);
    setEditModalTab('profile');
    setEditEventSearch('');
    setEditEventFilterCategory('matching');
    const parts = (sw.name || '').trim().split(/\s+/);
    setEditFirstName(sw.firstName || parts[0] || '');
    setEditLastName(sw.lastName || parts.slice(1).join(' ') || '');
    setEditingSwimmer({ ...sw });
  };

  const handleSaveEditedSwimmer = () => {
    if (!editingSwimmer) return;
    const finalFullName = [editFirstName, editLastName].filter(Boolean).join(' ') || editingSwimmer.name || 'Athlete';
    const updatedSw: StagedSwimmer = {
      ...editingSwimmer,
      name: finalFullName,
      firstName: editFirstName,
      lastName: editLastName
    };

    setStagedSwimmers(prev => {
      if (!prev) return [];
      if (isAddingNew) {
        return [updatedSw, ...prev];
      }
      return prev.map(s => s.tempId === updatedSw.tempId ? updatedSw : s);
    });
    setEditingSwimmer(null);
    setIsAddingNew(false);
  };

  const handleDeleteSwimmer = (tempId: string) => {
    setStagedSwimmers(prev => prev ? prev.filter(s => s.tempId !== tempId) : []);
  };

  const findNextAvailableHeatAndLane = (evKey: string, lanesPerHeat = 8) => {
    const takenSpots = new Set<string>();
    if (stagedSwimmers) {
      stagedSwimmers.forEach(s => {
        if (editingSwimmer && s.tempId === editingSwimmer.tempId) return;
        s.assignments.forEach(a => {
          if (a.eventKey === evKey) {
            takenSpots.add(`${a.heatNumber}-${a.laneNumber}`);
          }
        });
      });
    }

    for (let heat = 1; heat <= 50; heat++) {
      for (let lane = 1; lane <= lanesPerHeat; lane++) {
        if (!takenSpots.has(`${heat}-${lane}`)) {
          return { heatNumber: heat, laneNumber: lane };
        }
      }
    }
    return { heatNumber: 1, laneNumber: 1 };
  };

  const toggleEventParticipation = (ev: StagedEvent) => {
    if (!editingSwimmer) return;
    const exists = editingSwimmer.assignments.some(a => a.eventKey === ev.eventKey);
    if (exists) {
      setEditingSwimmer({
        ...editingSwimmer,
        assignments: editingSwimmer.assignments.filter(a => a.eventKey !== ev.eventKey)
      });
    } else {
      const nextSlot = findNextAvailableHeatAndLane(ev.eventKey, stagedMeetConfig?.lanes || 8);
      setEditingSwimmer({
        ...editingSwimmer,
        assignments: [
          ...editingSwimmer.assignments,
          {
            eventKey: ev.eventKey,
            eventNo: ev.eventNo,
            distance: ev.distance,
            stroke: ev.stroke,
            gender: ev.gender,
            ageGroup: ev.ageGroup,
            heatNumber: nextSlot.heatNumber,
            laneNumber: nextSlot.laneNumber
          }
        ]
      });
    }
  };

  const handleConfirmAndApplyImport = async () => {
    if (!stagedSwimmers || stagedSwimmers.length === 0) {
      onClose();
      return;
    }

    isCancelledRef.current = false;
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus('Initializing database transaction...');
    await new Promise(r => setTimeout(r, 40));
    if (isCancelledRef.current) return;

    try {
      const meetId = activeMeetId || (await db.meets.toArray())[0]?.id || 1;

      // 1. Configure Meet Settings
      setProgressPercent(15);
      setProgressStatus('Applying meet configuration & affiliation scope...');
      if (stagedMeetConfig) {
        await db.meets.update(meetId, { ...stagedMeetConfig, affiliationType: affiliationLabel });
      } else {
        await db.meets.update(meetId, { affiliationType: affiliationLabel });
      }
      await new Promise(r => setTimeout(r, 30));
      if (isCancelledRef.current) return;

      // 2. Clear old data for clean meet state
      setProgressPercent(25);
      setProgressStatus('Resetting existing events & heat assignments...');
      const existingEvents = await db.events.where('meetId').equals(meetId).toArray();
      for (const ev of existingEvents) {
        if (isCancelledRef.current) return;
        if (ev.id) {
          await db.events.delete(ev.id);
          await db.laneAssignments.where('eventId').equals(ev.id).delete();
          await db.results.where('eventId').equals(ev.id).delete();
        }
      }
      await db.swimmers.where('meetId').equals(meetId).delete();
      await new Promise(r => setTimeout(r, 30));
      if (isCancelledRef.current) return;

      // 3. Register Events
      setProgressPercent(35);
      setProgressStatus(`Registering ${stagedEvents.length} Championship Events...`);
      const eventKeyToDbId = new Map<string, number>();
      for (let i = 0; i < stagedEvents.length; i++) {
        if (isCancelledRef.current) return;
        const ev = stagedEvents[i];
        const id = await db.events.add({
          meetId,
          eventNo: ev.eventNo,
          distance: ev.distance,
          stroke: ev.stroke,
          gender: ev.gender,
          ageGroup: ev.ageGroup
        });
        eventKeyToDbId.set(ev.eventKey, Number(id));
      }
      await new Promise(r => setTimeout(r, 30));
      if (isCancelledRef.current) return;

      // 4. Register Swimmers and prepare Lane Assignments
      const totalSw = stagedSwimmers.length;
      const assignmentsToInsert: Array<LaneAssignment> = [];
      const batchSize = Math.max(1, Math.floor(totalSw / 10));

      for (let i = 0; i < totalSw; i++) {
        if (isCancelledRef.current) return;
        const sw = stagedSwimmers[i];
        const swDbId = await db.swimmers.add({
          meetId,
          sfiUid: sw.sfiUid || '',
          name: sw.name.trim(),
          gender: sw.gender,
          birthYear: sw.birthYear,
          ageGroup: sw.ageGroup,
          club: sw.club || 'Unattached'
        });

        for (const a of sw.assignments) {
          const evId = eventKeyToDbId.get(a.eventKey);
          if (evId && swDbId) {
            assignmentsToInsert.push({
              eventId: evId,
              heatNumber: a.heatNumber,
              laneNumber: a.laneNumber,
              swimmerId: Number(swDbId)
            });
          }
        }

        if (i % batchSize === 0 || i === totalSw - 1) {
          const currentPct = 35 + Math.round(((i + 1) / totalSw) * 45); // 35% -> 80%
          setProgressPercent(currentPct);
          setProgressStatus(`Saving Athlete ${i + 1} of ${totalSw}: ${sw.name} (${currentPct}%)`);
          await new Promise(r => setTimeout(r, 16));
        }
      }

      if (isCancelledRef.current) return;

      // 5. Bulk add lane assignments
      setProgressPercent(85);
      setProgressStatus(`Seeding ${assignmentsToInsert.length} Lane & Heat Assignments...`);
      if (assignmentsToInsert.length > 0) {
        await db.laneAssignments.bulkAdd(assignmentsToInsert);
      }
      await new Promise(r => setTimeout(r, 40));
      if (isCancelledRef.current) return;

      // 6. Write disk folder files
      setProgressPercent(95);
      setProgressStatus('Writing data files to TouchTeck meet folder...');
      try {
        await syncMeetEventsToDisk(meetId);
      } catch (err) {
        console.warn('Disk sync warning:', err);
      }
      await new Promise(r => setTimeout(r, 40));
      if (isCancelledRef.current) return;

      // 7. 100% Finish
      setProgressPercent(100);
      setProgressStatus('Import Completed Successfully!');
      await new Promise(r => setTimeout(r, 180));

      if (isCancelledRef.current) return;

      onClose();
      window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
      if (onImportComplete) {
        await onImportComplete();
      }
    } catch (e: any) {
      if (isCancelledRef.current) return;
      console.error('Import commit error:', e);
      setErrorMsg(`Failed to save meet data: ${e.message}`);
      setIsProcessing(false);
    }
  };

  // IF NOT OPEN, RETURN NULL ONLY AFTER ALL HOOKS ARE RUN!
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div
        className="modal-content"
        style={{
          width: '96vw',
          maxWidth: stagedSwimmers ? '1360px' : '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={22} style={{ color: 'var(--accent-yellow)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                {stagedSwimmers ? `Verify & Edit Meet Data (${stagedSwimmers.length} Athletes Loaded)` : 'Import Meet Data & Entry Files'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {stagedSwimmers 
                  ? `Review athletes, ${affiliationLabel.toLowerCase()} representation, and event assignments`
                  : 'Excel (.xlsx, .xls), CSV (.csv), or TouchTeck Event JSON (.json)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem' }}
            onClick={handleCancelAndClose}
            title="Cancel & Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* Dropzone */}
          {!stagedSwimmers && !isProcessing && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent-yellow)' : 'rgba(250, 204, 21, 0.35)'}`,
                borderRadius: '12px',
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: dragActive ? 'rgba(250, 204, 21, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(250, 204, 21, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-yellow)' }}>
                <UploadCloud size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.15rem' }}>
                  {selectedFileName || 'Click to select or Drag & Drop championship file here'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Supports Excel spreadsheets, Meet Heat Sheets, CSV rosters, and Event JSON files
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid rgba(250, 204, 21, 0.55)', borderRadius: '12px', padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  {progressStatus || 'Loading entries...'}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-yellow)', fontFamily: 'monospace' }}>
                  {progressPercent}%
                </span>
              </div>

              <div style={{ width: '100%', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden', border: '1.5px solid rgba(250, 204, 21, 0.45)', padding: '2px', boxSizing: 'border-box' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(3, progressPercent)}%`,
                    background: 'linear-gradient(90deg, #eab308 0%, #facc15 50%, #fef08a 100%)',
                    boxShadow: '0 0 14px rgba(250, 204, 21, 0.85)',
                    borderRadius: '999px',
                    transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              </div>
            </div>
          )}

          {/* Interactive Staged Verification & Edit Table */}
          {stagedSwimmers && !isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Metric Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <Users size={18} style={{ color: '#38bdf8', marginBottom: '0.2rem' }} />
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{stagedSwimmers.length}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Athletes</div>
                </div>

                <div style={{ background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <Award size={18} style={{ color: 'var(--accent-yellow)', marginBottom: '0.2rem' }} />
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{stagedEvents.length}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Events</div>
                </div>

                <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <Layers size={18} style={{ color: '#a78bfa', marginBottom: '0.2rem' }} />
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{totalHeatsCount}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total Heats</div>
                </div>

                <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <Flag size={18} style={{ color: '#4ade80', marginBottom: '0.2rem' }} />
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{uniqueClubsList.length}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{affiliationLabel}s</div>
                </div>
              </div>

              {/* Toolbar: Search, Filter, Scope, Add Athlete */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.6rem', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder={`Search by athlete name, SFI UID, ${affiliationLabel.toLowerCase()}, or event...`}
                      className="form-control"
                      style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-control"
                    style={{ width: '220px', fontSize: '0.85rem' }}
                    value={selectedClubFilter}
                    onChange={(e) => setSelectedClubFilter(e.target.value)}
                  >
                    <option value="all">All {affiliationLabel}s ({uniqueClubsList.length})</option>
                    {uniqueClubsList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>TYPE:</span>
                    <select
                      className="form-control"
                      style={{ width: '110px', fontSize: '0.82rem', borderColor: 'rgba(250, 204, 21, 0.5)', color: '#facc15', fontWeight: 700 }}
                      value={affiliationLabel}
                      onChange={(e) => setCustomAffiliationType(e.target.value as 'District' | 'State' | 'Club')}
                      title="Choose Affiliation Scope (District, State, or Club)"
                    >
                      <option value="District">District</option>
                      <option value="State">State</option>
                      <option value="Club">Club</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                  onClick={() => {
                    openEditSwimmerModal({
                      tempId: `sw_manual_${Date.now()}`,
                      sfiUid: '',
                      name: '',
                      firstName: '',
                      lastName: '',
                      gender: 'M',
                      birthYear: new Date().getFullYear() - 15,
                      ageGroup: 'Group A',
                      club: 'Hyderabad',
                      assignments: []
                    }, true);
                  }}
                >
                  <Plus size={15} /> Add Athlete
                </button>
              </div>

              {/* Swimmers Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '130px' }}>SFI UID</th>
                      <th style={{ minWidth: '180px' }}>NAME</th>
                      <th style={{ width: '80px' }}>GENDER</th>
                      <th style={{ width: '90px' }}>BIRTH YEAR</th>
                      <th style={{ width: '120px' }}>AGE GROUP</th>
                      <th style={{ minWidth: '150px' }}>{affiliationLabel.toUpperCase()}</th>
                      <th style={{ minWidth: '180px' }}>EVENTS</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStagedSwimmers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                          No registered athletes matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStagedSwimmers.map((sw, idx) => {
                        const isExpanded = expandedSwimmerIds.has(sw.tempId);
                        const totalEvents = sw.assignments.length;

                        return (
                          <tr 
                            key={sw.tempId}
                            onDoubleClick={() => toggleSwimmerExpand(sw.tempId)}
                            style={{ cursor: 'pointer' }}
                            title="Click or double-click to view all assigned events"
                          >
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</td>
                            <td>
                              <span className="pill-info" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#67e8f9', fontWeight: 700 }}>
                                {sw.sfiUid || `SFI-${1001 + idx}`}
                              </span>
                            </td>
                            <td style={{ fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                              {sw.name}
                            </td>
                            <td>{sw.gender === 'M' ? 'Male' : 'Female'}</td>
                            <td>{sw.birthYear || '--'}</td>
                            <td>
                              <span className="pill-info" style={{ borderColor: 'var(--accent-blue)', color: '#93c5fd', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {sw.ageGroup}
                              </span>
                            </td>
                            <td className="text-cyan" style={{ fontWeight: 600 }}>
                              {sw.club}
                            </td>
                            <td>
                              {totalEvents === 0 ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No events</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  <div>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{
                                        padding: '0.2rem 0.65rem',
                                        fontSize: '0.74rem',
                                        background: isExpanded ? 'rgba(250, 204, 21, 0.22)' : 'rgba(250, 204, 21, 0.12)',
                                        borderColor: isExpanded ? 'rgba(250, 204, 21, 0.5)' : 'rgba(250, 204, 21, 0.35)',
                                        color: '#facc15',
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSwimmerExpand(sw.tempId);
                                      }}
                                      title={isExpanded ? 'Click to collapse events' : 'Click to see all events'}
                                    >
                                      {totalEvents} Events {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.3rem', marginTop: '0.35rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.45rem', borderRadius: '6px', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
                                      {sw.assignments.map((a, aIdx) => (
                                        <span key={aIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.12rem 0.4rem', borderRadius: '4px', background: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(250, 204, 21, 0.3)', color: '#fef08a', fontSize: '0.72rem', fontWeight: 700 }}>
                                          #{a.eventNo || '?'}: {a.distance}m (H{a.heatNumber}/L{a.laneNumber})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.35)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  onClick={() => openEditSwimmerModal(sw, false)}
                                  title="Edit Swimmer Details & Event Assignments"
                                >
                                  <Edit size={13} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                                  onClick={() => handleDeleteSwimmer(sw.tempId)}
                                  title="Delete Swimmer from Import"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5', fontSize: '0.82rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.9rem 0 0 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--accent-red)', borderColor: 'rgba(248, 113, 113, 0.4)' }}
            onClick={handleCancelAndClose}
          >
            {stagedSwimmers ? 'Cancel & Discard' : (isProcessing ? 'Cancel Import' : 'Close')}
          </button>

          {stagedSwimmers && !isProcessing && (
            <button
              type="button"
              className="btn btn-yellow"
              style={{ padding: '0.55rem 1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
              onClick={handleConfirmAndApplyImport}
            >
              <CheckCircle2 size={18} /> Confirm & Apply Import ({stagedSwimmers.length} Athletes, {stagedEvents.length} Events)
            </button>
          )}
        </div>
      </div>

      {/* Dual-Tab Swimmer Profile & Events Edit Modal */}
      {editingSwimmer && (
        <div className="modal-overlay" style={{ zIndex: 100001 }}>
          <div className="modal-content" style={{ maxWidth: '680px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--accent-yellow)', fontWeight: 800, fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Edit size={16} /> {isAddingNew ? 'Register New Swimmer' : 'Edit Swimmer & Participating Events'}
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {[editFirstName, editLastName].filter(Boolean).join(' ') || editingSwimmer.name || 'Athlete'} • {editingSwimmer.club || 'No Club'} ({editingSwimmer.gender === 'M' ? 'Men' : 'Women'}, {editingSwimmer.ageGroup})
                </p>
              </div>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setEditingSwimmer(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem 0 1rem', background: 'rgba(15, 23, 42, 0.5)' }}>
              <button
                type="button"
                className={`btn ${editModalTab === 'profile' ? 'btn-yellow' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setEditModalTab('profile')}
              >
                <User size={15} /> Swimmer Profile
              </button>
              <button
                type="button"
                className={`btn ${editModalTab === 'events' ? 'btn-cyan' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setEditModalTab('events')}
              >
                <Activity size={15} /> Participating Events ({editingSwimmer.assignments.length})
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {editModalTab === 'profile' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">SFI REGISTRATION UID</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SFIMAXTEL29679"
                      value={editingSwimmer.sfiUid}
                      onChange={(e) => setEditingSwimmer({ ...editingSwimmer, sfiUid: e.target.value })}
                    />
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">FIRST NAME</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="e.g. LAKSHMI"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">LAST NAME</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. NARAYANA"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">GENDER</label>
                      <CustomSelect
                        options={[
                          { value: 'M', label: 'Male' },
                          { value: 'F', label: 'Female' }
                        ]}
                        value={editingSwimmer.gender}
                        onChange={(val) => setEditingSwimmer({ ...editingSwimmer, gender: val as 'M' | 'F' })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">BIRTH YEAR</label>
                      <input
                        type="number"
                        min={1930}
                        max={new Date().getFullYear()}
                        className="form-control"
                        placeholder="e.g. 2009"
                        value={editingSwimmer.birthYear || ''}
                        onChange={(e) => setEditingSwimmer({ ...editingSwimmer, birthYear: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">AGE GROUP / CATEGORY</label>
                      <CustomSelect
                        options={ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))}
                        value={editingSwimmer.ageGroup}
                        onChange={(val) => setEditingSwimmer({ ...editingSwimmer, ageGroup: val as AgeGroup })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{affiliationLabel.toUpperCase()} / CLUB</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="e.g. Hyderabad Aquatic Club"
                        value={editingSwimmer.club}
                        onChange={(e) => setEditingSwimmer({ ...editingSwimmer, club: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Category Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                      <Award size={16} /> Category: <span style={{ color: '#fff' }}>{editingSwimmer.gender === 'M' ? 'Men' : 'Women'} ({editingSwimmer.ageGroup})</span>
                    </div>
                    <div className="pill-info" style={{ borderColor: 'rgba(234, 179, 8, 0.45)', color: '#fde047', fontSize: '0.75rem', fontWeight: 700 }}>
                      {stagedEvents.filter(e => e.gender === editingSwimmer.gender && e.ageGroup === editingSwimmer.ageGroup).length} Events in Category
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      Select events to register {[editFirstName, editLastName].filter(Boolean).join(' ') || editingSwimmer.name || 'athlete'}
                    </span>
                    <span className="pill-info" style={{ borderColor: 'rgba(6,182,212,0.4)', color: '#67e8f9', fontSize: '0.75rem' }}>
                      {editingSwimmer.assignments.length} Checked
                    </span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder={`Search ${editingSwimmer.gender === 'M' ? "men's" : "women's"} (${editingSwimmer.ageGroup}) events by stroke, distance...`}
                      className="form-control"
                      style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                      value={editEventSearch}
                      onChange={(e) => setEditEventSearch(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                    {stagedEvents
                      .filter(ev => {
                        // Strictly enforce swimmer's own Gender AND own Age Group / Category
                        if (ev.gender !== editingSwimmer.gender || ev.ageGroup !== editingSwimmer.ageGroup) {
                          return false;
                        }
                        if (editEventSearch.trim()) {
                          const q = editEventSearch.toLowerCase().trim();
                          const txt = `#${ev.eventNo} ${ev.distance}m ${ev.stroke}`.toLowerCase();
                          return txt.includes(q);
                        }
                        return true;
                      })
                      .map(ev => {
                        const assignment = editingSwimmer.assignments.find(a => a.eventKey === ev.eventKey);
                        const isChecked = !!assignment;

                        return (
                          <div
                            key={ev.eventKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.6rem',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              border: isChecked ? '1.5px solid rgba(74, 222, 128, 0.45)' : '1px solid var(--border-color)',
                              background: isChecked ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div
                              onClick={() => toggleEventParticipation(ev)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', flex: 1 }}
                            >
                              {isChecked ? (
                                <CheckSquare size={18} style={{ color: '#4ade80', flexShrink: 0 }} />
                              ) : (
                                <Square size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              )}
                              <div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isChecked ? '#f8fafc' : '#cbd5e1' }}>
                                  #{ev.eventNo}: {ev.distance}m {ev.stroke}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                  ({ev.gender === 'M' ? 'Men' : 'Women'}, {ev.ageGroup})
                                </span>
                              </div>
                            </div>

                            {isChecked && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.74rem', color: '#94a3b8' }}>
                                  <span>H:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    className="form-control"
                                    style={{ width: '45px', padding: '0.2rem 0.35rem', fontSize: '0.75rem', textAlign: 'center' }}
                                    value={assignment.heatNumber}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      setEditingSwimmer({
                                        ...editingSwimmer,
                                        assignments: editingSwimmer.assignments.map(a => a.eventKey === ev.eventKey ? { ...a, heatNumber: val } : a)
                                      });
                                    }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.74rem', color: '#94a3b8' }}>
                                  <span>L:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    className="form-control"
                                    style={{ width: '45px', padding: '0.2rem 0.35rem', fontSize: '0.75rem', textAlign: 'center' }}
                                    value={assignment.laneNumber}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      setEditingSwimmer({
                                        ...editingSwimmer,
                                        assignments: editingSwimmer.assignments.map(a => a.eventKey === ev.eventKey ? { ...a, laneNumber: val } : a)
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--border-color)', padding: '0.8rem 1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingSwimmer(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-yellow font-bold"
                onClick={handleSaveEditedSwimmer}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Save size={15} /> Save Changes & Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default SmartImportModal;
