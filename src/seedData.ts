// Official 2-Day Swim Championship Seed Data (Telangana Masters IDSC 2026)
// Generated from TSA Official Entry Roster & Day 1 / Day 2 Order of Events

import { Meet, Swimmer, Event, LaneAssignment } from './db';

export const INITIAL_MEET: Meet = {
  id: 1,
  name: "11th Telangana Masters Inter District Swimming Championship 2026",
  location: "Hyderabad, Telangana",
  date: "15.08.2026 - 16.08.2026"
};

export const INITIAL_SWIMMERS: Swimmer[] = [
  {
    "id": 1,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL29679",
    "name": "LAKSHMI NARAYANA KOLLIPARA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "80+",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 2,
    "meetId": 1,
    "sfiUid": "Sfimaxtel38904",
    "name": "Omprakash",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "75-79",
    "club": "Hyderabad"
  },
  {
    "id": 3,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL 29623",
    "name": "Soma Jagan Mohan Reddy",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "75-79",
    "club": "Hyderabad"
  },
  {
    "id": 4,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL29685",
    "name": "PAPOLU SATYANARAYANA PRASAD",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 5,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20169",
    "name": "Ashok Bandari",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 6,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL25487",
    "name": "Bandari Sathaiah",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 7,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1008",
    "name": "navathe vittal",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Nizamabad"
  },
  {
    "id": 8,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35488",
    "name": "G Mohan Reddy",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 9,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1010",
    "name": "L ANAND BHASKAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 10,
    "meetId": 1,
    "sfiUid": "FIMAXTEL25212",
    "name": "Venugopal Sanka",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 11,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Jagjeet Singh Tuteja",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 12,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "Mohammad masood Ahmed",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 13,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38934",
    "name": "chelagola indrasena yadav",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 14,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38893",
    "name": "ABBUGARI VENUGOPAL",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 15,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38910",
    "name": "RUCHI SINGH",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 16,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20358",
    "name": "viswanath tadepalli",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Ranga Reddy"
  },
  {
    "id": 17,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42682",
    "name": "MADAGOUNI NARSIMHA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Ranga Reddy"
  },
  {
    "id": 18,
    "meetId": 1,
    "sfiUid": "Sfi",
    "name": "Rajkumar Surana",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 19,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL20238",
    "name": "Goli Syamala",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Sangareddy"
  },
  {
    "id": 20,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "PRABHA PANDIT",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 21,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38523",
    "name": "MADHU SUDHAN YADAV",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 22,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20274",
    "name": "Ganachary sravan kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 23,
    "meetId": 1,
    "sfiUid": "Swimedtempc_3379f122",
    "name": "K. R. Ajithsudarshan",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 24,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38461",
    "name": "Praveen Jorrigala",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 25,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL20549",
    "name": "Sunitha",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Ranga Reddy"
  },
  {
    "id": 26,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38897",
    "name": "SAMUDRALA SURESH",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 27,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42643",
    "name": "Satya Sravan Kumar Rachakonda",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 28,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL20269",
    "name": "Preeti Ramdas",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 29,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38935",
    "name": "Muthyala Archana",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 30,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL35130",
    "name": "Nagaswathi Putta",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Ranga Reddy"
  },
  {
    "id": 31,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38432",
    "name": "Vidya Sunitha Mogadala",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Ranga Reddy"
  },
  {
    "id": 32,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42770",
    "name": "Saidulu Mallikanti",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 33,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42776",
    "name": "Kishore Thogiti",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 34,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1035",
    "name": "MD AFSAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Nizamabad"
  },
  {
    "id": 35,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL25255",
    "name": "BONNY KSHETRIMAYUM",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 36,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Satyaraj Mayor",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 37,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38423",
    "name": "MOHAMMED HYDER ALI",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 38,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35519",
    "name": "B Poorna Chandar Rao",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Warangal"
  },
  {
    "id": 39,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1040",
    "name": "ASARI SRINIVAS",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Karimnagar"
  },
  {
    "id": 40,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1041",
    "name": "Abhinav Reddy Enjamuri",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 41,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20267",
    "name": "Gunda Lakshmi Narasimha Achyuth",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 42,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35146",
    "name": "Ragi Rajanikanth",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Mahaboobnagar"
  },
  {
    "id": 43,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "G VINAY SHRAVAN",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 44,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42631",
    "name": "KANNEKANTI BHARGAVACHARY",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Nalgonda"
  },
  {
    "id": 45,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38477",
    "name": "Gayathri INKOLLU",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "75-79",
    "club": "Hyderabad"
  },
  {
    "id": 46,
    "meetId": 1,
    "sfiUid": "na",
    "name": "Mohd Basith Ali",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 47,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL25294",
    "name": "SUDARSHAN KALAKOTLA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Warangal"
  },
  {
    "id": 48,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20542",
    "name": "RAJENDRA KARYAKARTE",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 49,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38568",
    "name": "Asit Kumar Khanra",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Warangal"
  },
  {
    "id": 50,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35156",
    "name": "SRINIVAS BANDIRALA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 51,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42687",
    "name": "M.M.RAJESHWARI",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 52,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42741",
    "name": "PAVANA SUTA GADHAMSETTY",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 53,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1054",
    "name": "PUNREDDY SRINIVAS REDDY",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Ranga Reddy"
  },
  {
    "id": 54,
    "meetId": 1,
    "sfiUid": "20085",
    "name": "JAGDISH KUMAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 55,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38421",
    "name": "Pallem Gopal",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 56,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20272",
    "name": "SARDAR HARJINDER SINGH RAI",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 57,
    "meetId": 1,
    "sfiUid": "Sfi",
    "name": "Gundaram Anup Kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 58,
    "meetId": 1,
    "sfiUid": "20272",
    "name": "Harjinder singh",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 59,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42703",
    "name": "SRIKANTH RAYUDU",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 60,
    "meetId": 1,
    "sfiUid": "25273",
    "name": "Salugu Sidhartha",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Ranga Reddy"
  },
  {
    "id": 61,
    "meetId": 1,
    "sfiUid": "Sfimaxtel38701",
    "name": "Bathula Mahesh",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 62,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL20552",
    "name": "NAVATHE SUMALATHA",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Nizamabad"
  },
  {
    "id": 63,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL2558",
    "name": "Shiva Yadav",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Ranga Reddy"
  },
  {
    "id": 64,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1065",
    "name": "Juvvala Purushotham",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Ranga Reddy"
  },
  {
    "id": 65,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "NELLI SRIDHAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Karimnagar"
  },
  {
    "id": 66,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20270",
    "name": "Syed Musa",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 67,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Merugu Mahesh",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 68,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1069",
    "name": "M Venu",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Mahaboobnagar"
  },
  {
    "id": 69,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42724",
    "name": "Bochker Akhil kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 70,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "K anil kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 71,
    "meetId": 1,
    "sfiUid": "SWAA000M45",
    "name": "Suresh Kumar Verma",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "80+",
    "club": "Hyderabad"
  },
  {
    "id": 72,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35520",
    "name": "Talla Babu",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 73,
    "meetId": 1,
    "sfiUid": "Sfifaxtel2501",
    "name": "Ranjita Rao Katragadda",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 74,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL19993",
    "name": "Mahesh Phadke",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 75,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35481",
    "name": "Shishir Punjala",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 76,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Purushotham Rao Billu",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Nalgonda"
  },
  {
    "id": 77,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Girija Rampalli",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 78,
    "meetId": 1,
    "sfiUid": "SFI",
    "name": "VVENKATA RAMANA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 79,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL35903",
    "name": "MADHAVA DHAS R",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 80,
    "meetId": 1,
    "sfiUid": "Sgi",
    "name": "M LAXMAN REDDY",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "80+",
    "club": "Hyderabad"
  },
  {
    "id": 81,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1082",
    "name": "Dr. C RAJKUMAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "80+",
    "club": "Hyderabad"
  },
  {
    "id": 82,
    "meetId": 1,
    "sfiUid": "950310395573",
    "name": "NIMMAKAYALA CHITTARI JANARDHAN",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "80+",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 83,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1084",
    "name": "Shinde Ravikanth Narsingrao",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 84,
    "meetId": 1,
    "sfiUid": "Sgi",
    "name": "E NARSHIMA REDDY",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "70-74",
    "club": "Hyderabad"
  },
  {
    "id": 85,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20120",
    "name": "Jakkula Vinaya Kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 86,
    "meetId": 1,
    "sfiUid": "SFI",
    "name": "SEBASTIAN M D",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Hyderabad"
  },
  {
    "id": 87,
    "meetId": 1,
    "sfiUid": "Not applied 40234",
    "name": "K. Rajeshwari rao",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Warangal"
  },
  {
    "id": 88,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1089",
    "name": "Madireddy Sreedher",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Karimnagar"
  },
  {
    "id": 89,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL20174",
    "name": "BARMALA VIJAYA KUMARI",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 90,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1091",
    "name": "Mary mathew",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 91,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "Sireesha Mamidenna",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Ranga Reddy"
  },
  {
    "id": 92,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "A Ramesh Babu",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Ranga Reddy"
  },
  {
    "id": 93,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1094",
    "name": "Syed irfan Ahmed",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 94,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Radhika Rachapudi",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 95,
    "meetId": 1,
    "sfiUid": "Xxx",
    "name": "SriLalitha Malladi",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 96,
    "meetId": 1,
    "sfiUid": "2026",
    "name": "santosh chandra",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 97,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Kunwar Birender",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Ranga Reddy"
  },
  {
    "id": 98,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38999",
    "name": "ADITYA VUPPALA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 99,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Smita Bose",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 100,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "Suneetha Yedla",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Ranga Reddy"
  },
  {
    "id": 101,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42648",
    "name": "Bhanu Indurkar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 102,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1103",
    "name": "Prashant Sagar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 103,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42737",
    "name": "Mohammed Imtiyaz Ali",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 104,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38700",
    "name": "Kattela Ganesh",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 105,
    "meetId": 1,
    "sfiUid": "Sfimaxtel8702",
    "name": "Jinna Ravinder",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Nizamabad"
  },
  {
    "id": 106,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1107",
    "name": "KRUSHANTH TIPPI",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 107,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42692",
    "name": "Mayank Gupta",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 108,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Nandu Yadav",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Ranga Reddy"
  },
  {
    "id": 109,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL25199",
    "name": "Abhilasha Gadiraju",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 110,
    "meetId": 1,
    "sfiUid": "Sgi",
    "name": "D.shivender",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 111,
    "meetId": 1,
    "sfiUid": "2026-27",
    "name": "SYED AMJAD",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Mahaboobnagar"
  },
  {
    "id": 112,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38721",
    "name": "Mahipal Sanda",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 113,
    "meetId": 1,
    "sfiUid": "SFUMAXTEL",
    "name": "khadarbasha Khadar shaik",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 114,
    "meetId": 1,
    "sfiUid": "NA",
    "name": "Santhisree Goli",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 115,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42736",
    "name": "Megha Shukla",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Ranga Reddy"
  },
  {
    "id": 116,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42691",
    "name": "Sarepalli Harika",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 117,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1118",
    "name": "Aruva sai vamshi",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Karimnagar"
  },
  {
    "id": 118,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "Akash Mandloi",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Ranga Reddy"
  },
  {
    "id": 119,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38700",
    "name": "Embari Vinod Kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Nizamabad"
  },
  {
    "id": 120,
    "meetId": 1,
    "sfiUid": "NA",
    "name": "Vikram Boddinagula",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 121,
    "meetId": 1,
    "sfiUid": "Not given",
    "name": "Raviteja",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Khammam"
  },
  {
    "id": 122,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42764",
    "name": "GARLAPATI SAMEL",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Nalgonda"
  },
  {
    "id": 123,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Thumpilla Naresh Kumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Warangal"
  },
  {
    "id": 124,
    "meetId": 1,
    "sfiUid": "24-05-1995",
    "name": "maddi v n m sai teja",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 125,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42688",
    "name": "Lakshmi Ramani Vadde",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 126,
    "meetId": 1,
    "sfiUid": "NA",
    "name": "Devika Gandla",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 127,
    "meetId": 1,
    "sfiUid": "SFI FAXTEL",
    "name": "Gulnaz Rawoof",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 128,
    "meetId": 1,
    "sfiUid": "2026-27",
    "name": "Sayera Banu",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Mahaboobnagar"
  },
  {
    "id": 129,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL40655",
    "name": "BORRA ROHIT KUMAR",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Ranga Reddy"
  },
  {
    "id": 130,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Prashant Raparthi",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Karimnagar"
  },
  {
    "id": 131,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Dannadi srikanth yadav",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Ranga Reddy"
  },
  {
    "id": 132,
    "meetId": 1,
    "sfiUid": "Sfi",
    "name": "Gotike Krishnaiah",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Vikarabad"
  },
  {
    "id": 133,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL40233",
    "name": "S.Sai krishna",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Warangal"
  },
  {
    "id": 134,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42705",
    "name": "Vinuthna Venigalla",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Nizamabad"
  },
  {
    "id": 135,
    "meetId": 1,
    "sfiUid": "SFI",
    "name": "Viswanadhuni Lakshmi Sarayu",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 136,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1137",
    "name": "TANJORE ANAND RAJ",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 137,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL42740",
    "name": "RAPALLY RAMARAO",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Karimnagar"
  },
  {
    "id": 138,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL 35521",
    "name": "Surender Reddy",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Nalgonda"
  },
  {
    "id": 139,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "P ManojKumar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Hyderabad"
  },
  {
    "id": 140,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1141",
    "name": "murali reddy",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Hyderabad"
  },
  {
    "id": 141,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "ashok bhairi",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 142,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20600",
    "name": "Ganesh sheetal",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Hyderabad"
  },
  {
    "id": 143,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38473",
    "name": "Durga G",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Ranga Reddy"
  },
  {
    "id": 144,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1145",
    "name": "Kalla Daniel Sharon",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 145,
    "meetId": 1,
    "sfiUid": "BSA",
    "name": "SUDHIR SHAH",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 146,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38989",
    "name": "Linga reddy Banda",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "60-64",
    "club": "Warangal"
  },
  {
    "id": 147,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1148",
    "name": "navathe srinivas",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Nizamabad"
  },
  {
    "id": 148,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL29695",
    "name": "Lakshmikant Sheth",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Hyderabad"
  },
  {
    "id": 149,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1150",
    "name": "BANGARI RAJAIYAH",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "65-69",
    "club": "Karimnagar"
  },
  {
    "id": 150,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1151",
    "name": "A Ramesh",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "50-54",
    "club": "Karimnagar"
  },
  {
    "id": 151,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL20548",
    "name": "Navathe ramakrishna",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Hyderabad"
  },
  {
    "id": 152,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL38937",
    "name": "Sarasija Reddy Gangumalla",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Ranga Reddy"
  },
  {
    "id": 153,
    "meetId": 1,
    "sfiUid": "Sfi",
    "name": "Shaik Sajida",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 154,
    "meetId": 1,
    "sfiUid": "Sfimaxtel29680",
    "name": "Kala Venkata sai pavan",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 155,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Amlan Jyoti Borkuch",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 156,
    "meetId": 1,
    "sfiUid": "SFI-2026-TS-1157",
    "name": "Manga Venkateshwarlu",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "55-59",
    "club": "Karimnagar"
  },
  {
    "id": 157,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL39521",
    "name": "P Sunil",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "45-49",
    "club": "Sangareddy"
  },
  {
    "id": 158,
    "meetId": 1,
    "sfiUid": "Nill",
    "name": "REDDYMALLERAJU",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Siddipet"
  },
  {
    "id": 159,
    "meetId": 1,
    "sfiUid": "SFOMAXTEL38464",
    "name": "SHAIK RAHAMATULLA",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "40-44",
    "club": "Medchal Malkajgiri"
  },
  {
    "id": 160,
    "meetId": 1,
    "sfiUid": "SFIFAXTEL42735",
    "name": "Hina Bajpai",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Hyderabad"
  },
  {
    "id": 161,
    "meetId": 1,
    "sfiUid": "NA",
    "name": "Vani budireddi",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "30-34",
    "club": "Hyderabad"
  },
  {
    "id": 162,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL",
    "name": "Dayarani chakma",
    "gender": "F",
    "birthYear": 1980,
    "ageGroup": "25-29",
    "club": "Hyderabad"
  },
  {
    "id": 163,
    "meetId": 1,
    "sfiUid": "SFIMAXTEL38482",
    "name": "Banna sunil manohar",
    "gender": "M",
    "birthYear": 1980,
    "ageGroup": "35-39",
    "club": "Warangal"
  }
];

