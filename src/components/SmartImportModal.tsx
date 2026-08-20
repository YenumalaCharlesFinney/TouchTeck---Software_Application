import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { db, Event, Swimmer, AgeGroup, LaneAssignment } from '../db';
import { UploadCloud, AlertTriangle, X, Database } from 'lucide-react';
import { EventDataFilePayload } from '../utils/eventStorage';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMeetId?: number | null;
  onImportComplete?: () => void | Promise<void>;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  activeMeetId,
  onImportComplete
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  if (!isOpen) return null;

  const handleCancelAndClose = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
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
    setProgressStatus('Reading file data...');

    try {
      const meetId = activeMeetId || (await db.meets.toArray())[0]?.id || 1;
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.json')) {
        await processJsonFile(file, meetId);
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
        await processSpreadsheetFile(file, meetId);
      } else {
        throw new Error('Unsupported file format. Please upload an Excel (.xlsx, .xls), CSV (.csv), or JSON (.json) file.');
      }
    } catch (err: any) {
      if (isCancelledRef.current) return;
      console.error('Import error:', err);
      setErrorMsg(err.message || 'Failed to parse data file.');
      setIsProcessing(false);
    }
  };

  const processJsonFile = async (file: File, meetId: number) => {
    setProgressPercent(30);
    setProgressStatus('Parsing JSON event payload...');
    const text = await file.text();
    if (isCancelledRef.current) return;
    const parsed = JSON.parse(text);

    await db.transaction('rw', [db.events, db.swimmers, db.laneAssignments], async () => {
      if (isCancelledRef.current) return;
      const existingSwimmers = await db.swimmers.where('meetId').equals(meetId).toArray();
      const swimmerMapByUid = new Map<string, Swimmer>();
      const swimmerMapByName = new Map<string, Swimmer>();
      existingSwimmers.forEach(s => {
        if (s.sfiUid) swimmerMapByUid.set(s.sfiUid.toLowerCase().trim(), s);
        swimmerMapByName.set(s.name.toLowerCase().trim(), s);
      });

      const existingEvents = await db.events.where('meetId').equals(meetId).toArray();
      const eventCache = new Map<string, Event>();
      existingEvents.forEach(e => eventCache.set(`${e.distance}_${e.stroke}_${e.gender}_${e.ageGroup}`, e));

      if (parsed.event && parsed.heats) {
        const payload = parsed as EventDataFilePayload;
        const evKey = `${payload.event.distance}_${payload.event.stroke}_${payload.event.gender}_${payload.event.ageGroup}`;
        let evRecord = eventCache.get(evKey);

        if (!evRecord) {
          const newEvId = await db.events.add({
            meetId,
            eventNo: payload.event.eventNo || (existingEvents.length + 1),
            distance: payload.event.distance,
            stroke: payload.event.stroke as Event['stroke'],
            gender: payload.event.gender,
            ageGroup: payload.event.ageGroup as AgeGroup
          });
          evRecord = await db.events.get(Number(newEvId));
        }

        for (const h of payload.heats) {
          for (const l of h.lanes) {
            if (l.swimmer && l.swimmer.name) {
              const cleanUid = l.swimmer.sfiUid ? l.swimmer.sfiUid.toLowerCase().trim() : '';
              const cleanName = l.swimmer.name.toLowerCase().trim();
              const existingSw = (cleanUid ? swimmerMapByUid.get(cleanUid) : undefined) || swimmerMapByName.get(cleanName);
              let swId: number | undefined;

              if (existingSw && existingSw.id) {
                swId = existingSw.id;
                await db.swimmers.update(existingSw.id, {
                  club: l.swimmer.club || existingSw.club,
                  birthYear: l.swimmer.birthYear || existingSw.birthYear,
                  sfiUid: l.swimmer.sfiUid || existingSw.sfiUid
                });
              } else {
                const newSwId = await db.swimmers.add({
                  meetId,
                  sfiUid: l.swimmer.sfiUid || '',
                  name: l.swimmer.name.trim(),
                  gender: (l.swimmer.gender as 'M' | 'F') || payload.event.gender,
                  birthYear: l.swimmer.birthYear,
                  ageGroup: (l.swimmer.ageGroup as AgeGroup) || payload.event.ageGroup,
                  club: l.swimmer.club || 'Unattached'
                });
                swId = Number(newSwId);
              }

              if (evRecord?.id && swId) {
                await db.laneAssignments.add({
                  eventId: evRecord.id,
                  heatNumber: h.heatNumber,
                  laneNumber: l.laneNumber,
                  swimmerId: swId
                });
              }
            }
          }
        }
      }
    });

    if (isCancelledRef.current) return;
    onClose();
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
    if (onImportComplete) onImportComplete();
  };

  const processSpreadsheetFile = async (file: File, meetId: number) => {
    setProgressPercent(5);
    setProgressStatus('Reading sheets & schedule configuration...');

    const arrayBuffer = await file.arrayBuffer();
    if (isCancelledRef.current) return;
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 1. Check Meet Info sheet
    const meetInfoSheet = workbook.Sheets['Meet Info'];
    let meetConfigToUpdate: any = null;
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
        meetConfigToUpdate = {
          name: parsedMeetName,
          date: parsedDate || new Date().toISOString().split('T')[0],
          location: parsedLocation,
          poolType: parsedPoolLength,
          lanes: parsedLanes
        };
      }
    }

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
      throw new Error('No valid athlete or event rows found below the header row.');
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

    const uniqueSwimmersMap = new Map<string, {
      meetId: number;
      sfiUid?: string;
      name: string;
      gender: 'M' | 'F';
      birthYear?: number;
      ageGroup: AgeGroup;
      club: string;
    }>();

    const uniqueEventsMap = new Map<string, {
      meetId: number;
      eventNo: number;
      distance: number;
      stroke: Event['stroke'];
      gender: 'M' | 'F';
      ageGroup: AgeGroup;
    }>();

    interface RawAssignment {
      eventKey: string;
      swimmerKey: string;
      heatNumber: number;
      laneNumber: number;
    }
    const rawAssignments: RawAssignment[] = [];

    const totalRows = rawRows.length;
    for (let rIdx = 0; rIdx < totalRows; rIdx++) {
      if (isCancelledRef.current) return;
      const row = rawRows[rIdx];

      const name = getField(row, ['swimmer', 'name', 'fullname', 'swimmername', 'athlete', 'playername']);
      const firstName = getField(row, ['firstname', 'fname', 'first']);
      const lastName = getField(row, ['lastname', 'lname', 'surname', 'last']);
      const sfiUid = getField(row, ['sfiuid', 'uid', 'registrationno', 'regno', 'id']);
      const genderRaw = getField(row, ['gender', 'sex', 'mf', 'm/f']);
      const club = getField(row, ['districtclub', 'district / club', 'district', 'club', 'team', 'affiliation', 'unit']) || 'Unattached';
      const ageGroupRaw = getField(row, ['group', 'agegroup', 'category', 'agecat']) || 'All Age Groups';
      const birthYearRaw = getField(row, ['birthyear', 'dob', 'year', 'yob', 'birth']);
      const eventNoRaw = getField(row, ['eventno', 'eventnumber', 'no']);
      const eventName = getField(row, ['event', 'eventname', 'stroke', 'distance']);
      const heatNoRaw = getField(row, ['heat', 'heatno', 'heatnumber']);
      const laneNoRaw = getField(row, ['lane', 'laneno', 'lanenumber']);

      let finalName = name;
      if (!finalName && (firstName || lastName)) {
        finalName = `${firstName} ${lastName}`.trim();
      }
      if (!finalName) continue;

      // Stream real-time player name and percentage smoothly
      if (rIdx % 10 === 0 || rIdx === totalRows - 1) {
        const pct = Math.min(95, Math.round(((rIdx + 1) / totalRows) * 95));
        setProgressPercent(pct);
        setProgressStatus(`Importing Swimmer ${rIdx + 1} / ${totalRows}: ${finalName} (${pct}%)`);
        await new Promise(r => setTimeout(r, 0));
      }

      const gLower = String(genderRaw || '').toLowerCase().trim();
      const gender: 'M' | 'F' = (gLower.startsWith('w') || gLower.startsWith('f') || gLower.includes('girl') || gLower.includes('women') || gLower.includes('female')) ? 'F' : 'M';
      const birthYear = parseInt(birthYearRaw) || undefined;
      const eventNo = parseInt(eventNoRaw) || undefined;

      const cleanUid = sfiUid ? sfiUid.toLowerCase().trim() : '';
      const cleanName = finalName.toLowerCase().trim();
      const swimmerKey = cleanUid || cleanName;

      if (!uniqueSwimmersMap.has(swimmerKey)) {
        uniqueSwimmersMap.set(swimmerKey, {
          meetId,
          sfiUid: sfiUid || '',
          name: finalName,
          gender,
          birthYear,
          ageGroup: (ageGroupRaw as AgeGroup) || 'All Age Groups',
          club
        });
      }

      if (eventName || eventNo) {
        const distance = parseDistance(eventName) || 50;
        const stroke = parseStroke(eventName);
        const heatNum = parseInt(heatNoRaw) || 1;
        const laneNum = parseInt(laneNoRaw) || 1;

        const eventKey = `ev_${eventNo || ''}_${distance}_${stroke}_${gender}_${ageGroupRaw}`;
        if (!uniqueEventsMap.has(eventKey)) {
          uniqueEventsMap.set(eventKey, {
            meetId,
            eventNo: eventNo || (uniqueEventsMap.size + 1),
            distance,
            stroke,
            gender,
            ageGroup: (ageGroupRaw as AgeGroup) || 'All Age Groups'
          });
        }

        rawAssignments.push({
          eventKey,
          swimmerKey,
          heatNumber: heatNum,
          laneNumber: laneNum
        });
      }
    }

    if (isCancelledRef.current) return;

    setProgressPercent(97);
    setProgressStatus(`Saving ${uniqueSwimmersMap.size} Athletes and ${uniqueEventsMap.size} Events to Database...`);

    // High speed atomic transaction
    await db.transaction('rw', [db.meets, db.events, db.swimmers, db.laneAssignments, db.results], async () => {
      if (isCancelledRef.current) return;
      if (meetConfigToUpdate) {
        await db.meets.update(meetId, meetConfigToUpdate);
      }

      // Clean up previous placeholder events & assignments for this meet
      const existingEvents = await db.events.where('meetId').equals(meetId).toArray();
      for (const ev of existingEvents) {
        if (ev.id) {
          await db.events.delete(ev.id);
          await db.laneAssignments.where('eventId').equals(ev.id).delete();
          await db.results.where('eventId').equals(ev.id).delete();
        }
      }

      // Add Swimmers & map keys
      const swimmerKeyToDbId = new Map<string, number>();
      for (const [key, swData] of uniqueSwimmersMap.entries()) {
        const id = await db.swimmers.add(swData as Swimmer);
        swimmerKeyToDbId.set(key, Number(id));
      }

      // Add Events & map keys
      const eventKeyToDbId = new Map<string, number>();
      for (const [key, evData] of uniqueEventsMap.entries()) {
        const id = await db.events.add(evData as Event);
        eventKeyToDbId.set(key, Number(id));
      }

      // Seed all Lane Assignments in high-speed batch
      const assignmentsToAdd: Array<LaneAssignment> = [];
      rawAssignments.forEach(a => {
        const eventId = eventKeyToDbId.get(a.eventKey);
        const swimmerId = swimmerKeyToDbId.get(a.swimmerKey);
        if (eventId && swimmerId) {
          assignmentsToAdd.push({
            eventId,
            heatNumber: a.heatNumber,
            laneNumber: a.laneNumber,
            swimmerId
          });
        }
      });

      if (assignmentsToAdd.length > 0) {
        await db.laneAssignments.bulkAdd(assignmentsToAdd);
      }
    });

    if (isCancelledRef.current) return;

    // Instant close without any hanging or pausing
    onClose();

    // Trigger state refreshes asynchronously so UI updates immediately
    window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
    if (onImportComplete) {
      onImportComplete();
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'linear-gradient(145deg, #0d1322 0%, #080c14 100%)',
          border: '1.5px solid rgba(250, 204, 21, 0.45)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(250, 204, 21, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(250, 204, 21, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={20} style={{ color: '#facc15' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#facc15', letterSpacing: '0.5px' }}>
                Import Meet Data & Entry Files
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                Excel (.xlsx, .xls), CSV (.csv), or TouchTeck Event JSON (.json)
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', borderRadius: '50%', color: 'rgba(255,255,255,0.6)' }}
            onClick={handleCancelAndClose}
            title="Cancel & Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Dropzone (disabled during processing) */}
          {!isProcessing && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? '#facc15' : 'rgba(250, 204, 21, 0.35)'}`,
                borderRadius: '12px',
                padding: '1.4rem 1rem',
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
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(250, 204, 21, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
                <UploadCloud size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.15rem' }}>
                  {selectedFileName || 'Click to select or Drag & Drop file here'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  Supports Excel spreadsheets, Meet Heat Sheets, and Event JSON files
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator with Real-Time Percentage & Gold Progress Bar */}
          {isProcessing && (
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid rgba(250, 204, 21, 0.55)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#facc15', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="spinner" style={{ width: '15px', height: '15px' }} />
                  {progressStatus || 'Importing entries...'}
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#facc15', fontFamily: 'monospace' }}>
                  {progressPercent}%
                </span>
              </div>

              <div style={{ width: '100%', height: '10px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: '#facc15',
                    borderRadius: '999px',
                    transition: 'width 0.15s ease-out',
                    boxShadow: '0 0 14px rgba(250, 204, 21, 0.6)'
                  }}
                />
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
        <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.4)' }}
            onClick={handleCancelAndClose}
          >
            {isProcessing ? 'Cancel Import' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SmartImportModal;
