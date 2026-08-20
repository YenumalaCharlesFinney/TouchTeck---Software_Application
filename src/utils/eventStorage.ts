import { db, type Event as DbEvent, Meet, Swimmer, LaneAssignment, Result } from '../db';

export interface EventDataFilePayload {
  version: '1.0';
  exportedAt: string;
  meet: {
    id?: number;
    name: string;
    date: string;
    location: string;
    poolType: string;
    lanes: number;
  };
  event: {
    id?: number;
    eventNo?: number;
    distance: number;
    stroke: string;
    gender: 'M' | 'F';
    ageGroup: string;
  };
  heats: {
    heatNumber: number;
    lanes: {
      laneNumber: number;
      swimmer?: {
        id?: number;
        sfiUid?: string;
        name: string;
        club: string;
        gender: string;
        ageGroup: string;
        birthYear?: number;
      };
      result?: {
        officialTime: number;
        splits: number[];
        status: string;
        t1Time?: number;
        t2Time?: number;
        recordedAt?: number;
      };
    }[];
  }[];
}

export function getEventFileName(ev: DbEvent): string {
  const padNo = String(ev.eventNo || ev.id || 1).padStart(2, '0');
  const cleanStroke = (ev.stroke || 'Freestyle').replace(/\s+/g, '_');
  const genderStr = ev.gender === 'M' ? 'Men' : 'Women';
  const cleanCat = (ev.ageGroup || 'Open').replace(/[^a-zA-Z0-9]/g, '_');
  return `Event_${padNo}_${ev.distance}m_${cleanStroke}_${genderStr}_${cleanCat}.json`;
}

export function getEventFilePath(meetName: string, ev: DbEvent): string {
  const cleanMeet = (meetName || 'Default_Meet').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = getEventFileName(ev);
  return `TouchTeck_Data/Meets/${cleanMeet}/events/${filename}`;
}

export async function buildEventDataPayload(eventId: number): Promise<EventDataFilePayload | null> {
  const ev = await db.events.get(eventId);
  if (!ev) return null;

  const meet = (await db.meets.get(ev.meetId || 1)) || {
    name: 'Championship Meet',
    date: new Date().toISOString().split('T')[0],
    location: 'Aquatic Center',
    poolType: '50m',
    lanes: 8
  };

  const assignments = await db.laneAssignments.where('eventId').equals(eventId).toArray();
  const results = await db.results.where('eventId').equals(eventId).toArray();

  const heatSet = new Set<number>();
  assignments.forEach(a => { if (a.heatNumber) heatSet.add(a.heatNumber); });
  results.forEach(r => { if (r.heatNumber) heatSet.add(r.heatNumber); });
  if (heatSet.size === 0) heatSet.add(1);

  const sortedHeats = Array.from(heatSet).sort((a, b) => a - b);
  const totalLanes = meet.lanes || 8;

  const heatsData: EventDataFilePayload['heats'] = [];

  for (const h of sortedHeats) {
    const heatAssigns = assignments.filter(a => a.heatNumber === h);
    const heatResults = results.filter(r => r.heatNumber === h);

    const lanesData: EventDataFilePayload['heats'][0]['lanes'] = [];

    for (let l = 1; l <= totalLanes; l++) {
      const assign = heatAssigns.find(a => a.laneNumber === l);
      const res = heatResults.find(r => r.laneNumber === l);

      let swimmerInfo: EventDataFilePayload['heats'][0]['lanes'][0]['swimmer'] = undefined;
      const swimmerId = assign?.swimmerId || res?.swimmerId;

      if (swimmerId) {
        const sw = await db.swimmers.get(swimmerId);
        if (sw) {
          swimmerInfo = {
            id: sw.id,
            sfiUid: sw.sfiUid,
            name: sw.name,
            club: sw.club,
            gender: sw.gender,
            ageGroup: sw.ageGroup,
            birthYear: sw.birthYear
          };
        }
      }

      let resultInfo: EventDataFilePayload['heats'][0]['lanes'][0]['result'] = undefined;
      if (res) {
        resultInfo = {
          officialTime: res.finalTime || 0,
          splits: res.splits || [],
          status: res.status || 'OK',
          t1Time: res.t1Time,
          t2Time: res.t2Time,
          recordedAt: res.recordedAt
        };
      }

      lanesData.push({
        laneNumber: l,
        swimmer: swimmerInfo,
        result: resultInfo
      });
    }

    heatsData.push({
      heatNumber: h,
      lanes: lanesData
    });
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    meet: {
      id: meet.id,
      name: meet.name,
      date: meet.date,
      location: meet.location,
      poolType: meet.poolType || '50m',
      lanes: meet.lanes || 8
    },
    event: {
      id: ev.id,
      eventNo: ev.eventNo,
      distance: ev.distance,
      stroke: ev.stroke,
      gender: ev.gender,
      ageGroup: ev.ageGroup
    },
    heats: heatsData
  };
}

export async function exportEventJsonFile(eventId: number): Promise<void> {
  const payload = await buildEventDataPayload(eventId);
  if (!payload) return;

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getEventFileName(payload.event as DbEvent);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportEventCsvFile(eventId: number): Promise<void> {
  const payload = await buildEventDataPayload(eventId);
  if (!payload) return;

  const rows: string[][] = [
    ['Meet Name', payload.meet.name],
    ['Event', `#${payload.event.eventNo || payload.event.id}: ${payload.event.distance}m ${payload.event.stroke} (${payload.event.gender === 'M' ? 'Men' : 'Women'}, ${payload.event.ageGroup})`],
    ['Exported At', payload.exportedAt],
    [],
    ['Heat', 'Lane', 'SFI UID', 'Swimmer Name', 'Club / District', 'Official Time (s)', 'Status']
  ];

  for (const h of payload.heats) {
    for (const l of h.lanes) {
      if (l.swimmer || l.result) {
        rows.push([
          String(h.heatNumber),
          String(l.laneNumber),
          l.swimmer?.sfiUid || '',
          l.swimmer?.name || 'Unassigned',
          l.swimmer?.club || '',
          l.result ? (l.result.officialTime ? (l.result.officialTime / 1000).toFixed(2) : '--') : '--',
          l.result?.status || 'OK'
        ]);
      }
    }
  }

  const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanStroke = (payload.event.stroke || 'Freestyle').replace(/\s+/g, '_');
  a.download = `Event_${payload.event.eventNo || payload.event.id}_${payload.event.distance}m_${cleanStroke}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