export const INITIAL_EVENTS: Event[] = [
  {
    "id": 1,
    "eventNo": 1,
    "day": 1,
    "meetId": 1,
    "distance": 400,
    "stroke": "Freestyle",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 2,
    "eventNo": 1,
    "day": 1,
    "meetId": 1,
    "distance": 400,
    "stroke": "Freestyle",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 3,
    "eventNo": 2,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Breaststroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 4,
    "eventNo": 2,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Breaststroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 5,
    "eventNo": 3,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Backstroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 6,
    "eventNo": 3,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Backstroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 7,
    "eventNo": 4,
    "day": 1,
    "meetId": 1,
    "distance": 400,
    "stroke": "Individual Medley",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 8,
    "eventNo": 4,
    "day": 1,
    "meetId": 1,
    "distance": 400,
    "stroke": "Individual Medley",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 9,
    "eventNo": 5,
    "day": 1,
    "meetId": 1,
    "distance": 50,
    "stroke": "Freestyle",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 10,
    "eventNo": 5,
    "day": 1,
    "meetId": 1,
    "distance": 50,
    "stroke": "Freestyle",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 11,
    "eventNo": 6,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Butterfly",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 12,
    "eventNo": 6,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Butterfly",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 13,
    "eventNo": 7,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Freestyle",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 14,
    "eventNo": 7,
    "day": 1,
    "meetId": 1,
    "distance": 200,
    "stroke": "Freestyle",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 15,
    "eventNo": 8,
    "day": 1,
    "meetId": 1,
    "distance": 100,
    "stroke": "Backstroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 16,
    "eventNo": 8,
    "day": 1,
    "meetId": 1,
    "distance": 100,
    "stroke": "Backstroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 17,
    "eventNo": 9,
    "day": 2,
    "meetId": 1,
    "distance": 200,
    "stroke": "Individual Medley",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 18,
    "eventNo": 9,
    "day": 2,
    "meetId": 1,
    "distance": 200,
    "stroke": "Individual Medley",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 19,
    "eventNo": 10,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Breaststroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 20,
    "eventNo": 10,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Breaststroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 21,
    "eventNo": 11,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Butterfly",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 22,
    "eventNo": 11,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Butterfly",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 23,
    "eventNo": 12,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Freestyle",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 24,
    "eventNo": 12,
    "day": 2,
    "meetId": 1,
    "distance": 100,
    "stroke": "Freestyle",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 25,
    "eventNo": 13,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Backstroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 26,
    "eventNo": 13,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Backstroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 27,
    "eventNo": 14,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Breaststroke",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 28,
    "eventNo": 14,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Breaststroke",
    "gender": "F",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 29,
    "eventNo": 15,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Butterfly",
    "gender": "M",
    "ageGroup": "All Age Groups"
  },
  {
    "id": 30,
    "eventNo": 15,
    "day": 2,
    "meetId": 1,
    "distance": 50,
    "stroke": "Butterfly",
    "gender": "F",
    "ageGroup": "All Age Groups"
  }
];

