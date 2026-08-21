import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, Swimmer, AgeGroup, seedDatabase, Event as MeetDbEvent } from '../db';
import { UserPlus, Trash2, Edit, Search, RotateCcw, Plus, X, Award, CheckSquare, Square, Calendar, User, Activity, Filter, Save, Check, AlertTriangle, CheckCheck, GitMerge, Zap, ArrowRight, ShieldCheck, UploadCloud, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import SmartImportModal from './SmartImportModal';
import { useModalClose } from '../hooks/useModalClose';

interface SwimmerManagerProps {
  activeMeetId?: number | null;
}

interface SwimmerEventState {
  eventId: number;
  eventNo?: number;
  distance: number;
  stroke: string;
  gender: 'M' | 'F';
  ageGroup: string;
  isParticipating: boolean;
  heatNumber: number;
  laneNumber: number;
  assignmentId?: number;
}

export interface MergeCandidate {
  candidateId: string;
  existingSwimmer: Swimmer;
  importedSwimmer: {
    sfiUid?: string;
    name: string;
    gender: 'M' | 'F';
    birthYear: number;
    ageGroup: AgeGroup;
    club: string;
    eventsToAdd: { eventId: number; eventName: string; heatNumber: number; laneNumber: number }[];
  };
  similarity: number;
  matchType: string;
}

const ALL_AGE_GROUPS: AgeGroup[] = [
  'Group A', 'Group B', 'Group C', 'Group D',
  '25-29', '30-34', '35-39', '40-44', '45-49',
  '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80 & above'
];

function computeSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  if (normA === normB) return 1.0;
  
  const tokensA = new Set(normA.split(/\s+/).filter(Boolean));
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean));
  
  let intersection = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++;
  });
  
  const union = new Set([...tokensA, ...tokensB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

export default function SwimmerManager({ activeMeetId }: SwimmerManagerProps) {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [meetName, setMeetName] = useState<string>('');
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  
  // Add Swimmer State
  const [sfiUid, setSfiUid] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthYear, setBirthYear] = useState(1980);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('75-79');
  const [club, setClub] = useState('Hyderabad');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [addSwimmerEvents, setAddSwimmerEvents] = useState<SwimmerEventState[]>([]);
  const [activeAddTab, setActiveAddTab] = useState<'info' | 'events'>('info');
  const [addEventSearchQuery, setAddEventSearchQuery] = useState<string>('');
  const [addEventFilterMode, setAddEventFilterMode] = useState<'matching' | 'all'>('matching');
  
  // Edit Swimmer State
  const [editingSwimmer, setEditingSwimmer] = useState<Swimmer | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [swimmerEvents, setSwimmerEvents] = useState<SwimmerEventState[]>([]);
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('');
  const [activeEditTab, setActiveEditTab] = useState<'info' | 'events'>('info');

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<string>('All');
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterClub, setFilterClub] = useState<string>('All');
  const [clubsList, setClubsList] = useState<string[]>([]);
  const [meetAffiliation, setMeetAffiliation] = useState<'District' | 'State' | 'Club' | null>(null);
  
  const affiliationLabel = useMemo(() => {
    if (meetAffiliation) return meetAffiliation;
    if (!meetName) return 'District';
    const lower = meetName.toLowerCase();
    if (lower.includes('district')) return 'District';
    if (lower.includes('national') || (lower.includes('state') && !lower.includes('district'))) return 'State';
    if (lower.includes('club') || lower.includes('invitational')) return 'Club';
    return 'District';
  }, [meetAffiliation, meetName]);

  const [swimmerEventsMap, setSwimmerEventsMap] = useState<Map<number, Array<{ eventNo?: number; distance: number; stroke: string; heatNumber: number; laneNumber: number }>>>(new Map());
  const [expandedSwimmerIds, setExpandedSwimmerIds] = useState<Set<number>>(new Set());

  const toggleSwimmerExpand = (swimmerId: number) => {
    setExpandedSwimmerIds(prev => {
      const next = new Set(prev);
      if (next.has(swimmerId)) next.delete(swimmerId);
      else next.add(swimmerId);
      return next;
    });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteSwimmerId, setDeleteSwimmerId] = useState<number | null>(null);
  const [eventFilterMode, setEventFilterMode] = useState<'matching' | 'all'>('matching');
  const { isClosing: isAddModalClosing, triggerClose: closeAddModal } = useModalClose();

  useEffect(() => {
    loadSwimmers();
  }, [activeMeetId]);

  const loadSwimmers = async () => {
    const targetMeetId = activeMeetId || 1;
    const meet = await db.meets.get(targetMeetId);
    if (meet) {
      setMeetName(meet.name);
      if (meet.affiliationType) setMeetAffiliation(meet.affiliationType);
    }

    // Auto-migrate legacy unassigned swimmers to Meet 1
    const all = await db.swimmers.toArray();
    for (const s of all) {
      if (!s.meetId && s.id) {
        await db.swimmers.update(s.id, { meetId: 1 });
      }
    }

    const meetSwimmers = await db.swimmers
      .filter(s => s.meetId === targetMeetId)
      .toArray();

    setSwimmers(meetSwimmers);

    const clubs = Array.from(new Set(meetSwimmers.map(s => s.club).filter(Boolean)));
    setClubsList(clubs);

    // Load assigned events map for all swimmers in this meet
    const meetEvents = await db.events.filter(e => (e.meetId || 1) === targetMeetId).toArray();
    const eventMap = new Map<number, MeetDbEvent>();
    meetEvents.forEach(e => { if (e.id) eventMap.set(e.id, e); });

    const assigns = await db.laneAssignments.toArray();
    const map = new Map<number, Array<{ eventNo?: number; distance: number; stroke: string; heatNumber: number; laneNumber: number }>>();
    for (const a of assigns) {
      if (a.swimmerId && eventMap.has(a.eventId)) {
        const ev = eventMap.get(a.eventId)!;
        const list = map.get(a.swimmerId) || [];
        list.push({
          eventNo: ev.eventNo,
          distance: ev.distance,
          stroke: ev.stroke,
          heatNumber: a.heatNumber,
          laneNumber: a.laneNumber
        });
        map.set(a.swimmerId, list);
      }
    }
    setSwimmerEventsMap(map);
  };

  const findAvailableHeatAndLane = async (eventId: number): Promise<{ heatNumber: number; laneNumber: number }> => {
    const assignments = await db.laneAssignments.filter(a => Number(a.eventId) === Number(eventId) && !!a.swimmerId).toArray();
    let heatNumber = 1;
    while (true) {
      const heatAssigns = assignments.filter(a => Number(a.heatNumber) === heatNumber);
      const occupiedLanes = new Set(heatAssigns.map(a => Number(a.laneNumber)));
      for (let lane = 1; lane <= 8; lane++) {
        if (!occupiedLanes.has(lane)) {
          return { heatNumber, laneNumber: lane };
        }
      }
      heatNumber++;
    }
  };

  const handleOpenAddModal = async () => {
    setSfiUid('');
    setFirstName('');
    setLastName('');
    setGender('M');
    setBirthYear(1980);
    setAgeGroup('75-79');
    setClub('Hyderabad');
    setActiveAddTab('info');
    setAddEventSearchQuery('');
    setAddEventFilterMode('matching');

    const targetMeetId = activeMeetId || 1;
    const meetEvents = await db.events.filter(e => (e.meetId || 1) === targetMeetId).toArray();
    const eventStates: SwimmerEventState[] = meetEvents.map(ev => ({
      eventId: ev.id!,
      eventNo: ev.eventNo,
      distance: ev.distance,
      stroke: ev.stroke,
      gender: ev.gender,
      ageGroup: ev.ageGroup,
      isParticipating: false,
      heatNumber: 1,
      laneNumber: 1
    }));
    eventStates.sort((a, b) => (a.eventNo || a.eventId) - (b.eventNo || b.eventId));
    setAddSwimmerEvents(eventStates);
    setIsModalOpen(true);
  };

  const handleToggleAddEventParticipation = async (eventId: number) => {
    const target = addSwimmerEvents.find(e => e.eventId === eventId);
    if (!target) return;

    if (!target.isParticipating) {
      const avail = await findAvailableHeatAndLane(eventId);
      setAddSwimmerEvents(prev => prev.map(ev => {
        if (ev.eventId === eventId) {
          return { ...ev, isParticipating: true, heatNumber: avail.heatNumber, laneNumber: avail.laneNumber };
        }
        return ev;
      }));
    } else {
      setAddSwimmerEvents(prev => prev.map(ev => {
        if (ev.eventId === eventId) {
          return { ...ev, isParticipating: false };
        }
        return ev;
      }));
    }
  };

  const handleOpenEditModal = async (swimmer: Swimmer) => {
    setEditingSwimmer(swimmer);
    const parts = (swimmer.name || '').trim().split(/\s+/);
    const fName = parts[0] || '';
    const lName = parts.slice(1).join(' ') || '';
    setEditFirstName(fName);
    setEditLastName(lName);
    setActiveEditTab('info');
    setEventSearchQuery('');

    const targetMeetId = activeMeetId || 1;
    const meetEvents = await db.events.filter(e => (e.meetId || 1) === targetMeetId).toArray();
    const swimmerAssigns = await db.laneAssignments.where('swimmerId').equals(swimmer.id!).toArray();

    const eventStates: SwimmerEventState[] = meetEvents.map(ev => {
      const assign = swimmerAssigns.find(a => Number(a.eventId) === Number(ev.id));
      return {
        eventId: ev.id!,
        eventNo: ev.eventNo,
        distance: ev.distance,
        stroke: ev.stroke,
        gender: ev.gender,
        ageGroup: ev.ageGroup,
        isParticipating: !!assign,
        heatNumber: assign?.heatNumber || 1,
        laneNumber: assign?.laneNumber || 1,
        assignmentId: assign?.id
      };
    });

    eventStates.sort((a, b) => {
      if (a.isParticipating !== b.isParticipating) return a.isParticipating ? -1 : 1;
      return (a.eventNo || a.eventId) - (b.eventNo || b.eventId);
    });

    setSwimmerEvents(eventStates);
  };

  const handleToggleEventParticipation = async (eventId: number) => {
    const target = swimmerEvents.find(e => e.eventId === eventId);
    if (!target) return;

    if (!target.isParticipating) {
      const avail = await findAvailableHeatAndLane(eventId);
      setSwimmerEvents(prev => prev.map(ev => {
        if (ev.eventId === eventId) {
          return { ...ev, isParticipating: true, heatNumber: avail.heatNumber, laneNumber: avail.laneNumber };
        }
        return ev;
      }));
    } else {
      setSwimmerEvents(prev => prev.map(ev => {
        if (ev.eventId === eventId) {
          return { ...ev, isParticipating: false };
        }
        return ev;
      }));
    }
  };

  const handleAddSwimmer = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (!fullName.trim() || !club.trim()) return;

    const targetMeetId = activeMeetId || 1;
    const newSwimmerId = (await db.swimmers.add({
      meetId: targetMeetId,
      sfiUid: sfiUid.trim() || `SFI-2026-TS-${1000 + swimmers.length + 1}`,
      name: fullName,
      gender,
      birthYear: Number(birthYear),
      ageGroup,
      club: club.trim()
    })) as number;

    const participating = addSwimmerEvents.filter(ev => ev.isParticipating);
    for (const ev of participating) {
      await db.laneAssignments.add({
        eventId: ev.eventId,
        heatNumber: ev.heatNumber,
        laneNumber: ev.laneNumber,
        swimmerId: newSwimmerId
      });
    }

    if (participating.length > 0) {
      window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
    }

    setIsModalOpen(false);
    loadSwimmers();
  };

  const handleUpdateSwimmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSwimmer || !editingSwimmer.id) return;

    const swimmerId = editingSwimmer.id;
    const updatedFullName = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(' ') || editingSwimmer.name;

    // 1. Update basic swimmer details
    await db.swimmers.update(swimmerId, {
      sfiUid: editingSwimmer.sfiUid?.trim(),
      name: updatedFullName,
      gender: editingSwimmer.gender,
      birthYear: Number(editingSwimmer.birthYear),
      ageGroup: editingSwimmer.ageGroup,
      club: editingSwimmer.club.trim()
    });

    // 2. Update participating events & lane assignments
    const existingAssigns = await db.laneAssignments.where('swimmerId').equals(swimmerId).toArray();
    const existingMap = new Map<number, typeof existingAssigns[0]>();
    existingAssigns.forEach(a => existingMap.set(Number(a.eventId), a));

    for (const evState of swimmerEvents) {
      const existing = existingMap.get(evState.eventId);

      if (evState.isParticipating) {
        if (!existing) {
          await db.laneAssignments.add({
            eventId: evState.eventId,
            heatNumber: evState.heatNumber,
            laneNumber: evState.laneNumber,
            swimmerId
          });
        } else if (existing.heatNumber !== evState.heatNumber || existing.laneNumber !== evState.laneNumber) {
          await db.laneAssignments.update(existing.id!, {
            heatNumber: evState.heatNumber,
            laneNumber: evState.laneNumber
          });
        }
      } else {
        if (existing && existing.id) {
          await db.laneAssignments.delete(existing.id);
        }
      }
    }

    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));

    setEditingSwimmer(null);
    loadSwimmers();
  };

  const requestDeleteSwimmer = (id: number) => {
    setDeleteSwimmerId(id);
  };

  const handleConfirmDeleteSwimmer = async () => {
    if (deleteSwimmerId !== null) {
      await db.swimmers.delete(deleteSwimmerId);
      setDeleteSwimmerId(null);
      loadSwimmers();
    }
  };

  // Smart Sync & Merge Scanner
  const handleSyncExcelData = async () => {
    setIsSyncing(true);
    try {
      const targetMeetId = activeMeetId || 1;
      const currentSwimmers = await db.swimmers.filter(s => s.meetId === targetMeetId).toArray();
      const existingAssigns = await db.laneAssignments.toArray();
      const allEvents = await db.events.toArray();
      
      const candidates: MergeCandidate[] = [];
      
      // Intelligent duplicate and merge detection
      for (let i = 0; i < currentSwimmers.length; i++) {
        for (let j = i + 1; j < currentSwimmers.length; j++) {
          const s1 = currentSwimmers[i];
          const s2 = currentSwimmers[j];
          
          const hasExactUid = Boolean(s1.sfiUid && s2.sfiUid && s1.sfiUid.toLowerCase().trim() === s2.sfiUid.toLowerCase().trim());
          const sim = computeSimilarity(s1.name, s2.name);
          const sameBirthYear = s1.birthYear === s2.birthYear;
          const sameGender = s1.gender === s2.gender;
          
          if (hasExactUid || (sim >= 0.8 && sameBirthYear && sameGender)) {
            // Found potential merge candidate
            const s2Assigns = existingAssigns.filter(a => a.swimmerId === s2.id);
            const s1Assigns = existingAssigns.filter(a => a.swimmerId === s1.id);
            const s1EventIds = new Set(s1Assigns.map(a => Number(a.eventId)));
            
            const eventsToAdd = s2Assigns
              .filter(a => a.eventId && !s1EventIds.has(Number(a.eventId)))
              .map(a => {
                const evObj = allEvents.find(e => e.id === a.eventId);
                return {
                  eventId: Number(a.eventId),
                  eventName: evObj ? `Event #${evObj.eventNo || evObj.id}: ${evObj.distance}m ${evObj.stroke}` : `Event #${a.eventId}`,
                  heatNumber: a.heatNumber,
                  laneNumber: a.laneNumber
                };
              });

            candidates.push({
              candidateId: `cand-${s1.id}-${s2.id}`,
              existingSwimmer: s1,
              importedSwimmer: {
                sfiUid: s2.sfiUid,
                name: s2.name,
                gender: s2.gender,
                birthYear: s2.birthYear || s1.birthYear || 1980,
                ageGroup: s2.ageGroup,
                club: s2.club,
                eventsToAdd
              },
              similarity: hasExactUid ? 1.0 : sim,
              matchType: hasExactUid ? `Exact SFI UID: ${s1.sfiUid}` : `${Math.round(sim * 100)}% Name & Category Match`
            });
          }
        }
      }
      
      if (candidates.length > 0) {
        setMergeCandidates(candidates);
      } else {
        await seedDatabase(true);
        await loadSwimmers();
        setSyncNotice('✓ Excel Sync Complete: All athlete profiles & heat entries verified with 0 duplicate collisions!');
        setTimeout(() => setSyncNotice(null), 5000);
      }
    } catch (e) {
      console.error('Error during sync:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMergeCandidate = async (candidate: MergeCandidate) => {
    const targetSwimmerId = candidate.existingSwimmer.id!;
    
    await db.swimmers.update(targetSwimmerId, {
      club: candidate.importedSwimmer.club || candidate.existingSwimmer.club,
      sfiUid: candidate.importedSwimmer.sfiUid || candidate.existingSwimmer.sfiUid
    });
    
    for (const ev of candidate.importedSwimmer.eventsToAdd) {
      await db.laneAssignments.add({
        eventId: ev.eventId,
        heatNumber: ev.heatNumber,
        laneNumber: ev.laneNumber,
        swimmerId: targetSwimmerId
      });
    }
    
    setMergeCandidates(prev => prev.filter(c => c.candidateId !== candidate.candidateId));
    await loadSwimmers();
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  const handleAddCandidateAsNew = async (candidate: MergeCandidate) => {
    const newId = await db.swimmers.add({
      meetId: activeMeetId || 1,
      sfiUid: candidate.importedSwimmer.sfiUid,
      name: candidate.importedSwimmer.name,
      gender: candidate.importedSwimmer.gender,
      birthYear: candidate.importedSwimmer.birthYear,
      ageGroup: candidate.importedSwimmer.ageGroup,
      club: candidate.importedSwimmer.club
    });
    
    for (const ev of candidate.importedSwimmer.eventsToAdd) {
      await db.laneAssignments.add({
        eventId: ev.eventId,
        heatNumber: ev.heatNumber,
        laneNumber: ev.laneNumber,
        swimmerId: Number(newId)
      });
    }
    
    setMergeCandidates(prev => prev.filter(c => c.candidateId !== candidate.candidateId));
    await loadSwimmers();
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  const handleDismissCandidate = (candidateId: string) => {
    setMergeCandidates(prev => prev.filter(c => c.candidateId !== candidateId));
  };

  const handleMergeAllCandidates = async () => {
    for (const candidate of mergeCandidates) {
      await handleMergeCandidate(candidate);
    }
    setMergeCandidates([]);
  };

  const filteredSwimmers = swimmers.filter(swimmer => {
    const matchesSearch = swimmer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (swimmer.sfiUid && swimmer.sfiUid.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          swimmer.club.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = filterGender === 'All' || swimmer.gender === filterGender;
    const matchesGroup = filterGroup === 'All' || swimmer.ageGroup === filterGroup;
    const matchesClub = filterClub === 'All' || swimmer.club === filterClub;

    return matchesSearch && matchesGender && matchesGroup && matchesClub;
  });

  return (
    <div className="glass-card">
      <div className="card-header flex justify-between items-center mb-4">
        <div>
          <h2 className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            Swimmer Registry
          </h2>
          {meetName && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-cyan)', fontWeight: 600 }}>
              Active Swim Meet: {meetName} ({swimmers.length} Registered Swimmers)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            style={{ color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.45)', background: 'rgba(250, 204, 21, 0.1)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setShowImportModal(true)}
            title="Import entries from Excel (.xlsx, .xls), CSV, or Event JSON"
          >
            <UploadCloud size={16} /> Import File
          </button>
          <button
            className="btn btn-secondary"
            style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => {
              if (window.touchteckApp?.openDataFolder) {
                window.touchteckApp.openDataFolder(meetName);
              }
            }}
            title="Open Meet Data Folder in Windows File Explorer"
          >
            <FolderOpen size={15} /> Open Meet Folder
          </button>
          <button className="btn btn-yellow" onClick={handleOpenAddModal}>
            <UserPlus size={18} /> Register Swimmer
          </button>
        </div>
      </div>

      {/* Sync Success Notification Notice */}
      {syncNotice && (
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#4ade80', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} /> {syncNotice}
        </div>
      )}

      {/* SMART MERGE & REVIEW INTERACTIVE BANNER (Yellow / Orange Container) */}
      {mergeCandidates.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08))',
          border: '1.5px solid #f59e0b',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ background: '#f59e0b', color: '#000', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} /> SMART MERGE DETECTED
              </span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fef08a' }}>
                {mergeCandidates.length} Potential Duplicate / Multi-Event Swimmer{mergeCandidates.length > 1 ? 's' : ''} Found
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-yellow"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={handleMergeAllCandidates}
                title="Merge all detected matches and append events"
              >
                <CheckCheck size={15} /> Merge All Verified Matches
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                onClick={() => setMergeCandidates([])}
                title="Dismiss merge review"
              >
                ✕ Dismiss
              </button>
            </div>
          </div>

          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: '#fde68a', lineHeight: 1.4 }}>
            The system detected swimmers in the updated data that match existing athletes in the registry. Choose whether to <strong>Merge Profile & Add New Events</strong> or <strong>Keep as Separate Swimmer</strong>:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            {mergeCandidates.map((cand) => (
              <div 
                key={cand.candidateId}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.25)', color: '#facc15', border: '1px solid rgba(245, 158, 11, 0.5)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                      {cand.matchType}
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#fff' }}>{cand.existingSwimmer.name}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>({cand.existingSwimmer.club})</span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    UID: <span style={{ color: '#67e8f9', fontWeight: 700 }}>{cand.existingSwimmer.sfiUid || 'NO-UID'}</span> • Category: {cand.existingSwimmer.gender === 'M' ? 'Men' : 'Women'} ({cand.existingSwimmer.ageGroup})
                    {cand.importedSwimmer.eventsToAdd.length > 0 && (
                      <div style={{ marginTop: '0.25rem', color: '#4ade80', fontWeight: 700 }}>
                        + Adding {cand.importedSwimmer.eventsToAdd.length} Event{cand.importedSwimmer.eventsToAdd.length > 1 ? 's' : ''}: {cand.importedSwimmer.eventsToAdd.map(e => e.eventName).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)', backgroundColor: 'rgba(74, 222, 128, 0.1)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    onClick={() => handleMergeCandidate(cand)}
                    title="Merge profile details and add any newly registered events"
                  >
                    <Check size={14} /> Merge & Add Events
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.4)', fontWeight: 700 }}
                    onClick={() => handleAddCandidateAsNew(cand)}
                    title="Keep as separate registered athlete"
                  >
                    + Keep Separate
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}
                    onClick={() => handleDismissCandidate(cand.candidateId)}
                    title="Skip"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Filter Toolbar */}
      <div className="flex gap-4 items-center mb-4 mt-4" style={{ flexWrap: 'wrap' }}>
        <div className="form-group mb-0" style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Search by SFI UID, name or ${affiliationLabel.toLowerCase()}...`}
              className="form-control"
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group mb-0" style={{ minWidth: '150px' }}>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Genders' },
              { value: 'M', label: 'Men (Male)' },
              { value: 'F', label: 'Women (Female)' }
            ]}
            value={filterGender}
            onChange={(val) => setFilterGender(val)}
          />
        </div>

        <div className="form-group mb-0" style={{ minWidth: '170px' }}>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Categories / Groups' },
              ...ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))
            ]}
            value={filterGroup}
            onChange={(val) => setFilterGroup(val)}
          />
        </div>

        <div className="form-group mb-0" style={{ minWidth: '170px' }}>
          <CustomSelect
            options={[
              { value: 'All', label: `All ${affiliationLabel}s` },
              ...clubsList.map(c => ({ value: c, label: c }))
            ]}
            value={filterClub}
            onChange={(val) => setFilterClub(val)}
          />
        </div>
      </div>

      {/* Swimmers Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>SFI UID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Birth Year</th>
              <th>Age Group</th>
              <th>{affiliationLabel.toUpperCase()}</th>
              <th>EVENTS</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSwimmers.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                  No registered swimmers found matching search criteria.
                </td>
              </tr>
            ) : (
              filteredSwimmers.map((swimmer, idx) => {
                const swEvents = (swimmer.id ? swimmerEventsMap.get(swimmer.id) : undefined) || [];
                const isExpanded = swimmer.id ? expandedSwimmerIds.has(swimmer.id) : false;
                const totalEvents = swEvents.length;

                return (
                  <tr 
                    key={swimmer.id}
                    onDoubleClick={() => swimmer.id && toggleSwimmerExpand(swimmer.id)}
                    style={{ cursor: 'pointer' }}
                    title="Click or double-click to view all assigned events"
                  >
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</td>
                    <td>
                      <span className="pill-info" style={{ borderColor: 'rgba(6,182,212,0.4)', color: '#67e8f9', fontWeight: 700 }}>
                        {swimmer.sfiUid || `SFI-2026-TS-${1001 + idx}`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#f8fafc' }}>{swimmer.name}</td>
                    <td>{swimmer.gender === 'M' ? 'Male' : 'Female'}</td>
                    <td>{swimmer.birthYear}</td>
                    <td>
                      <span className="pill-info" style={{ borderColor: 'var(--accent-blue)', color: '#93c5fd' }}>
                        {swimmer.ageGroup}
                      </span>
                    </td>
                    <td className="text-cyan">{swimmer.club}</td>
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
                                if (swimmer.id) toggleSwimmerExpand(swimmer.id);
                              }}
                              title={isExpanded ? 'Click to collapse events' : 'Click to see all events'}
                            >
                              {totalEvents} Events {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.3rem', marginTop: '0.35rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.45rem', borderRadius: '6px', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
                              {swEvents.map((a, aIdx) => (
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
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.55rem', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}
                          onClick={() => handleOpenEditModal(swimmer)}
                          title="Edit Swimmer Details & Participating Events"
                        >
                          <Edit size={15} /> Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.55rem', color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                          onClick={() => swimmer.id && requestDeleteSwimmer(swimmer.id)}
                          title="Delete Swimmer"
                        >
                          <Trash2 size={15} />
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

      {/* Register Swimmer Modal with Dual Tabs (Profile + Participating Events) */}
      {isModalOpen && createPortal(
        <div className={`modal-overlay${isAddModalClosing ? ' modal-closing' : ''}`} style={{ zIndex: 99999 }}>
          <div className={`modal-content${isAddModalClosing ? ' modal-closing' : ''}`} style={{ maxWidth: '680px', width: '92vw' }}>
            <div className="modal-header flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} /> Register New Swimmer
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {[firstName, lastName].filter(Boolean).join(' ') || 'New Athlete'} • {club.trim() || 'No Club'} ({gender === 'M' ? 'Men' : 'Women'}, {ageGroup})
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => closeAddModal(() => setIsModalOpen(false))}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem 0 1rem', background: 'rgba(15, 23, 42, 0.5)' }}>
              <button
                type="button"
                className={`btn ${activeAddTab === 'info' ? 'btn-yellow' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setActiveAddTab('info')}
              >
                <User size={15} /> Swimmer Profile
              </button>
              <button
                type="button"
                className={`btn ${activeAddTab === 'events' ? 'btn-cyan' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setActiveAddTab('events')}
              >
                <Activity size={15} /> Participating Events ({addSwimmerEvents.filter(e => e.isParticipating).length})
              </button>
            </div>

            <form onSubmit={handleAddSwimmer}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem' }}>
                {activeAddTab === 'info' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">SFI REGISTRATION UID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. SFI-2026-TS-1001"
                        value={sfiUid}
                        onChange={(e) => setSfiUid(e.target.value)}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">FIRST NAME</label>
                        <input
                          type="text"
                          required
                          className="form-control"
                          placeholder="e.g. LAKSHMI"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">LAST NAME</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. NARAYANA"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">GENDER</label>
                        <CustomSelect
                          options={[
                            { value: 'M', label: 'Male' },
                            { value: 'F', label: 'Female' }
                          ]}
                          value={gender}
                          onChange={(val) => setGender(val as 'M' | 'F')}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">BIRTH YEAR</label>
                        <input
                          type="number"
                          required
                          min={1930}
                          max={new Date().getFullYear()}
                          className="form-control"
                          value={birthYear}
                          onChange={(e) => setBirthYear(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">AGE GROUP / CATEGORY</label>
                        <CustomSelect
                          options={ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))}
                          value={ageGroup}
                          onChange={(val) => setAgeGroup(val as AgeGroup)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">DISTRICT / CLUB</label>
                        <input
                          type="text"
                          required
                          className="form-control"
                          placeholder="e.g. HYD, RR, WGL, KNR"
                          value={club}
                          onChange={(e) => setClub(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Category Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                        <Award size={16} /> Category: <span style={{ color: '#fff' }}>{gender === 'M' ? 'Men' : 'Women'} ({ageGroup})</span>
                      </div>
                      <div className="pill-info" style={{ borderColor: 'rgba(234, 179, 8, 0.45)', color: '#fde047', fontSize: '0.75rem', fontWeight: 700 }}>
                        {addSwimmerEvents.filter(e => e.gender === gender && e.ageGroup === ageGroup).length} Events in Category
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        Select events to register {[firstName, lastName].filter(Boolean).join(' ') || 'swimmer'}
                      </span>
                      <span className="pill-info" style={{ borderColor: 'rgba(6,182,212,0.4)', color: '#67e8f9', fontSize: '0.75rem' }}>
                        {addSwimmerEvents.filter(e => e.isParticipating).length} Checked
                      </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder={`Search ${gender === 'M' ? "men's" : "women's"} (${ageGroup}) events by stroke, distance...`}
                        className="form-control"
                        style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                        value={addEventSearchQuery}
                        onChange={(e) => setAddEventSearchQuery(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {(() => {
                        const curGender = gender;
                        const curAge = ageGroup;

                        const filtered = addSwimmerEvents.filter(ev => {
                          if (ev.gender !== curGender || ev.ageGroup !== curAge) return false;
                          if (addEventSearchQuery) {
                            const query = addEventSearchQuery.toLowerCase();
                            const title = `Event #${ev.eventNo || ev.eventId}: ${ev.distance}m ${ev.stroke}`.toLowerCase();
                            if (!title.includes(query)) return false;
                          }
                          return true;
                        });

                        // Prioritize matching category & checked events right at the TOP!
                        filtered.sort((a, b) => {
                          const aIsMatch = (a.gender === curGender && a.ageGroup === curAge) ? 1 : 0;
                          const bIsMatch = (b.gender === curGender && b.ageGroup === curAge) ? 1 : 0;
                          const aCheck = a.isParticipating ? 1 : 0;
                          const bCheck = b.isParticipating ? 1 : 0;

                          const aWeight = (aCheck * 2) + aIsMatch;
                          const bWeight = (bCheck * 2) + bIsMatch;

                          if (aWeight !== bWeight) return bWeight - aWeight;
                          return (a.eventNo || a.eventId) - (b.eventNo || b.eventId);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              No matching events found. Click "All Events" to select from all categories.
                            </div>
                          );
                        }

                        return filtered.map(ev => {
                          const isCategoryMatch = ev.gender === curGender && ev.ageGroup === curAge;
                          return (
                            <div
                              key={ev.eventId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: ev.isParticipating 
                                  ? '1px solid rgba(6, 182, 212, 0.6)' 
                                  : isCategoryMatch 
                                    ? '1px solid rgba(234, 179, 8, 0.5)' 
                                    : '1px solid var(--border-color)',
                                background: ev.isParticipating 
                                  ? 'rgba(6, 182, 212, 0.12)' 
                                  : isCategoryMatch 
                                    ? 'rgba(234, 179, 8, 0.08)' 
                                    : 'rgba(15, 23, 42, 0.4)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: 1, margin: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={ev.isParticipating}
                                  onChange={() => handleToggleAddEventParticipation(ev.eventId)}
                                  style={{ width: '17px', height: '17px', accentColor: '#06b6d4', cursor: 'pointer' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: ev.isParticipating ? '#67e8f9' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Event #{ev.eventNo || ev.eventId}: {ev.distance}m {ev.stroke}
                                    {isCategoryMatch && (
                                      <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <Award size={11} /> Category Match
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {ev.gender === 'M' ? 'Men' : 'Women'} ({ev.ageGroup})
                                  </div>
                                </div>
                              </label>

                              {ev.isParticipating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>Heat:</span>
                                    <select
                                      className="form-control"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', height: '26px', width: '55px' }}
                                      value={ev.heatNumber}
                                      onChange={(e) => {
                                        const hNum = Number(e.target.value);
                                        setAddSwimmerEvents(prev => prev.map(item => item.eventId === ev.eventId ? { ...item, heatNumber: hNum } : item));
                                      }}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                                        <option key={h} value={h}>H{h}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>Lane:</span>
                                    <select
                                      className="form-control"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', height: '26px', width: '55px' }}
                                      value={ev.laneNumber}
                                      onChange={(e) => {
                                        const lNum = Number(e.target.value);
                                        setAddSwimmerEvents(prev => prev.map(item => item.eventId === ev.eventId ? { ...item, laneNumber: lNum } : item));
                                      }}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8].map(l => (
                                        <option key={l} value={l}>L{l}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                    onClick={() => handleToggleAddEventParticipation(ev.eventId)}
                                    title="Remove swimmer from this event"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}

                              {!ev.isParticipating && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  onClick={() => handleToggleAddEventParticipation(ev.eventId)}
                                  title="Add swimmer to this event"
                                >
                                  <Plus size={13} /> Add Event
                                </button>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeAddModal(() => setIsModalOpen(false))}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Save size={16} /> Register Swimmer & Events
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Swimmer Details & Participating Events Modal */}
      {editingSwimmer && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '680px', width: '92vw' }}>
            <div className="modal-header flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit size={18} /> Edit Swimmer & Participating Events
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {editingSwimmer.name} • {editingSwimmer.club} ({editingSwimmer.gender === 'M' ? 'Men' : 'Women'}, {editingSwimmer.ageGroup})
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => setEditingSwimmer(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', padding: '0.5rem 1rem 0 1rem', background: 'rgba(15, 23, 42, 0.5)' }}>
              <button
                type="button"
                className={`btn ${activeEditTab === 'info' ? 'btn-yellow' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setActiveEditTab('info')}
              >
                <User size={15} /> Swimmer Profile
              </button>
              <button
                type="button"
                className={`btn ${activeEditTab === 'events' ? 'btn-cyan' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '6px 6px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setActiveEditTab('events')}
              >
                <Activity size={15} /> Participating Events ({swimmerEvents.filter(e => e.isParticipating).length})
              </button>
            </div>

            <form onSubmit={handleUpdateSwimmer}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1rem' }}>
                {activeEditTab === 'info' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">SFI Registration UID</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editingSwimmer.sfiUid || ''}
                        onChange={(e) => setEditingSwimmer({ ...editingSwimmer, sfiUid: e.target.value })}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">FIRST NAME</label>
                        <input
                          type="text"
                          required
                          className="form-control"
                          placeholder="First Name"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">LAST NAME</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Last Name"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Gender</label>
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
                        <label className="form-label">Birth Year</label>
                        <input
                          type="number"
                          required
                          className="form-control"
                          value={editingSwimmer.birthYear}
                          onChange={(e) => setEditingSwimmer({ ...editingSwimmer, birthYear: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Age Group / Category</label>
                        <CustomSelect
                          options={ALL_AGE_GROUPS.map(ag => ({ value: ag, label: ag }))}
                          value={editingSwimmer.ageGroup}
                          onChange={(val) => setEditingSwimmer({ ...editingSwimmer, ageGroup: val as AgeGroup })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">District / Club</label>
                        <input
                          type="text"
                          required
                          className="form-control"
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
                        {swimmerEvents.filter(e => e.gender === editingSwimmer.gender && e.ageGroup === editingSwimmer.ageGroup).length} Events in Category
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        Select events to add or remove {editingSwimmer.name}
                      </span>
                      <span className="pill-info" style={{ borderColor: 'rgba(6,182,212,0.4)', color: '#67e8f9', fontSize: '0.75rem' }}>
                        {swimmerEvents.filter(e => e.isParticipating).length} Checked
                      </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder={`Search ${editingSwimmer.gender === 'M' ? "men's" : "women's"} (${editingSwimmer.ageGroup}) events by stroke, distance...`}
                        className="form-control"
                        style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {(() => {
                        const curGender = editingSwimmer.gender;
                        const curAge = editingSwimmer.ageGroup;

                        const filtered = swimmerEvents.filter(ev => {
                          if (ev.gender !== curGender || ev.ageGroup !== curAge) return false;
                          if (eventSearchQuery) {
                            const query = eventSearchQuery.toLowerCase();
                            const title = `Event #${ev.eventNo || ev.eventId}: ${ev.distance}m ${ev.stroke}`.toLowerCase();
                            if (!title.includes(query)) return false;
                          }
                          return true;
                        });

                        // Prioritize matching category & checked events right at the TOP!
                        filtered.sort((a, b) => {
                          const aIsMatch = (a.gender === curGender && a.ageGroup === curAge) ? 1 : 0;
                          const bIsMatch = (b.gender === curGender && b.ageGroup === curAge) ? 1 : 0;
                          const aCheck = a.isParticipating ? 1 : 0;
                          const bCheck = b.isParticipating ? 1 : 0;

                          const aWeight = (aCheck * 2) + aIsMatch;
                          const bWeight = (bCheck * 2) + bIsMatch;

                          if (aWeight !== bWeight) return bWeight - aWeight;
                          return (a.eventNo || a.eventId) - (b.eventNo || b.eventId);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              No matching events found. Click "All Events" to select from all categories.
                            </div>
                          );
                        }

                        return filtered.map(ev => {
                          const isCategoryMatch = ev.gender === curGender && ev.ageGroup === curAge;
                          return (
                            <div
                              key={ev.eventId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: ev.isParticipating 
                                  ? '1px solid rgba(6, 182, 212, 0.6)' 
                                  : isCategoryMatch 
                                    ? '1px solid rgba(234, 179, 8, 0.5)' 
                                    : '1px solid var(--border-color)',
                                background: ev.isParticipating 
                                  ? 'rgba(6, 182, 212, 0.12)' 
                                  : isCategoryMatch 
                                    ? 'rgba(234, 179, 8, 0.08)' 
                                    : 'rgba(15, 23, 42, 0.4)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: 1, margin: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={ev.isParticipating}
                                  onChange={() => handleToggleEventParticipation(ev.eventId)}
                                  style={{ width: '17px', height: '17px', accentColor: '#06b6d4', cursor: 'pointer' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: ev.isParticipating ? '#67e8f9' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Event #{ev.eventNo || ev.eventId}: {ev.distance}m {ev.stroke}
                                    {isCategoryMatch && (
                                      <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <Award size={11} /> Category Match
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {ev.gender === 'M' ? 'Men' : 'Women'} ({ev.ageGroup})
                                  </div>
                                </div>
                              </label>

                              {ev.isParticipating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>Heat:</span>
                                    <select
                                      className="form-control"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', height: '26px', width: '55px' }}
                                      value={ev.heatNumber}
                                      onChange={(e) => {
                                        const hNum = Number(e.target.value);
                                        setSwimmerEvents(prev => prev.map(item => item.eventId === ev.eventId ? { ...item, heatNumber: hNum } : item));
                                      }}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                                        <option key={h} value={h}>H{h}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>Lane:</span>
                                    <select
                                      className="form-control"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', height: '26px', width: '55px' }}
                                      value={ev.laneNumber}
                                      onChange={(e) => {
                                        const lNum = Number(e.target.value);
                                        setSwimmerEvents(prev => prev.map(item => item.eventId === ev.eventId ? { ...item, laneNumber: lNum } : item));
                                      }}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8].map(l => (
                                        <option key={l} value={l}>L{l}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                    onClick={() => handleToggleEventParticipation(ev.eventId)}
                                    title="Remove swimmer from this event"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}

                              {!ev.isParticipating && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  onClick={() => handleToggleEventParticipation(ev.eventId)}
                                  title="Add swimmer to this event"
                                >
                                  <Plus size={13} /> Add Event
                                </button>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingSwimmer(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Save size={16} /> Save Changes & Events
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Delete Swimmer */}
      <ConfirmationModal
        isOpen={deleteSwimmerId !== null}
        title="Delete Swimmer"
        message="Are you sure you want to remove this swimmer from the registry?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeleteSwimmer}
        onCancel={() => setDeleteSwimmerId(null)}
      />

      <SmartImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        activeMeetId={activeMeetId}
        onImportComplete={loadSwimmers}
      />
    </div>
  );
}
