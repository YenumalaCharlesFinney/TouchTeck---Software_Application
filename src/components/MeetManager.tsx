import React, { useState, useEffect } from 'react';
import { db, Meet, Event, Swimmer, LaneAssignment, seedDatabase } from '../db';
import { Calendar, Plus, Users, Award, ShieldAlert, UserX, Trash2, Edit, Save, X, RotateCcw } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';

interface MeetManagerProps {
  activeMeetId?: number | null;
  setActiveMeetId?: (id: number | null) => void;
  activeEventId?: number | null;
  setActiveEventId?: (id: number | null) => void;
  activeHeatNum?: number;
  setActiveHeatNum?: (num: number) => void;
}

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

  // Meet Create Form State
  const [meetName, setMeetName] = useState('');
  const [meetDate, setMeetDate] = useState('');
  const [meetLocation, setMeetLocation] = useState('');

  // Event Create Form State
  const [distance, setDistance] = useState<number>(50);
  const [stroke, setStroke] = useState<Event['stroke']>('Freestyle');
  const [gender, setGender] = useState<Event['gender']>('M');
  const [ageGroup, setAgeGroup] = useState<Event['ageGroup']>('Group A');

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
  }, []);

  useEffect(() => {
    if (selectedMeetId) {
      loadEvents(selectedMeetId);
    } else {
      setEvents([]);
      setSelectedEventId(null);
    }
  }, [selectedMeetId]);

  useEffect(() => {
    if (selectedEventId) {
      loadHeatsAndAssignments(selectedEventId, selectedHeatNum);
      loadEligibleSwimmers(selectedEventId);
    } else {
      setLaneAssignments([]);
      setEligibleSwimmers([]);
    }
  }, [selectedEventId, selectedHeatNum]);

  const loadMeets = async () => {
    const list = await db.meets.toArray();
    setMeets(list);
    if (list.length > 0 && !selectedMeetId) {
      setSelectedMeetId(list[0].id || null);
    }
  };

  const loadEvents = async (meetId: number) => {
    const list = await db.events.where('meetId').equals(meetId).toArray();
    setEvents(list);
    if (list.length > 0) {
      setSelectedEventId(list[0].id || null);
      setSelectedHeatNum(1);
    } else {
      setSelectedEventId(null);
    }
  };

  const loadHeatsAndAssignments = async (eventId: number, heatNum: number) => {
    // 1. Get assignments for this event + heat
    const assignments = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(eventId) && Number(a.heatNumber) === Number(heatNum))
      .toArray();

    // Ensure we have assignments for all 8 lanes
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

    // Find all distinct heat numbers for this event
    const allAssignmentsForEvent = await db.laneAssignments.where('eventId').equals(eventId).toArray();
    const uniqueHeats = Array.from(new Set(allAssignmentsForEvent.map(a => a.heatNumber)));
    if (!uniqueHeats.includes(heatNum)) {
      uniqueHeats.push(heatNum);
    }
    // Sort heats ascending
    setHeats(uniqueHeats.sort((a, b) => a - b));
  };

  const loadEligibleSwimmers = async (eventId: number) => {
    const event = await db.events.get(eventId);
    if (!event) return;

    // Get swimmers matching the event's gender and ageGroup
    const list = await db.swimmers
      .where('ageGroup')
      .equals(event.ageGroup)
      .filter(s => s.gender === event.gender && (s.meetId || 1) === (event.meetId || 1))
      .toArray();

    setEligibleSwimmers(list);
  };

  // Collapsible Form States
  const [isCreatingMeet, setIsCreatingMeet] = useState<boolean>(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);

  // Edit & Delete Confirmation States
  const [editingMeetId, setEditingMeetId] = useState<number | null>(null);
  const [showDeleteMeetConfirm, setShowDeleteMeetConfirm] = useState<boolean>(false);
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState<boolean>(false);

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

    setMeetName('');
    setMeetLocation('');
    setMeetDate('');
    setIsCreatingMeet(false);
    loadMeets();
  };

  const handleConfirmDeleteMeet = async () => {
    setShowDeleteMeetConfirm(false);
    if (!selectedMeetId) return;

    const meetToDelete = selectedMeetId;
    const relatedEvents = await db.events.where('meetId').equals(meetToDelete).toArray();
    for (const ev of relatedEvents) {
      if (ev.id) {
        await db.events.delete(ev.id);
        const assignments = await db.laneAssignments.filter(a => Number(a.eventId) === ev.id).toArray();
        for (const a of assignments) { if (a.id) await db.laneAssignments.delete(a.id); }
        const results = await db.results.where('eventId').equals(ev.id).toArray();
        for (const r of results) { if (r.id) await db.results.delete(r.id); }
      }
    }

    await db.meets.delete(meetToDelete);
    setSelectedMeetId(null);
    handleCancelEditMeet();
    loadMeets();
  };

  const handleConfirmDeleteEvent = async () => {
    setShowDeleteEventConfirm(false);
    if (!selectedEventId) return;

    const eventToDelete = selectedEventId;
    const assignments = await db.laneAssignments.filter(a => Number(a.eventId) === eventToDelete).toArray();
    for (const a of assignments) { if (a.id) await db.laneAssignments.delete(a.id); }
    const results = await db.results.where('eventId').equals(eventToDelete).toArray();
    for (const r of results) { if (r.id) await db.results.delete(r.id); }

    await db.events.delete(eventToDelete);
    setSelectedEventId(null);
    if (selectedMeetId) loadEvents(selectedMeetId);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetId) return;

    // Check if an event with the exact same distance, stroke, gender, and age group already exists
    const duplicate = await db.events
      .where('meetId')
      .equals(selectedMeetId)
      .filter(ev => 
        ev.distance === distance &&
        ev.stroke === stroke &&
        ev.gender === gender &&
        ev.ageGroup === ageGroup
      )
      .first();

    if (duplicate) {
      alert(`⚠️ Duplicate Event Notice:\n"${distance}m ${stroke} - ${gender === 'M' ? 'Men' : 'Women'} (${ageGroup})" already exists in this swim meet.`);
      setSelectedEventId(duplicate.id!);
      setIsCreatingEvent(false);
      return;
    }

    const id = await db.events.add({
      meetId: selectedMeetId,
      distance,
      stroke,
      gender,
      ageGroup
    });

    loadEvents(selectedMeetId);
    setSelectedEventId(id);
    setSelectedHeatNum(1);
    setIsCreatingEvent(false);
  };

  const handleLaneChange = async (laneNumber: number, swimmerIdStr: string) => {
    if (!selectedEventId) return;

    const swimmerId = swimmerIdStr === '' ? undefined : Number(swimmerIdStr);
    
    // Find if database already has a lane record
    const existing = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(selectedEventId) && Number(a.heatNumber) === Number(selectedHeatNum) && Number(a.laneNumber) === Number(laneNumber))
      .first();

    if (existing) {
      if (swimmerId === undefined) {
        // Delete assignment
        if (existing.id) await db.laneAssignments.delete(existing.id);
      } else {
        // Update assignment
        existing.swimmerId = swimmerId;
        await db.laneAssignments.put(existing);
      }
    } else if (swimmerId !== undefined) {
      // Add new assignment
      await db.laneAssignments.add({
        eventId: Number(selectedEventId),
        heatNumber: Number(selectedHeatNum),
        laneNumber,
        swimmerId
      });
    }

    loadHeatsAndAssignments(selectedEventId, selectedHeatNum);
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  const addHeat = () => {
    const nextHeat = heats.length > 0 ? Math.max(...heats) + 1 : 1;
    setSelectedHeatNum(nextHeat);
  };

  const handleClearAllLanes = async () => {
    if (!selectedEventId) return;
    const existingAssignments = await db.laneAssignments
      .filter(a => Number(a.eventId) === Number(selectedEventId) && Number(a.heatNumber) === Number(selectedHeatNum))
      .toArray();

    for (const a of existingAssignments) {
      if (a.id) await db.laneAssignments.delete(a.id);
    }
    loadHeatsAndAssignments(selectedEventId, selectedHeatNum);
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
  };

  // Helper to get swimmer name in dropdown
  const getSwimmerName = (swimmerId?: number) => {
    if (!swimmerId) return '';
    const match = eligibleSwimmers.find(s => s.id === swimmerId);
    return match ? `${match.name} (${match.club})` : `Swimmer #${swimmerId}`;
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleResetDemoData = async () => {
    if (window.confirm('Restore initial sample demo data for "National Selection Trials 2026"?')) {
      const newMeetId = await seedDatabase(true);
      const allMeets = await db.meets.toArray();
      setMeets(allMeets);
      if (newMeetId) {
        setSelectedMeetId(newMeetId);
        if (setActiveMeetId) setActiveMeetId(newMeetId);
        loadEvents(newMeetId);
      }
    }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
      
      {/* Sidebar: Meet and Event configuration */}
      <div className="flex flex-col gap-4">
        {/* Meet Manager */}
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
              placeholder="Select a Swim Meet"
              onChange={(val) => {
                handleCancelEditMeet();
                setSelectedMeetId(Number(val));
              }}
            />
          </div>

          {!isCreatingMeet && !editingMeetId ? (
            <div className="flex flex-col gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderStyle: 'dashed' }}
                onClick={() => setIsCreatingMeet(true)}
              >
                <Plus size={16} /> Create New Meet
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                onClick={handleResetDemoData}
                title="Restore sample swimmers, events, cutoffs, and heats for National Selection Trials 2026"
              >
                <RotateCcw size={14} /> Restore Demo Data
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveMeet} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: editingMeetId ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                  {editingMeetId ? '✏️ Edit Meet Details' : 'Create Meet'}
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

        {/* Event Manager */}
        {selectedMeetId && (
          <div className="glass-card">
            <h3 className="settings-header"><Award size={18} /> Event Scheduler</h3>
            
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label mb-0">Active Event</label>
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
                options={events.map(ev => ({
                  value: ev.id!,
                  label: `${ev.distance}m ${ev.stroke} - ${ev.gender === 'M' ? 'Men' : 'Women'} (${ev.ageGroup})`
                }))}
                value={selectedEventId || ''}
                placeholder="No events created"
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
                  <label className="form-label">Distance</label>
                  <CustomSelect
                    options={getAvailableDistances(stroke).map(d => ({ value: d, label: `${d} m` }))}
                    value={distance}
                    onChange={(val) => setDistance(Number(val))}
                  />
                </div>

                <div className="form-group">
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
                    onChange={(val) => handleStrokeChange(val as any)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <CustomSelect
                      options={[
                        { value: 'M', label: 'Men' },
                        { value: 'F', label: 'Women' }
                      ]}
                      value={gender}
                      onChange={(val) => setGender(val as any)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Age Group</label>
                    <CustomSelect
                      options={[
                        { value: 'Group A', label: 'Group A' },
                        { value: 'Group B', label: 'Group B' },
                        { value: 'Group C', label: 'Group C' },
                        { value: 'Group D', label: 'Group D' }
                      ]}
                      value={ageGroup}
                      onChange={(val) => setAgeGroup(val as any)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  <Plus size={16} /> Add Event
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Heat Lane Assigner */}
      <div className="glass-card">
        {selectedEventId ? (
          <div>
            <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Lane Assignments {selectedEvent ? `— Event #${selectedEvent.id}: ${selectedEvent.distance}m ${selectedEvent.stroke}` : ''}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-cyan)', marginTop: '0.25rem' }}>
                  {selectedEvent 
                    ? `${selectedEvent.gender === 'M' ? 'Men' : 'Women'} (${selectedEvent.ageGroup}) • Heat ${selectedHeatNum}`
                    : 'Assigning lanes 1 to 8 for the selected event.'}
                </p>
              </div>

              {/* Heat Navigation & Actions */}
              <div className="flex gap-3 items-center">
                <div className="flex gap-2 items-center">
                  <span className="form-label mb-0" style={{ marginRight: '0.5rem' }}>Heat:</span>
                  <div className="nav-tabs" style={{ padding: '2px' }}>
                    {heats.map(h => (
                      <button
                        key={h}
                        className={`nav-tab ${selectedHeatNum === h ? 'active' : ''}`}
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => setSelectedHeatNum(h)}
                      >
                        Heat {h}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem' }} onClick={addHeat} title="Add New Heat">
                    <Plus size={16} />
                  </button>
                </div>

                {laneAssignments.some(a => a.swimmerId) && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ color: 'var(--accent-red)', fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: 'rgba(239, 68, 68, 0.3)' }} 
                    onClick={handleClearAllLanes}
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
                <span>No swimmers registered match the age group and gender criteria for this event. Go to Swimmer Registry to add eligible participants!</span>
              </div>
            )}

            <div className="scoreboard-container" style={{ gap: '0.5rem' }}>
              {laneAssignments.map(assignment => (
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
                      options={[
                        { value: '', label: '[ Empty Lane ]' },
                        ...eligibleSwimmers.map(swimmer => ({
                          value: swimmer.id!,
                          label: `${swimmer.name} (${swimmer.club})`
                        })),
                        ...(assignment.swimmerId && !eligibleSwimmers.find(s => s.id === assignment.swimmerId)
                          ? [{ value: assignment.swimmerId, label: getSwimmerName(assignment.swimmerId) }]
                          : [])
                      ]}
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
              ))}
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
        ) : (
          <div className="text-center" style={{ padding: '4rem 2rem', color: 'var(--text-muted)' }}>
            <Award size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <h3>No Event Selected</h3>
            <p className="mt-2">Please select or create an event in the sidebar to configure heat lane assignments.</p>
          </div>
        )}
      </div>
    </div>

      <ConfirmationModal
        isOpen={showDeleteMeetConfirm}
        title="Delete Swim Meet"
        message={`Are you sure you want to delete "${meets.find(m => m.id === selectedMeetId)?.name || 'this meet'}"? All associated events, heats, and timing results will be permanently removed.`}
        confirmText="Delete Meet"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteMeet}
        onCancel={() => setShowDeleteMeetConfirm(false)}
      />

      <ConfirmationModal
        isOpen={showDeleteEventConfirm}
        title="Delete Swimming Event"
        message={`Are you sure you want to delete this event? All associated lane assignments and timing results for this event will be removed.`}
        confirmText="Delete Event"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteEvent}
        onCancel={() => setShowDeleteEventConfirm(false)}
      />
    </>
  );
}
