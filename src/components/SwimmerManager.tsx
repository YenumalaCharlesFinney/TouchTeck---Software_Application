import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, Swimmer } from '../db';
import { UserPlus, Trash2, Search, Filter } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import { useModalClose } from '../hooks/useModalClose';

interface SwimmerManagerProps {
  activeMeetId?: number | null;
}

export default function SwimmerManager({ activeMeetId }: SwimmerManagerProps) {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [meetName, setMeetName] = useState<string>('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthYear, setBirthYear] = useState(new Date().getFullYear() - 15);
  const [ageGroup, setAgeGroup] = useState<'Group A' | 'Group B' | 'Group C' | 'Group D'>('Group A');
  const [club, setClub] = useState('');
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterClub, setFilterClub] = useState<string>('All');
  const [clubsList, setClubsList] = useState<string[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteSwimmerId, setDeleteSwimmerId] = useState<number | null>(null);
  const { isClosing: isAddModalClosing, triggerClose: closeAddModal } = useModalClose();

  useEffect(() => {
    loadSwimmers();
  }, [activeMeetId]);

  const loadSwimmers = async () => {
    const targetMeetId = activeMeetId || 1;
    const meet = await db.meets.get(targetMeetId);
    if (meet) setMeetName(meet.name);

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
  };

  const handleAddSwimmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !club.trim()) return;

    await db.swimmers.add({
      meetId: activeMeetId || 1,
      name: name.trim(),
      gender,
      birthYear: Number(birthYear),
      ageGroup,
      club: club.trim()
    });

    // Reset Form
    setName('');
    setClub('');
    setIsModalOpen(false);
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

  // Filter Logic
  const filteredSwimmers = swimmers.filter(swimmer => {
    const matchesSearch = swimmer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          swimmer.club.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = filterGroup === 'All' || swimmer.ageGroup === filterGroup;
    const matchesClub = filterClub === 'All' || swimmer.club === filterClub;

    return matchesSearch && matchesGroup && matchesClub;
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
              Active Swim Meet: {meetName} ({swimmers.length} Swimmers Registered)
            </span>
          )}
        </div>
        <button className="btn btn-yellow" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} /> Add Swimmer
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex gap-4 items-center mb-4 mt-4" style={{ flexWrap: 'wrap' }}>
        <div className="form-group mb-0" style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or district..."
              className="form-control"
              style={{ paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group mb-0" style={{ minWidth: '170px' }}>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Age Groups' },
              { value: 'Group A', label: 'Group A' },
              { value: 'Group B', label: 'Group B' },
              { value: 'Group C', label: 'Group C' },
              { value: 'Group D', label: 'Group D' }
            ]}
            value={filterGroup}
            onChange={(val) => setFilterGroup(val)}
          />
        </div>

        <div className="form-group mb-0" style={{ minWidth: '170px' }}>
          <CustomSelect
            options={[
              { value: 'All', label: 'All Districts' },
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
              <th>ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Birth Year</th>
              <th>Age Group</th>
              <th>District</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSwimmers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                  No swimmers found matching criteria.
                </td>
              </tr>
            ) : (
              filteredSwimmers.map(swimmer => (
                <tr key={swimmer.id}>
                  <td>#{swimmer.id}</td>
                  <td style={{ fontWeight: 600 }}>{swimmer.name}</td>
                  <td>{swimmer.gender === 'M' ? 'Male' : 'Female'}</td>
                  <td>{swimmer.birthYear}</td>
                  <td>
                    <span className="pill-info" style={{ borderColor: 'var(--accent-blue)', color: '#93c5fd' }}>
                      {swimmer.ageGroup}
                    </span>
                  </td>
                  <td className="text-cyan">{swimmer.club}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', color: 'var(--accent-red)' }}
                      onClick={() => swimmer.id && requestDeleteSwimmer(swimmer.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Swimmer Modal */}
      {isModalOpen && createPortal(
        <div className={`modal-overlay${isAddModalClosing ? ' modal-closing' : ''}`} style={{ zIndex: 99999 }}>
          <div className={`modal-content${isAddModalClosing ? ' modal-closing' : ''}`}>
            <div className="modal-header">
              <h3>Register New Swimmer</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => closeAddModal(() => setIsModalOpen(false))}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSwimmer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Gender</label>
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
                    <label className="form-label">Birth Year</label>
                    <input
                      type="number"
                      required
                      min={1990}
                      max={new Date().getFullYear()}
                      className="form-control"
                      value={birthYear}
                      onChange={(e) => setBirthYear(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-row">
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

                  <div className="form-group">
                    <label className="form-label">District / Affiliation</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. Ranga Reddy"
                      value={club}
                      onChange={(e) => setClub(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeAddModal(() => setIsModalOpen(false))}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-cyan">
                  Save Swimmer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmationModal
        isOpen={deleteSwimmerId !== null}
        title="Delete Swimmer"
        message="Are you sure you want to delete this swimmer?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteSwimmer}
        onCancel={() => setDeleteSwimmerId(null)}
      />
    </div>
  );
}
