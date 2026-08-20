import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\charleswesley', 'OneDrive', 'Desktop');
const localDesktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\charleswesley', 'Desktop');

const targetFile1 = path.join(desktopPath, 'TouchTeck_3Day_Junior_SubJunior_State_Championship.xlsx');
const targetFile2 = path.join(localDesktopPath, 'TouchTeck_3Day_Junior_SubJunior_State_Championship.xlsx');
const legacyFile1 = path.join(desktopPath, 'TouchTeck_Junior_SubJunior_Championship_Template.xlsx');

// 1. Tab 1: Meet Info
const meetInfoData = [
  ['Meet Configuration', 'Value', 'Description / Guidance'],
  ['Meet Name', 'Telangana State Junior & Sub-Junior Aquatic Championship 2026', 'Official title of the 3-day state championship'],
  ['Dates', '2026-09-11 to 2026-09-13 (3-Day Meet)', 'Day 1: Distance | Day 2: Middle Distance & Form | Day 3: Sprints & Finals'],
  ['Location', 'GMC Balayogi Aquatic Complex, Gachibowli, Hyderabad', 'Venue / 50m Olympic Pool'],
  ['Pool Length', '50m', 'Course: 50m (Long Course)'],
  ['Number of Lanes', 8, 'Pool lanes available (1 to 8)'],
  ['Age Category System', 'Junior & Sub-Junior (Group A, B, C, D)', 'Group A (15-17), Group B (12-14), Group C (10-11), Group D (8-9)'],
  ['Timing System', 'Omega ARES21 Touchpads & Quantum Timing', 'Primary timing & touchpads']
];