export const INITIAL_ASSIGNMENTS: LaneAssignment[] = [
  {
    "id": 1,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 1
  },
  {
    "id": 2,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 2
  },
  {
    "id": 3,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 3
  },
  {
    "id": 4,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 4
  },
  {
    "id": 5,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 5
  },
  {
    "id": 6,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 6
  },
  {
    "id": 7,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 7
  },
  {
    "id": 8,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 8
  },
  {
    "id": 9,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 9
  },
  {
    "id": 10,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 10
  },
  {
    "id": 11,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 11
  },
  {
    "id": 12,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 12
  },
  {
    "id": 13,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 13
  },
  {
    "id": 14,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 14
  },
  {
    "id": 15,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 15
  },
  {
    "id": 16,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 16
  },
  {
    "id": 17,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 17
  },
  {
    "id": 18,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 18
  },
  {
    "id": 19,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 19
  },
  {
    "id": 20,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 20
  },
  {
    "id": 21,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 21
  },
  {
    "id": 22,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 22
  },
  {
    "id": 23,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 23
  },
  {
    "id": 24,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 24
  },
  {
    "id": 25,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 25
  },
  {
    "id": 26,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 26
  },
  {
    "id": 27,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 27
  },
  {
    "id": 28,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 28
  },
  {
    "id": 29,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 29
  },
  {
    "id": 30,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 30
  },
  {
    "id": 31,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 31
  },
  {
    "id": 32,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 32
  },
  {
    "id": 33,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 33
  },
  {
    "id": 34,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 34
  },
  {
    "id": 35,
    "eventId": 2,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 35
  },
  {
    "id": 36,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 1,
    "swimmerId": 36
  },
  {
    "id": 37,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 37
  },
  {
    "id": 38,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 38
  },
  {
    "id": 39,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 39
  },
  {
    "id": 40,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 40
  },
  {
    "id": 41,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 41
  },
  {
    "id": 42,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 42
  },
  {
    "id": 43,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 43
  },
  {
    "id": 44,
    "eventId": 1,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 44
  },
  {
    "id": 45,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 1
  },
  {
    "id": 46,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 2
  },
  {
    "id": 47,
    "eventId": 4,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 45
  },
  {
    "id": 48,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 7
  },
  {
    "id": 49,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 5
  },
  {
    "id": 50,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 46
  },
  {
    "id": 51,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 47
  },
  {
    "id": 52,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 48
  },
  {
    "id": 53,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 49
  },
  {
    "id": 54,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 50
  },
  {
    "id": 55,
    "eventId": 4,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 51
  },
  {
    "id": 56,
    "eventId": 4,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 52
  },
  {
    "id": 57,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 16
  },
  {
    "id": 58,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 53
  },
  {
    "id": 59,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 54
  },
  {
    "id": 60,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 17
  },
  {
    "id": 61,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 55
  },
  {
    "id": 62,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 56
  },
  {
    "id": 63,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 57
  },
  {
    "id": 64,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 58
  },
  {
    "id": 65,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 59
  },
  {
    "id": 66,
    "eventId": 4,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 25
  },
  {
    "id": 67,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 60
  },
  {
    "id": 68,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 61
  },
  {
    "id": 69,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 26
  },
  {
    "id": 70,
    "eventId": 4,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 62
  },
  {
    "id": 71,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 63
  },
  {
    "id": 72,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 64
  },
  {
    "id": 73,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 65
  },
  {
    "id": 74,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 66
  },
  {
    "id": 75,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 67
  },
  {
    "id": 76,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 38
  },
  {
    "id": 77,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 37
  },
  {
    "id": 78,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 42
  },
  {
    "id": 79,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 68
  },
  {
    "id": 80,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 69
  },
  {
    "id": 81,
    "eventId": 3,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 70
  },
  {
    "id": 82,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 71
  },
  {
    "id": 83,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 5
  },
  {
    "id": 84,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 72
  },
  {
    "id": 85,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 8
  },
  {
    "id": 86,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 47
  },
  {
    "id": 87,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 73
  },
  {
    "id": 88,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 13
  },
  {
    "id": 89,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 14
  },
  {
    "id": 90,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 74
  },
  {
    "id": 91,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 15
  },
  {
    "id": 92,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 19
  },
  {
    "id": 93,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 25
  },
  {
    "id": 94,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 75
  },
  {
    "id": 95,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 76
  },
  {
    "id": 96,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 26
  },
  {
    "id": 97,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 77
  },
  {
    "id": 98,
    "eventId": 6,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 31
  },
  {
    "id": 99,
    "eventId": 5,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 44
  },
  {
    "id": 100,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 3
  },
  {
    "id": 101,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 5
  },
  {
    "id": 102,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 9
  },
  {
    "id": 103,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 47
  },
  {
    "id": 104,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 78
  },
  {
    "id": 105,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 79
  },
  {
    "id": 106,
    "eventId": 7,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 42
  },
  {
    "id": 107,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 71
  },
  {
    "id": 108,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 80
  },
  {
    "id": 109,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 81
  },
  {
    "id": 110,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 1
  },
  {
    "id": 111,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 82
  },
  {
    "id": 112,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 83
  },
  {
    "id": 113,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 84
  },
  {
    "id": 114,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 4
  },
  {
    "id": 115,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 7
  },
  {
    "id": 116,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 85
  },
  {
    "id": 117,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 73
  },
  {
    "id": 118,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 86
  },
  {
    "id": 119,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 11
  },
  {
    "id": 120,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 87
  },
  {
    "id": 121,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 50
  },
  {
    "id": 122,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 49
  },
  {
    "id": 123,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 88
  },
  {
    "id": 124,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 52
  },
  {
    "id": 125,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 89
  },
  {
    "id": 126,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 90
  },
  {
    "id": 127,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 91
  },
  {
    "id": 128,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 16
  },
  {
    "id": 129,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 18
  },
  {
    "id": 130,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 92
  },
  {
    "id": 131,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 53
  },
  {
    "id": 132,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 93
  },
  {
    "id": 133,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 94
  },
  {
    "id": 134,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 95
  },
  {
    "id": 135,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 96
  },
  {
    "id": 136,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 97
  },
  {
    "id": 137,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 98
  },
  {
    "id": 138,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 22
  },
  {
    "id": 139,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 24
  },
  {
    "id": 140,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 25
  },
  {
    "id": 141,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 99
  },
  {
    "id": 142,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 100
  },
  {
    "id": 143,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 61
  },
  {
    "id": 144,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 101
  },
  {
    "id": 145,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 1,
    "swimmerId": 102
  },
  {
    "id": 146,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 2,
    "swimmerId": 103
  },
  {
    "id": 147,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 3,
    "swimmerId": 104
  },
  {
    "id": 148,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 4,
    "swimmerId": 105
  },
  {
    "id": 149,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 5,
    "swimmerId": 106
  },
  {
    "id": 150,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 6,
    "swimmerId": 107
  },
  {
    "id": 151,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 7,
    "swimmerId": 108
  },
  {
    "id": 152,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 8,
    "swimmerId": 27
  },
  {
    "id": 153,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 30
  },
  {
    "id": 154,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 109
  },
  {
    "id": 155,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 29
  },
  {
    "id": 156,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 110
  },
  {
    "id": 157,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 1,
    "swimmerId": 63
  },
  {
    "id": 158,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 2,
    "swimmerId": 111
  },
  {
    "id": 159,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 3,
    "swimmerId": 34
  },
  {
    "id": 160,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 4,
    "swimmerId": 64
  },
  {
    "id": 161,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 5,
    "swimmerId": 33
  },
  {
    "id": 162,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 6,
    "swimmerId": 112
  },
  {
    "id": 163,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 7,
    "swimmerId": 32
  },
  {
    "id": 164,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 8,
    "swimmerId": 113
  },
  {
    "id": 165,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 114
  },
  {
    "id": 166,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 35
  },
  {
    "id": 167,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 115
  },
  {
    "id": 168,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 116
  },
  {
    "id": 169,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 117
  },
  {
    "id": 170,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 40
  },
  {
    "id": 171,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 118
  },
  {
    "id": 172,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 119
  },
  {
    "id": 173,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 1,
    "swimmerId": 120
  },
  {
    "id": 174,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 2,
    "swimmerId": 66
  },
  {
    "id": 175,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 3,
    "swimmerId": 121
  },
  {
    "id": 176,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 4,
    "swimmerId": 122
  },
  {
    "id": 177,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 5,
    "swimmerId": 42
  },
  {
    "id": 178,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 6,
    "swimmerId": 36
  },
  {
    "id": 179,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 7,
    "swimmerId": 123
  },
  {
    "id": 180,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 8,
    "swimmerId": 124
  },
  {
    "id": 181,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 125
  },
  {
    "id": 182,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 126
  },
  {
    "id": 183,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 127
  },
  {
    "id": 184,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 128
  },
  {
    "id": 185,
    "eventId": 9,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 129
  },
  {
    "id": 186,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 1,
    "swimmerId": 130
  },
  {
    "id": 187,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 2,
    "swimmerId": 44
  },
  {
    "id": 188,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 3,
    "swimmerId": 43
  },
  {
    "id": 189,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 4,
    "swimmerId": 69
  },
  {
    "id": 190,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 5,
    "swimmerId": 131
  },
  {
    "id": 191,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 6,
    "swimmerId": 132
  },
  {
    "id": 192,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 7,
    "swimmerId": 68
  },
  {
    "id": 193,
    "eventId": 9,
    "heatNumber": 2,
    "laneNumber": 8,
    "swimmerId": 133
  },
  {
    "id": 194,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 134
  },
  {
    "id": 195,
    "eventId": 10,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 135
  },
  {
    "id": 196,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 71
  },
  {
    "id": 197,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 1
  },
  {
    "id": 198,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 80
  },
  {
    "id": 199,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 84
  },
  {
    "id": 200,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 4
  },
  {
    "id": 201,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 136
  },
  {
    "id": 202,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 10
  },
  {
    "id": 203,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 137
  },
  {
    "id": 204,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 87
  },
  {
    "id": 205,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 48
  },
  {
    "id": 206,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 86
  },
  {
    "id": 207,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 138
  },
  {
    "id": 208,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 74
  },
  {
    "id": 209,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 139
  },
  {
    "id": 210,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 91
  },
  {
    "id": 211,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 89
  },
  {
    "id": 212,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 52
  },
  {
    "id": 213,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 140
  },
  {
    "id": 214,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 92
  },
  {
    "id": 215,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 18
  },
  {
    "id": 216,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 95
  },
  {
    "id": 217,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 20
  },
  {
    "id": 218,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 94
  },
  {
    "id": 219,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 56
  },
  {
    "id": 220,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 97
  },
  {
    "id": 221,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 22
  },
  {
    "id": 222,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 58
  },
  {
    "id": 223,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 24
  },
  {
    "id": 224,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 141
  },
  {
    "id": 225,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 1,
    "swimmerId": 75
  },
  {
    "id": 226,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 102
  },
  {
    "id": 227,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 104
  },
  {
    "id": 228,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 101
  },
  {
    "id": 229,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 142
  },
  {
    "id": 230,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 107
  },
  {
    "id": 231,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 27
  },
  {
    "id": 232,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 109
  },
  {
    "id": 233,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 30
  },
  {
    "id": 234,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 113
  },
  {
    "id": 235,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 32
  },
  {
    "id": 236,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 110
  },
  {
    "id": 237,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 33
  },
  {
    "id": 238,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 63
  },
  {
    "id": 239,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 35
  },
  {
    "id": 240,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 143
  },
  {
    "id": 241,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 123
  },
  {
    "id": 242,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 41
  },
  {
    "id": 243,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 36
  },
  {
    "id": 244,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 124
  },
  {
    "id": 245,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 127
  },
  {
    "id": 246,
    "eventId": 24,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 144
  },
  {
    "id": 247,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 43
  },
  {
    "id": 248,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 129
  },
  {
    "id": 249,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 131
  },
  {
    "id": 250,
    "eventId": 23,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 130
  },
  {
    "id": 251,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 1
  },
  {
    "id": 252,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 4
  },
  {
    "id": 253,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 84
  },
  {
    "id": 254,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 5
  },
  {
    "id": 255,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 6
  },
  {
    "id": 256,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 46
  },
  {
    "id": 257,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 8
  },
  {
    "id": 258,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 145
  },
  {
    "id": 259,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 10
  },
  {
    "id": 260,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 12
  },
  {
    "id": 261,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 11
  },
  {
    "id": 262,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 146
  },
  {
    "id": 263,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 48
  },
  {
    "id": 264,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 138
  },
  {
    "id": 265,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 16
  },
  {
    "id": 266,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 18
  },
  {
    "id": 267,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 93
  },
  {
    "id": 268,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 94
  },
  {
    "id": 269,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 19
  },
  {
    "id": 270,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 20
  },
  {
    "id": 271,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 24
  },
  {
    "id": 272,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 22
  },
  {
    "id": 273,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 23
  },
  {
    "id": 274,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 75
  },
  {
    "id": 275,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 26
  },
  {
    "id": 276,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 142
  },
  {
    "id": 277,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 76
  },
  {
    "id": 278,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 27
  },
  {
    "id": 279,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 147
  },
  {
    "id": 280,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 62
  },
  {
    "id": 281,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 31
  },
  {
    "id": 282,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 34
  },
  {
    "id": 283,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 35
  },
  {
    "id": 284,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 124
  },
  {
    "id": 285,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 41
  },
  {
    "id": 286,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 39
  },
  {
    "id": 287,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 38
  },
  {
    "id": 288,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 37
  },
  {
    "id": 289,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 127
  },
  {
    "id": 290,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 144
  },
  {
    "id": 291,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 69
  },
  {
    "id": 292,
    "eventId": 13,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 130
  },
  {
    "id": 293,
    "eventId": 14,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 134
  },
  {
    "id": 294,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 71
  },
  {
    "id": 295,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 81
  },
  {
    "id": 296,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 82
  },
  {
    "id": 297,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 72
  },
  {
    "id": 298,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 148
  },
  {
    "id": 299,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 149
  },
  {
    "id": 300,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 85
  },
  {
    "id": 301,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 73
  },
  {
    "id": 302,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 146
  },
  {
    "id": 303,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 137
  },
  {
    "id": 304,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 50
  },
  {
    "id": 305,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 74
  },
  {
    "id": 306,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 139
  },
  {
    "id": 307,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 89
  },
  {
    "id": 308,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 90
  },
  {
    "id": 309,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 140
  },
  {
    "id": 310,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 54
  },
  {
    "id": 311,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 150
  },
  {
    "id": 312,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 92
  },
  {
    "id": 313,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 93
  },
  {
    "id": 314,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 20
  },
  {
    "id": 315,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 95
  },
  {
    "id": 316,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 59
  },
  {
    "id": 317,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 58
  },
  {
    "id": 318,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 151
  },
  {
    "id": 319,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 141
  },
  {
    "id": 320,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 99
  },
  {
    "id": 321,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 1,
    "swimmerId": 75
  },
  {
    "id": 322,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 104
  },
  {
    "id": 323,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 105
  },
  {
    "id": 324,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 61
  },
  {
    "id": 325,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 101
  },
  {
    "id": 326,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 106
  },
  {
    "id": 327,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 108
  },
  {
    "id": 328,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 8,
    "swimmerId": 147
  },
  {
    "id": 329,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 31
  },
  {
    "id": 330,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 30
  },
  {
    "id": 331,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 109
  },
  {
    "id": 332,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 77
  },
  {
    "id": 333,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 152
  },
  {
    "id": 334,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 112
  },
  {
    "id": 335,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 153
  },
  {
    "id": 336,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 123
  },
  {
    "id": 337,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 154
  },
  {
    "id": 338,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 79
  },
  {
    "id": 339,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 125
  },
  {
    "id": 340,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 127
  },
  {
    "id": 341,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 144
  },
  {
    "id": 342,
    "eventId": 25,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 155
  },
  {
    "id": 343,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 134
  },
  {
    "id": 344,
    "eventId": 26,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 135
  },
  {
    "id": 345,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 71
  },
  {
    "id": 346,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 2
  },
  {
    "id": 347,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 45
  },
  {
    "id": 348,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 72
  },
  {
    "id": 349,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 6
  },
  {
    "id": 350,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 46
  },
  {
    "id": 351,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 8
  },
  {
    "id": 352,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 47
  },
  {
    "id": 353,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 73
  },
  {
    "id": 354,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 10
  },
  {
    "id": 355,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 13
  },
  {
    "id": 356,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 14
  },
  {
    "id": 357,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 74
  },
  {
    "id": 358,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 90
  },
  {
    "id": 359,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 15
  },
  {
    "id": 360,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 17
  },
  {
    "id": 361,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 93
  },
  {
    "id": 362,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 19
  },
  {
    "id": 363,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 20
  },
  {
    "id": 364,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 59
  },
  {
    "id": 365,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 58
  },
  {
    "id": 366,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 21
  },
  {
    "id": 367,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 75
  },
  {
    "id": 368,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 142
  },
  {
    "id": 369,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 61
  },
  {
    "id": 370,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 101
  },
  {
    "id": 371,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 76
  },
  {
    "id": 372,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 147
  },
  {
    "id": 373,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 152
  },
  {
    "id": 374,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 77
  },
  {
    "id": 375,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 30
  },
  {
    "id": 376,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 31
  },
  {
    "id": 377,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 65
  },
  {
    "id": 378,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 124
  },
  {
    "id": 379,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 154
  },
  {
    "id": 380,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 37
  },
  {
    "id": 381,
    "eventId": 16,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 127
  },
  {
    "id": 382,
    "eventId": 15,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 68
  },
  {
    "id": 383,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 81
  },
  {
    "id": 384,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 80
  },
  {
    "id": 385,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 2
  },
  {
    "id": 386,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 84
  },
  {
    "id": 387,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 148
  },
  {
    "id": 388,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 149
  },
  {
    "id": 389,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 85
  },
  {
    "id": 390,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 145
  },
  {
    "id": 391,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 86
  },
  {
    "id": 392,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 87
  },
  {
    "id": 393,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 137
  },
  {
    "id": 394,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 50
  },
  {
    "id": 395,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 156
  },
  {
    "id": 396,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 49
  },
  {
    "id": 397,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 88
  },
  {
    "id": 398,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 139
  },
  {
    "id": 399,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 52
  },
  {
    "id": 400,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 89
  },
  {
    "id": 401,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 90
  },
  {
    "id": 402,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 55
  },
  {
    "id": 403,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 92
  },
  {
    "id": 404,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 54
  },
  {
    "id": 405,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 95
  },
  {
    "id": 406,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 98
  },
  {
    "id": 407,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 1,
    "swimmerId": 59
  },
  {
    "id": 408,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 2,
    "swimmerId": 24
  },
  {
    "id": 409,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 3,
    "swimmerId": 97
  },
  {
    "id": 410,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 4,
    "swimmerId": 57
  },
  {
    "id": 411,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 5,
    "swimmerId": 58
  },
  {
    "id": 412,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 6,
    "swimmerId": 157
  },
  {
    "id": 413,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 7,
    "swimmerId": 56
  },
  {
    "id": 414,
    "eventId": 27,
    "heatNumber": 2,
    "laneNumber": 8,
    "swimmerId": 141
  },
  {
    "id": 415,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 99
  },
  {
    "id": 416,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 60
  },
  {
    "id": 417,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 158
  },
  {
    "id": 418,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 106
  },
  {
    "id": 419,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 103
  },
  {
    "id": 420,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 159
  },
  {
    "id": 421,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 28
  },
  {
    "id": 422,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 109
  },
  {
    "id": 423,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 29
  },
  {
    "id": 424,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 63
  },
  {
    "id": 425,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 110
  },
  {
    "id": 426,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 33
  },
  {
    "id": 427,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 153
  },
  {
    "id": 428,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 160
  },
  {
    "id": 429,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 115
  },
  {
    "id": 430,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 66
  },
  {
    "id": 431,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 117
  },
  {
    "id": 432,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 67
  },
  {
    "id": 433,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 120
  },
  {
    "id": 434,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 161
  },
  {
    "id": 435,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 70
  },
  {
    "id": 436,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 131
  },
  {
    "id": 437,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 155
  },
  {
    "id": 438,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 129
  },
  {
    "id": 439,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 132
  },
  {
    "id": 440,
    "eventId": 27,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 130
  },
  {
    "id": 441,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 135
  },
  {
    "id": 442,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 162
  },
  {
    "id": 443,
    "eventId": 28,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 134
  },
  {
    "id": 444,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 80
  },
  {
    "id": 445,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 2
  },
  {
    "id": 446,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 45
  },
  {
    "id": 447,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 84
  },
  {
    "id": 448,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 136
  },
  {
    "id": 449,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 86
  },
  {
    "id": 450,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 48
  },
  {
    "id": 451,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 87
  },
  {
    "id": 452,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 146
  },
  {
    "id": 453,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 137
  },
  {
    "id": 454,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 49
  },
  {
    "id": 455,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 138
  },
  {
    "id": 456,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 51
  },
  {
    "id": 457,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 52
  },
  {
    "id": 458,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 16
  },
  {
    "id": 459,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 55
  },
  {
    "id": 460,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 150
  },
  {
    "id": 461,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 54
  },
  {
    "id": 462,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 18
  },
  {
    "id": 463,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 141
  },
  {
    "id": 464,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 157
  },
  {
    "id": 465,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 57
  },
  {
    "id": 466,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 23
  },
  {
    "id": 467,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 56
  },
  {
    "id": 468,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 96
  },
  {
    "id": 469,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 159
  },
  {
    "id": 470,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 142
  },
  {
    "id": 471,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 104
  },
  {
    "id": 472,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 60
  },
  {
    "id": 473,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 29
  },
  {
    "id": 474,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 62
  },
  {
    "id": 475,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 65
  },
  {
    "id": 476,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 110
  },
  {
    "id": 477,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 64
  },
  {
    "id": 478,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 63
  },
  {
    "id": 479,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 143
  },
  {
    "id": 480,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 67
  },
  {
    "id": 481,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 66
  },
  {
    "id": 482,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 144
  },
  {
    "id": 483,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 155
  },
  {
    "id": 484,
    "eventId": 19,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 130
  },
  {
    "id": 485,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 162
  },
  {
    "id": 486,
    "eventId": 20,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 134
  },
  {
    "id": 487,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 82
  },
  {
    "id": 488,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 6
  },
  {
    "id": 489,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 46
  },
  {
    "id": 490,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 9
  },
  {
    "id": 491,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 146
  },
  {
    "id": 492,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 13
  },
  {
    "id": 493,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 50
  },
  {
    "id": 494,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 156
  },
  {
    "id": 495,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 14
  },
  {
    "id": 496,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 49
  },
  {
    "id": 497,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 139
  },
  {
    "id": 498,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 78
  },
  {
    "id": 499,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 150
  },
  {
    "id": 500,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 92
  },
  {
    "id": 501,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 141
  },
  {
    "id": 502,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 22
  },
  {
    "id": 503,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 56
  },
  {
    "id": 504,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 107
  },
  {
    "id": 505,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 101
  },
  {
    "id": 506,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 142
  },
  {
    "id": 507,
    "eventId": 30,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 28
  },
  {
    "id": 508,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 65
  },
  {
    "id": 509,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 163
  },
  {
    "id": 510,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 64
  },
  {
    "id": 511,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 113
  },
  {
    "id": 512,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 121
  },
  {
    "id": 513,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 154
  },
  {
    "id": 514,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 39
  },
  {
    "id": 515,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 40
  },
  {
    "id": 516,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 79
  },
  {
    "id": 517,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 66
  },
  {
    "id": 518,
    "eventId": 29,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 129
  },
  {
    "id": 519,
    "eventId": 30,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 162
  },
  {
    "id": 520,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 3
  },
  {
    "id": 521,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 9
  },
  {
    "id": 522,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 78
  },
  {
    "id": 523,
    "eventId": 22,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 15
  },
  {
    "id": 524,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 21
  },
  {
    "id": 525,
    "eventId": 22,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 28
  },
  {
    "id": 526,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 163
  },
  {
    "id": 527,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 154
  },
  {
    "id": 528,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 40
  },
  {
    "id": 529,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 38
  },
  {
    "id": 530,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 129
  },
  {
    "id": 531,
    "eventId": 21,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 68
  },
  {
    "id": 532,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 3
  },
  {
    "id": 533,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 47
  },
  {
    "id": 534,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 78
  },
  {
    "id": 535,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 21
  },
  {
    "id": 536,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 27
  },
  {
    "id": 537,
    "eventId": 11,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 44
  },
  {
    "id": 538,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 3
  },
  {
    "id": 539,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 46
  },
  {
    "id": 540,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 9
  },
  {
    "id": 541,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 145
  },
  {
    "id": 542,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 13
  },
  {
    "id": 543,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 137
  },
  {
    "id": 544,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 10
  },
  {
    "id": 545,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 14
  },
  {
    "id": 546,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 78
  },
  {
    "id": 547,
    "eventId": 18,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 15
  },
  {
    "id": 548,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 23
  },
  {
    "id": 549,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 21
  },
  {
    "id": 550,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 107
  },
  {
    "id": 551,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 65
  },
  {
    "id": 552,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 2,
    "swimmerId": 37
  },
  {
    "id": 553,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 3,
    "swimmerId": 41
  },
  {
    "id": 554,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 40
  },
  {
    "id": 555,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 38
  },
  {
    "id": 556,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 6,
    "swimmerId": 154
  },
  {
    "id": 557,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 7,
    "swimmerId": 121
  },
  {
    "id": 558,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 4,
    "swimmerId": 44
  },
  {
    "id": 559,
    "eventId": 17,
    "heatNumber": 1,
    "laneNumber": 5,
    "swimmerId": 68
  }
];
