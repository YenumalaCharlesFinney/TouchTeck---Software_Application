import Dexie, { type Table } from 'dexie';

export interface Meet {
  id?: number;
  name: string;
  date: string;
  location: string;
}

export interface Swimmer {
  id?: number;
  meetId?: number;
  name: string;
  gender: 'M' | 'F';
  birthYear: number;
  ageGroup: 'Group A' | 'Group B' | 'Group C' | 'Group D';
  club: string;
}

export interface QualifyingTime {
  id?: number;
  meetId?: number;
  distance: number; // e.g. 50, 100, 200, 400, 800, 1500
  stroke: 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'Individual Medley';
  gender: 'M' | 'F';
  ageGroup: 'Group A' | 'Group B' | 'Group C' | 'Group D';
  time: number; // in seconds, e.g. 25.50
}

export interface Event {
  id?: number;
  meetId: number;
  distance: number;
  stroke: 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'Individual Medley';
  gender: 'M' | 'F';
  ageGroup: 'Group A' | 'Group B' | 'Group C' | 'Group D';
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
  splits: number[]; // in seconds
  finalTime: number; // in seconds
  status: 'OK' | 'DNS' | 'DNF' | 'DQ' | 'NT';
  timingMethod?: 'T1' | 'T2';
  recordedAt: number; // timestamp
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
      swimmers: '++id, meetId, name, gender, ageGroup, club',
      qualifyingTimes: '++id, meetId, [distance+stroke+gender+ageGroup], distance, stroke, gender, ageGroup',
      events: '++id, meetId, [distance+stroke+gender+ageGroup]',
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

// Helper to seed database with realistic swimming data if empty
export async function seedDatabase(force = false) {
  const assignmentsCount = await db.laneAssignments.count();
  if (assignmentsCount > 0 && !force) return; // Database already has seeded lane assignments

  console.log('Seeding initial swimming data...');
  
  // Clear any existing tables to force a clean update
  await db.meets.clear();
  await db.swimmers.clear();
  await db.qualifyingTimes.clear();
  await db.events.clear();
  await db.laneAssignments.clear();
  await db.results.clear();

  // 1. Seed Meet
  const meetId = await db.meets.add({
    name: 'National Selection Trials 2026',
    date: '2026-07-20',
    location: 'National Aquatic Centre'
  });

  // 2. Seed Swimmers (Group A: 15-17 years, Group B: 13-14 years, etc.)
  const swimmersList: Omit<Swimmer, 'id'>[] = [
    { meetId, name: 'Charles Wesley', gender: 'M', birthYear: 2009, ageGroup: 'Group A', club: 'RR' },
    { meetId, name: 'Arjun Mehta', gender: 'M', birthYear: 2009, ageGroup: 'Group A', club: 'HYD' },
    { meetId, name: 'Rohan Sharma', gender: 'M', birthYear: 2010, ageGroup: 'Group A', club: 'RR' },
    { meetId, name: 'Vihaan Patel', gender: 'M', birthYear: 2009, ageGroup: 'Group A', club: 'HYD' },
    { meetId, name: 'Aditya Sen', gender: 'M', birthYear: 2010, ageGroup: 'Group A', club: 'MUM' },
    { meetId, name: 'Kabir Nair', gender: 'M', birthYear: 2009, ageGroup: 'Group A', club: 'DEL' },
    { meetId, name: 'Aarav Gupta', gender: 'M', birthYear: 2010, ageGroup: 'Group A', club: 'BLR' },
    { meetId, name: 'Neil Dsouza', gender: 'M', birthYear: 2009, ageGroup: 'Group A', club: 'KOL' },

    { meetId, name: 'Ananya Roy', gender: 'F', birthYear: 2011, ageGroup: 'Group B', club: 'HYD' },
    { meetId, name: 'Riya Sen', gender: 'F', birthYear: 2011, ageGroup: 'Group B', club: 'RR' },
    { meetId, name: 'Diya Menon', gender: 'F', birthYear: 2012, ageGroup: 'Group B', club: 'MUM' },
    { meetId, name: 'Tara Deshmukh', gender: 'F', birthYear: 2011, ageGroup: 'Group B', club: 'DEL' }
  ];

  const swimmerIds: number[] = [];
  for (const s of swimmersList) {
    const id = await db.swimmers.add(s);
    swimmerIds.push(id);
  }

  // 3. Seed Qualifying Times (National Standards)
  const qts: Omit<QualifyingTime, 'id'>[] = [
    // 50m Free
    { meetId, distance: 50, stroke: 'Freestyle', gender: 'M', ageGroup: 'Group A', time: 25.20 },
    { meetId, distance: 50, stroke: 'Freestyle', gender: 'F', ageGroup: 'Group A', time: 28.50 },
    { meetId, distance: 50, stroke: 'Freestyle', gender: 'M', ageGroup: 'Group B', time: 26.80 },
    { meetId, distance: 50, stroke: 'Freestyle', gender: 'F', ageGroup: 'Group B', time: 29.90 },
    
    // 100m Free
    { meetId, distance: 100, stroke: 'Freestyle', gender: 'M', ageGroup: 'Group A', time: 55.50 },
    { meetId, distance: 100, stroke: 'Freestyle', gender: 'F', ageGroup: 'Group A', time: 102.10 },
    
    // 200m Free
    { distance: 200, stroke: 'Freestyle', gender: 'M', ageGroup: 'Group A', time: 122.00 },
    
    // 100m Breast
    { distance: 100, stroke: 'Breaststroke', gender: 'M', ageGroup: 'Group A', time: 70.50 },
    { distance: 100, stroke: 'Breaststroke', gender: 'F', ageGroup: 'Group B', time: 82.00 },
  ];

  for (const qt of qts) {
    await db.qualifyingTimes.add(qt);
  }

  // 4. Seed Events
  const event1Id = await db.events.add({
    meetId,
    distance: 50,
    stroke: 'Freestyle',
    gender: 'M',
    ageGroup: 'Group A'
  });

  const event2Id = await db.events.add({
    meetId,
    distance: 100,
    stroke: 'Breaststroke',
    gender: 'F',
    ageGroup: 'Group B'
  });

  const event3Id = await db.events.add({
    meetId,
    distance: 200,
    stroke: 'Freestyle',
    gender: 'M',
    ageGroup: 'Group A'
  });

  // 5. Assign lanes for Event 1: Heat 1, Heat 2, and Heat 3
  for (let lane = 1; lane <= 8; lane++) {
    await db.laneAssignments.add({
      eventId: event1Id,
      heatNumber: 1,
      laneNumber: lane,
      swimmerId: swimmerIds[lane - 1]
    });
  }

  for (let lane = 1; lane <= 8; lane++) {
    await db.laneAssignments.add({
      eventId: event1Id,
      heatNumber: 2,
      laneNumber: lane,
      swimmerId: swimmerIds[(lane + 2) % swimmerIds.length]
    });
  }

  for (let lane = 1; lane <= 8; lane++) {
    await db.laneAssignments.add({
      eventId: event1Id,
      heatNumber: 3,
      laneNumber: lane,
      swimmerId: swimmerIds[(lane + 4) % swimmerIds.length]
    });
  }

  // Assign lanes for Event 2, Heat 1 (Lanes 1 to 4)
  for (let lane = 1; lane <= 4; lane++) {
    await db.laneAssignments.add({
      eventId: event2Id,
      heatNumber: 1,
      laneNumber: lane,
      swimmerId: swimmerIds[8 + lane - 1]
    });
  }

  // Assign lanes for Event 3, Heat 1 (Lanes 1 to 8)
  for (let lane = 1; lane <= 8; lane++) {
    await db.laneAssignments.add({
      eventId: event3Id,
      heatNumber: 1,
      laneNumber: lane,
      swimmerId: swimmerIds[lane - 1]
    });
  }

  console.log('Seeding complete.');
  return meetId;
}
