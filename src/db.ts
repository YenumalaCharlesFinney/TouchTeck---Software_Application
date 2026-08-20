import Dexie, { type Table } from 'dexie';
import { INITIAL_MEET, INITIAL_SWIMMERS, INITIAL_EVENTS, INITIAL_ASSIGNMENTS } from './seedData';

export interface Meet {
  id?: number;
  name: string;
  date: string;
  location: string;
  poolType?: '50m' | '25m';
  lanes?: number;
  categoryPreset?: 'masters' | 'juniors' | 'open';
}

export type AgeGroup =
  | 'Group A' | 'Group B' | 'Group C' | 'Group D'
  | '25-29' | '30-34' | '35-39' | '40-44'
  | '45-49' | '50-54' | '55-59' | '60-64'
  | '65-69' | '70-74' | '75-79' | '80 & above'
  | string;

export interface Swimmer {
  id?: number;
  meetId?: number;
  sfiUid?: string;
  name: string;
  gender: 'M' | 'F';
  birthYear?: number;
  ageGroup: AgeGroup;
  club: string;
}

export interface QualifyingTime {
  id?: number;
  meetId?: number;
  distance: number;
  stroke: 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'Individual Medley';
  gender: 'M' | 'F';
  ageGroup: AgeGroup;
  time: number;
}

export interface Event {
  id?: number;
  eventNo?: number;
  day?: number;
  meetId: number;
  distance: number;
  stroke: 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'Individual Medley';
  gender: 'M' | 'F';
  ageGroup: AgeGroup;
}

export interface LaneAssignment {
  id?: number;
  eventId: number;
  heatNumber: number;
  laneNumber: number; // 1 to 8
  swimmerId?: number;
}

export interface Result {
  id?: number;
  eventId: number;
  stage?: 'Heats' | 'Finals';
  heatNumber: number;
  laneNumber: number;
  swimmerId?: number;
  swimmerName?: string;
  club?: string;
  ageGroup?: string;
  splits: number[];
  t1Time?: number;
  t2Time?: number;
  finalTime: number;
  status: 'OK' | 'DNS' | 'DNF' | 'DQ' | 'NT';
  timingMethod?: 'T1' | 'T2';
  recordedAt: number;
}

export class OmegaTimingDatabase extends Dexie {
  meets!: Table<Meet>;
  swimmers!: Table<Swimmer>;
  qualifyingTimes!: Table<QualifyingTime>;
  events!: Table<Event>;
  laneAssignments!: Table<LaneAssignment>;
  results!: Table<Result>;

  constructor() {
    super('OmegaTimingDatabase');
    this.version(1).stores({
      meets: '++id, name, date',
      swimmers: '++id, meetId, sfiUid, name, gender, ageGroup, club',
      qualifyingTimes: '++id, meetId, [distance+stroke+gender+ageGroup], distance, stroke, gender, ageGroup',
      events: '++id, meetId, eventNo, [distance+stroke+gender+ageGroup]',
      laneAssignments: '++id, eventId, heatNumber, [eventId+heatNumber], laneNumber, swimmerId',
      results: '++id, eventId, heatNumber, laneNumber, swimmerId'
    });
  }
}

export const db = new OmegaTimingDatabase();

if (typeof window !== 'undefined') {
  const notifyLaneChange = () => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lane-assignments-updated'));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('touchteck_timing_sync');
        bc.postMessage({ action: 'LANE_ASSIGNMENTS_UPDATED', timestamp: Date.now() });
        bc.close();
      }
    }, 20);
  };

  db.laneAssignments.hook('creating', notifyLaneChange);
  db.laneAssignments.hook('updating', notifyLaneChange);
  db.laneAssignments.hook('deleting', notifyLaneChange);
  db.swimmers.hook('creating', notifyLaneChange);
  db.swimmers.hook('updating', notifyLaneChange);
  db.swimmers.hook('deleting', notifyLaneChange);
}

export async function seedDatabase(force = false) {
  const swimmersCount = await db.swimmers.count();
  const eventsCount = await db.events.count();
  const existingMasters = await db.meets.filter(m => m.name.includes('Telangana Masters')).first();

  if (existingMasters && swimmersCount === INITIAL_SWIMMERS.length && eventsCount === INITIAL_EVENTS.length && !force) {
    return existingMasters.id;
  }

  console.log('Seeding official swimming data for Telangana Masters 2026 from seedData...');
  
  await db.transaction('rw', [db.meets, db.swimmers, db.qualifyingTimes, db.events, db.laneAssignments, db.results], async () => {
    await db.meets.clear();
    await db.swimmers.clear();
    await db.qualifyingTimes.clear();
    await db.events.clear();
    await db.laneAssignments.clear();
    await db.results.clear();

    // 1. Seed Meet
    const mastersMeetId = (await db.meets.put(INITIAL_MEET)) as number || 1;

    // 2. Seed Swimmers with Official SFI UIDs from Excel
    await db.swimmers.bulkPut(INITIAL_SWIMMERS.map(s => ({
      ...s,
      gender: s.gender as 'M' | 'F',
      meetId: mastersMeetId
    })));

    // 3. Seed Official Events
    await db.events.bulkPut(INITIAL_EVENTS.map(e => ({
      ...e,
      stroke: e.stroke as Event['stroke'],
      gender: e.gender as 'M' | 'F',
      meetId: mastersMeetId
    })));

    // 4. Seed Official Lane Assignments
    await db.laneAssignments.bulkPut(INITIAL_ASSIGNMENTS);
  });

  console.log(`Seeding complete: ${INITIAL_SWIMMERS.length} Swimmers, ${INITIAL_EVENTS.length} Events & ${INITIAL_ASSIGNMENTS.length} Lane Assignments loaded.`);
  return 1;
}