// 2. 3-Day Championship Event Schedule (Distance first -> Middle -> Sprints)
const eventsDef = [
  // DAY 1 - MORNING & EVENING (Distance & 200s)
  { evNo: 1, session: 'Day 1 - Session 1', event: '1500m Freestyle', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 2, session: 'Day 1 - Session 1', event: '800m Freestyle', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 3, session: 'Day 1 - Session 1', event: '800m Freestyle', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 4, session: 'Day 1 - Session 1', event: '800m Freestyle', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 5, session: 'Day 1 - Session 1', event: '200m Individual Medley', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 6, session: 'Day 1 - Session 1', event: '200m Individual Medley', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 7, session: 'Day 1 - Session 1', event: '200m Individual Medley', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 8, session: 'Day 1 - Session 1', event: '200m Individual Medley', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 9, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 10, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 11, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 12, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 13, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 14, session: 'Day 1 - Session 2', event: '200m Freestyle', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 15, session: 'Day 1 - Session 2', event: '100m Backstroke', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 16, session: 'Day 1 - Session 2', event: '100m Backstroke', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 17, session: 'Day 1 - Session 2', event: '100m Backstroke', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 18, session: 'Day 1 - Session 2', event: '100m Backstroke', group: 'Group B (12-14)', gender: 'Girls' },

  // DAY 2 - MORNING & EVENING (Middle Distance & Form Strokes)
  { evNo: 19, session: 'Day 2 - Session 3', event: '400m Freestyle', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 20, session: 'Day 2 - Session 3', event: '400m Freestyle', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 21, session: 'Day 2 - Session 3', event: '400m Freestyle', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 22, session: 'Day 2 - Session 3', event: '400m Freestyle', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 23, session: 'Day 2 - Session 3', event: '200m Breaststroke', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 24, session: 'Day 2 - Session 3', event: '200m Breaststroke', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 25, session: 'Day 2 - Session 3', event: '200m Breaststroke', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 26, session: 'Day 2 - Session 3', event: '200m Breaststroke', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 27, session: 'Day 2 - Session 4', event: '100m Butterfly', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 28, session: 'Day 2 - Session 4', event: '100m Butterfly', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 29, session: 'Day 2 - Session 4', event: '100m Butterfly', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 30, session: 'Day 2 - Session 4', event: '100m Butterfly', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 31, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 32, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 33, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 34, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 35, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 36, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 37, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group D (8-9)', gender: 'Boys' },
  { evNo: 38, session: 'Day 2 - Session 4', event: '50m Breaststroke', group: 'Group D (8-9)', gender: 'Girls' },

  // DAY 3 - MORNING & EVENING (Sprints & Championship Finals)
  { evNo: 39, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 40, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 41, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 42, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 43, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 44, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 45, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group D (8-9)', gender: 'Boys' },
  { evNo: 46, session: 'Day 3 - Session 5', event: '50m Backstroke', group: 'Group D (8-9)', gender: 'Girls' },
  { evNo: 47, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 48, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 49, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 50, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 51, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 52, session: 'Day 3 - Session 5', event: '50m Butterfly', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 53, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 54, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 55, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 56, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 57, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 58, session: 'Day 3 - Session 6', event: '100m Freestyle', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 59, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group A (15-17)', gender: 'Boys' },
  { evNo: 60, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group A (15-17)', gender: 'Girls' },
  { evNo: 61, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group B (12-14)', gender: 'Boys' },
  { evNo: 62, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group B (12-14)', gender: 'Girls' },
  { evNo: 63, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group C (10-11)', gender: 'Boys' },
  { evNo: 64, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group C (10-11)', gender: 'Girls' },
  { evNo: 65, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group D (8-9)', gender: 'Boys' },
  { evNo: 66, session: 'Day 3 - Session 6', event: '50m Freestyle', group: 'Group D (8-9)', gender: 'Girls' }
];

// Rich Pool of 120+ Real Swimmers across all categories
const athleteRoster = [
  // BOYS GROUP A (15-17 Yrs, YOB 2008-2010) - 16 Athletes (Guarantees at least 2 Heats x 8 Lanes)
  { name: 'Aryan Varma', uid: 'SFI2026TEL101', club: 'Hyderabad Aquatic Club', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Rohan Deshmukh', uid: 'SFI2026TEL102', club: 'Olympians Academy', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Pranav Reddy', uid: 'SFI2026TEL103', club: 'Ranga Reddy District', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Karthik Sai', uid: 'SFI2026TEL104', club: 'Secunderabad Club', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Siddharth Rao', uid: 'SFI2026TEL105', club: 'GHMC Amberpet Pool', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Devansh Kulkarni', uid: 'SFI2026TEL106', club: 'Medchal District', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Varun Teja', uid: 'SFI2026TEL107', club: 'Warangal Aquatic Club', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Nikhil Kumar', uid: 'SFI2026TEL108', club: 'Nizamabad Swimmers', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Gautam Singhania', uid: 'SFI2026TEL109', club: 'Gachibowli Aquatic Club', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Akshat Mittal', uid: 'SFI2026TEL110', club: 'Khammam District', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Manav Joshi', uid: 'SFI2026TEL111', club: 'Karimnagar Swimmers', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Harshit Gupta', uid: 'SFI2026TEL112', club: 'Nalgonda Aquatic Team', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Yashwardhan Roy', uid: 'SFI2026TEL113', club: 'Hyderabad Aquatic Club', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Tanmay Saxena', uid: 'SFI2026TEL114', club: 'Olympians Academy', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Chaitanya Krishna', uid: 'SFI2026TEL115', club: 'Ranga Reddy District', yob: 2009, gender: 'Boys', grp: 'Group A (15-17)' },
  { name: 'Bhavin Patel', uid: 'SFI2026TEL116', club: 'Secunderabad Club', yob: 2008, gender: 'Boys', grp: 'Group A (15-17)' },

  // GIRLS GROUP A (15-17 Yrs, YOB 2008-2010) - 16 Athletes (Guarantees at least 2 Heats x 8 Lanes)
  { name: 'Ananya Sharma', uid: 'SFI2026TEL201', club: 'Hyderabad Aquatic Club', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Sanjana Reddy', uid: 'SFI2026TEL202', club: 'Olympians Academy', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Rhea Patel', uid: 'SFI2026TEL203', club: 'Ranga Reddy District', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Tanvi Goud', uid: 'SFI2026TEL204', club: 'Secunderabad Club', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Isha Nair', uid: 'SFI2026TEL205', club: 'GHMC Amberpet Pool', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Pooja Hegde', uid: 'SFI2026TEL206', club: 'Medchal District', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Deepika Rao', uid: 'SFI2026TEL207', club: 'Warangal Aquatic Club', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Lavanya Menon', uid: 'SFI2026TEL208', club: 'Nizamabad Swimmers', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Mehak Kaur', uid: 'SFI2026TEL209', club: 'Gachibowli Aquatic Club', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Shruti Iyer', uid: 'SFI2026TEL210', club: 'Khammam District', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Avishi Jain', uid: 'SFI2026TEL211', club: 'Karimnagar Swimmers', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Kritika Sen', uid: 'SFI2026TEL212', club: 'Nalgonda Aquatic Team', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Mansi Shah', uid: 'SFI2026TEL213', club: 'Hyderabad Aquatic Club', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Ritika Roy', uid: 'SFI2026TEL214', club: 'Olympians Academy', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Trisha Varma', uid: 'SFI2026TEL215', club: 'Ranga Reddy District', yob: 2009, gender: 'Girls', grp: 'Group A (15-17)' },
  { name: 'Aarushi Das', uid: 'SFI2026TEL216', club: 'Secunderabad Club', yob: 2008, gender: 'Girls', grp: 'Group A (15-17)' },

  // BOYS GROUP B (12-14 Yrs, YOB 2011-2013) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Aditya Chari', uid: 'SFI2026TEL301', club: 'Hyderabad Aquatic Club', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Harshavardhan R', uid: 'SFI2026TEL302', club: 'Olympians Academy', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Vihaan Goud', uid: 'SFI2026TEL303', club: 'Ranga Reddy District', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Reyansh Joshi', uid: 'SFI2026TEL304', club: 'Secunderabad Club', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Samar Singh', uid: 'SFI2026TEL305', club: 'GHMC Amberpet Pool', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Sai Charan', uid: 'SFI2026TEL306', club: 'Medchal District', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Manish Varma', uid: 'SFI2026TEL307', club: 'Khammam District', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Darshil Vyas', uid: 'SFI2026TEL308', club: 'Warangal Aquatic Club', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Neil Bhattacharya', uid: 'SFI2026TEL309', club: 'Gachibowli Aquatic Club', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Kushagra Saxena', uid: 'SFI2026TEL310', club: 'Nizamabad Swimmers', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Ranveer Kapoor', uid: 'SFI2026TEL311', club: 'Karimnagar Swimmers', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Madhav Nambiar', uid: 'SFI2026TEL312', club: 'Nalgonda Aquatic Team', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Aayush Kadam', uid: 'SFI2026TEL313', club: 'Hyderabad Aquatic Club', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Tanishq Agarwal', uid: 'SFI2026TEL314', club: 'Olympians Academy', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Vedant Pillai', uid: 'SFI2026TEL315', club: 'Ranga Reddy District', yob: 2012, gender: 'Boys', grp: 'Group B (12-14)' },
  { name: 'Ojas Deshpande', uid: 'SFI2026TEL316', club: 'Secunderabad Club', yob: 2011, gender: 'Boys', grp: 'Group B (12-14)' },

  // GIRLS GROUP B (12-14 Yrs, YOB 2011-2013) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Diya Murthy', uid: 'SFI2026TEL401', club: 'Hyderabad Aquatic Club', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Avani Reddy', uid: 'SFI2026TEL402', club: 'Olympians Academy', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Kavya Rao', uid: 'SFI2026TEL403', club: 'Ranga Reddy District', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Meera Sen', uid: 'SFI2026TEL404', club: 'Secunderabad Club', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Shreya Iyer', uid: 'SFI2026TEL405', club: 'Karimnagar Swimmers', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Nandini Patil', uid: 'SFI2026TEL406', club: 'GHMC Amberpet Pool', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Aditi Chawla', uid: 'SFI2026TEL407', club: 'Medchal District', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Garima Mishra', uid: 'SFI2026TEL408', club: 'Warangal Aquatic Club', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Jhanvi Trivedi', uid: 'SFI2026TEL409', club: 'Gachibowli Aquatic Club', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Khushi Bhatia', uid: 'SFI2026TEL410', club: 'Nizamabad Swimmers', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Lavanya Soni', uid: 'SFI2026TEL411', club: 'Khammam District', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Prisha Nanda', uid: 'SFI2026TEL412', club: 'Nalgonda Aquatic Team', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Radhika Kothari', uid: 'SFI2026TEL413', club: 'Hyderabad Aquatic Club', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Siddhi More', uid: 'SFI2026TEL414', club: 'Olympians Academy', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Urvi Gokhale', uid: 'SFI2026TEL415', club: 'Ranga Reddy District', yob: 2012, gender: 'Girls', grp: 'Group B (12-14)' },
  { name: 'Vaani Chopra', uid: 'SFI2026TEL416', club: 'Secunderabad Club', yob: 2011, gender: 'Girls', grp: 'Group B (12-14)' },

  // BOYS GROUP C (10-11 Yrs, YOB 2014-2016) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Advait Menon', uid: 'SFI2026TEL501', club: 'Hyderabad Aquatic Club', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Kabir Varma', uid: 'SFI2026TEL502', club: 'Olympians Academy', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Aarav Goud', uid: 'SFI2026TEL503', club: 'Ranga Reddy District', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Dhruv Reddy', uid: 'SFI2026TEL504', club: 'Medchal District', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Tejas Patil', uid: 'SFI2026TEL505', club: 'Warangal Aquatic Club', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Atharv Kulkarni', uid: 'SFI2026TEL506', club: 'GHMC Amberpet Pool', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Rudra Pratap', uid: 'SFI2026TEL507', club: 'Gachibowli Aquatic Club', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Shaurya Roy', uid: 'SFI2026TEL508', club: 'Secunderabad Club', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Vivaan Joshi', uid: 'SFI2026TEL509', club: 'Nizamabad Swimmers', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Krishav Singhal', uid: 'SFI2026TEL510', club: 'Khammam District', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Devrat Sharma', uid: 'SFI2026TEL511', club: 'Karimnagar Swimmers', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Reyan Nambiar', uid: 'SFI2026TEL512', club: 'Nalgonda Aquatic Team', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Daksh Sethi', uid: 'SFI2026TEL513', club: 'Hyderabad Aquatic Club', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Viraj Mahajan', uid: 'SFI2026TEL514', club: 'Olympians Academy', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Parth Shukla', uid: 'SFI2026TEL515', club: 'Ranga Reddy District', yob: 2014, gender: 'Boys', grp: 'Group C (10-11)' },
  { name: 'Raghav Aggarwal', uid: 'SFI2026TEL516', club: 'Secunderabad Club', yob: 2015, gender: 'Boys', grp: 'Group C (10-11)' },

  // GIRLS GROUP C (10-11 Yrs, YOB 2014-2016) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Anika Sharma', uid: 'SFI2026TEL601', club: 'Hyderabad Aquatic Club', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Sia Kulkarni', uid: 'SFI2026TEL602', club: 'Olympians Academy', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Riddhi Patel', uid: 'SFI2026TEL603', club: 'Ranga Reddy District', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Ananya Roy', uid: 'SFI2026TEL604', club: 'Secunderabad Club', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Myra Fernandes', uid: 'SFI2026TEL605', club: 'GHMC Amberpet Pool', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Ira Mathur', uid: 'SFI2026TEL606', club: 'Medchal District', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Gauri Verma', uid: 'SFI2026TEL607', club: 'Warangal Aquatic Club', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Navya Reddy', uid: 'SFI2026TEL608', club: 'Gachibowli Aquatic Club', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Shanaya Kapoor', uid: 'SFI2026TEL609', club: 'Nizamabad Swimmers', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Sara Alvi', uid: 'SFI2026TEL610', club: 'Khammam District', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Zoya Khan', uid: 'SFI2026TEL611', club: 'Karimnagar Swimmers', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Kiyara Mittal', uid: 'SFI2026TEL612', club: 'Nalgonda Aquatic Team', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Tvisha Dube', uid: 'SFI2026TEL613', club: 'Hyderabad Aquatic Club', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Manya Anand', uid: 'SFI2026TEL614', club: 'Olympians Academy', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Ahana Sengupta', uid: 'SFI2026TEL615', club: 'Ranga Reddy District', yob: 2014, gender: 'Girls', grp: 'Group C (10-11)' },
  { name: 'Pranavi Joshi', uid: 'SFI2026TEL616', club: 'Secunderabad Club', yob: 2015, gender: 'Girls', grp: 'Group C (10-11)' },

  // BOYS GROUP D (8-9 Yrs, YOB 2017-2019) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Vivaan Reddy', uid: 'SFI2026TEL701', club: 'Hyderabad Aquatic Club', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Ranbir Singh', uid: 'SFI2026TEL702', club: 'Olympians Academy', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Yuvan Goud', uid: 'SFI2026TEL703', club: 'Medchal District', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Kabir Chawla', uid: 'SFI2026TEL704', club: 'Ranga Reddy District', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Ayaan Shaikh', uid: 'SFI2026TEL705', club: 'GHMC Amberpet Pool', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Reyansh Sethi', uid: 'SFI2026TEL706', club: 'Secunderabad Club', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Shivansh Tyagi', uid: 'SFI2026TEL707', club: 'Warangal Aquatic Club', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Daksh Goel', uid: 'SFI2026TEL708', club: 'Gachibowli Aquatic Club', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Krish Patel', uid: 'SFI2026TEL709', club: 'Nizamabad Swimmers', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Neil Mehta', uid: 'SFI2026TEL710', club: 'Khammam District', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Samarth Jain', uid: 'SFI2026TEL711', club: 'Karimnagar Swimmers', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Advik Bansal', uid: 'SFI2026TEL712', club: 'Nalgonda Aquatic Team', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Hridhaan Roy', uid: 'SFI2026TEL713', club: 'Hyderabad Aquatic Club', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Agastya Nair', uid: 'SFI2026TEL714', club: 'Olympians Academy', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Eshaan Verma', uid: 'SFI2026TEL715', club: 'Ranga Reddy District', yob: 2017, gender: 'Boys', grp: 'Group D (8-9)' },
  { name: 'Kian Sengupta', uid: 'SFI2026TEL716', club: 'Secunderabad Club', yob: 2018, gender: 'Boys', grp: 'Group D (8-9)' },

  // GIRLS GROUP D (8-9 Yrs, YOB 2017-2019) - 16 Athletes (2 Heats x 8 Lanes)
  { name: 'Ahana Sen', uid: 'SFI2026TEL801', club: 'Hyderabad Aquatic Club', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Tara Deshmukh', uid: 'SFI2026TEL802', club: 'Olympians Academy', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Nyra Rao', uid: 'SFI2026TEL803', club: 'Ranga Reddy District', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Inaya Qureshi', uid: 'SFI2026TEL804', club: 'Secunderabad Club', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Kiara Kapoor', uid: 'SFI2026TEL805', club: 'GHMC Amberpet Pool', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Anvi Saxena', uid: 'SFI2026TEL806', club: 'Medchal District', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Avika Mittal', uid: 'SFI2026TEL807', club: 'Warangal Aquatic Club', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Vanya Bhatt', uid: 'SFI2026TEL808', club: 'Gachibowli Aquatic Club', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Aadhya Shukla', uid: 'SFI2026TEL809', club: 'Nizamabad Swimmers', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Meher Kaur', uid: 'SFI2026TEL810', club: 'Khammam District', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Nitya Menon', uid: 'SFI2026TEL811', club: 'Karimnagar Swimmers', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Amaira Gill', uid: 'SFI2026TEL812', club: 'Nalgonda Aquatic Team', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Pari Sharma', uid: 'SFI2026TEL813', club: 'Hyderabad Aquatic Club', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Sanvi Joshi', uid: 'SFI2026TEL814', club: 'Olympians Academy', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Aarohi Sen', uid: 'SFI2026TEL815', club: 'Ranga Reddy District', yob: 2017, gender: 'Girls', grp: 'Group D (8-9)' },
  { name: 'Kavya Jain', uid: 'SFI2026TEL816', club: 'Secunderabad Club', yob: 2018, gender: 'Girls', grp: 'Group D (8-9)' }
];

const entriesHeader = [
  'Event No',
  'Session / Day',
  'Event',
  'Group',
  'Gender',
  'Format',
  'Heat',
  'Heat Label',
  'Lane',
  'Swimmer',
  'District / Club',
  'SFI UID',
  'Birth Year',
  'Seed Time'
];

const entriesRows = [];

eventsDef.forEach(ev => {
  const eligible = athleteRoster.filter(a => a.gender === ev.gender && a.grp === ev.group);
  
  // Guarantee at least 2 Heats (16 swimmers per event)
  eligible.forEach((ath, idx) => {
    const heatNum = Math.floor(idx / 8) + 1;
    const laneNum = (idx % 8) + 1;
    
    let seedSecs = 26.5 + (idx * 0.75);
    if (ev.event.includes('100m')) seedSecs = 58.0 + (idx * 1.5);
    if (ev.event.includes('200m')) seedSecs = 132.0 + (idx * 3.1);
    if (ev.event.includes('400m')) seedSecs = 280.0 + (idx * 6.5);
    if (ev.event.includes('800m')) seedSecs = 590.0 + (idx * 12.0);
    if (ev.event.includes('1500m')) seedSecs = 1120.0 + (idx * 22.0);

    const mins = Math.floor(seedSecs / 60);
    const secs = (seedSecs % 60).toFixed(2);
    const seedTimeStr = (mins > 0 ? String(mins).padStart(2, '0') + ':' : '00:') + secs.padStart(5, '0');

    entriesRows.push([
      ev.evNo,
      ev.session,
      ev.event,
      ev.group,
      ev.gender,
      'Timed final',
      heatNum,
      'Heat ' + heatNum,
      laneNum,
      ath.name,
      ath.club,
      ath.uid,
      ath.yob,
      seedTimeStr
    ]);
  });
});

const wb = XLSX.utils.book_new();

// Sheet 1: Meet Info
const wsMeetInfo = XLSX.utils.aoa_to_sheet(meetInfoData);
wsMeetInfo['!cols'] = [{ wch: 24 }, { wch: 65 }, { wch: 55 }];
XLSX.utils.book_append_sheet(wb, wsMeetInfo, 'Meet Info');

// Sheet 2: Heats & Entries
const wsEntries = XLSX.utils.aoa_to_sheet([entriesHeader, ...entriesRows]);
wsEntries['!cols'] = [
  { wch: 10 }, // Event No
  { wch: 18 }, // Session
  { wch: 24 }, // Event
  { wch: 18 }, // Group
  { wch: 10 }, // Gender
  { wch: 14 }, // Format
  { wch: 8 },  // Heat
  { wch: 12 }, // Heat Label
  { wch: 8 },  // Lane
  { wch: 24 }, // Swimmer
  { wch: 26 }, // District / Club
  { wch: 16 }, // SFI UID
  { wch: 12 }, // Birth Year
  { wch: 12 }  // Seed Time
];
XLSX.utils.book_append_sheet(wb, wsEntries, 'Heats & Entries');

// Sheet 3: All Heats alias
const wsAllHeats = XLSX.utils.aoa_to_sheet([entriesHeader, ...entriesRows]);
wsAllHeats['!cols'] = wsEntries['!cols'];
XLSX.utils.book_append_sheet(wb, wsAllHeats, 'All Heats');

XLSX.writeFile(wb, targetFile1);
try {
  XLSX.writeFile(wb, targetFile2);
} catch (e) {}

console.log('Successfully generated 3-Day Championship template at:', targetFile1);
console.log('Total Events:', eventsDef.length);
console.log('Total Swimmers in Roster:', athleteRoster.length);
console.log('Total Seeded Lanes (At least 2 Heats per event):', entriesRows.length);
