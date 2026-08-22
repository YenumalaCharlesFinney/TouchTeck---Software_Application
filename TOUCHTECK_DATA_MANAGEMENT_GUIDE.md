# TouchTeck Timing System — Complete Data Architecture & User Guide

---

## Table of Contents
1. [Overview & Zero-Data-Loss Architecture](#1-overview--zero-data-loss-architecture)
2. [How Data Is Saved & Protected (Dual-Tier Persistence)](#2-how-data-is-saved--protected-dual-tier-persistence)
3. [Creating & Managing Championship Meets](#3-creating--managing-championship-meets)
4. [Smart File Import (Excel, CSV & JSON)](#4-smart-file-import-excel-csv--json)
5. [Disk Folder Structure & "Open Meet Folder"](#5-disk-folder-structure--open-meet-folder)
6. [Recovery Bin & Deleted Items Architecture](#6-recovery-bin--deleted-items-architecture)
7. [Swimmer Registry & Athlete Management](#7-swimmer-registry--athlete-management)
8. [Live Timing, Result Exports & Reports](#8-live-timing-result-exports--reports)

---

## 1. Overview & Zero-Data-Loss Architecture

TouchTeck is designed with an **industrial-grade, zero-data-loss architecture**. Whether the app is closed abruptly, restarted, or computer power is lost, your championship data remains **100% permanently preserved**.

### Key Principles:
* **0ms Instant Startup**: No waiting for data to reload on launch. All meets, athletes, and heats render instantaneously.
* **Dual-Tier Synchronization**: Every change in the app is saved to both ultra-fast local database memory and physical JSON/CSV files on your Windows hard drive.
* **Multi-Level Safety Net**: Deleting an event or full meet never destroys your files—it safely moves them into timestamped **Recovery Bins**.

---

## 2. How Data Is Saved & Protected (Dual-Tier Persistence)

TouchTeck uses a **two-tier persistence engine** that guarantees both lightning speed and permanent file backups:

```
┌────────────────────────────────────────────────────────┐
│               TouchTeck User Interface                 │
│         (Heats & Lanes / Operator / Swimmers)          │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
  ┌───────────────────────┐   ┌─────────────────────────┐
  │  Tier 1: IndexedDB    │   │  Tier 2: Hard Drive     │
  │  (In-Memory Database) │   │  (Physical JSON Files)  │
  ├───────────────────────┤   ├─────────────────────────┤
  │ • 0ms instant loading │   │ • TouchTeck_Data/Meets/ │
  │ • No startup wipe     │   │ • Individual event JSON │
  │ • Real-time UI sync   │   │ • Swimmers registry     │
  │ • Preserved on reboot │   │ • Meet metadata JSON    │
  └───────────────────────┘   └─────────────────────────┘
```

### Tier 1: Local In-Memory Database (IndexedDB)
* Stores all registered swimmers, events, lane assignments, and live race times directly in the local browser runtime.
* Startup routine is guarded: **TouchTeck will never wipe or reset your database on launch**.
* Switching between tabs (**Home**, **Operator Desk**, **Heats & Lanes**, **Swimmers**) happens in **0 milliseconds**.

### Tier 2: Windows Hard Drive Storage (`TouchTeck_Data`)
* Located at: `C:\Users\charleswesley\OneDrive\Desktop\TouchTeck_Data\`
* Every event is saved as an individual structured JSON file containing all heats, lane assignments, athlete names, SFI UIDs, and official split/finish times.
* Swimmers are backed up in `Swimmers_Registry.json`.
* Meet configuration is backed up in `meet_info.json`.

---

## 3. Creating & Managing Championship Meets

### Creating a New Meet:
1. Navigate to **Heats & Lanes** (or **Meet Setup**).
2. Click **`+ Create New Meet`**.
3. Configure the championship parameters:
   * **Meet Name**: e.g., *Telangana State Junior Sub-Junior Aquatic Championship 2026*.
   * **Date & Location**: e.g., *GMC Balayogi Aquatic Stadium, Gachibowli*.
   * **Pool Course**: `50m (Long Course)` or `25m (Short Course)`.
   * **Lane Count**: `8 Lanes` (or 6/10 depending on pool).
   * **Category Preset**: `Masters`, `Juniors`, or `Open`.
   * **Affiliation Type**: `District`, `State`, or `Club`.
4. Click **Create Meet** &rarr; TouchTeck automatically initializes the meet folder on disk and sets it as the active championship.

### Switching Between Active Meets:
* You can switch the active championship anytime using the **`ACTIVE MEET`** dropdown in:
  * **Heats & Lanes**
  * **Swimmers**
  * **Operator Console**
* Switching meets updates the entire application globally in **0ms**.

---

## 4. Smart File Import (Excel, CSV & JSON)

TouchTeck includes an intelligent **Smart Import Engine** that allows you to load entries from official Excel sheets, CSV rosters, or meet JSON packages.

### How to Import:
1. In **Heats & Lanes** or **Swimmers**, click **`Import File`** (or **`Import Entries`**).
2. Select your file (`.xlsx`, `.xls`, `.csv`, or `.json`).
3. TouchTeck automatically:
   * Extracts all swimmers, dates of birth, genders, clubs/districts, and SFI registration UIDs.
   * Matches swimmers to their official championship events (e.g., *Event #1: 1500m Freestyle - Men Group A*).
   * **Pre-seeds 8 lanes for Heat 1 and 8 lanes for Heat 2** for all events so heats are immediately ready for race day.
   * **Smart Merge Detection**: If duplicate athlete names or multi-event entries are detected, TouchTeck highlights them and offers **1-Click Merge & Add Events**.

---

## 5. Disk Folder Structure & "Open Meet Folder"

TouchTeck maintains a clean, transparent folder hierarchy on your desktop:

```
C:\Users\charleswesley\OneDrive\Desktop\TouchTeck_Data\
│
├── Meets\
│   ├── Telangana_State_Junior___Sub-Junior_Aquatic_Championship_2026\
│   │   ├── events\
│   │   │   ├── Event_01_1500m_Freestyle_Men_Group_A.json
│   │   │   ├── Event_02_800m_Freestyle_Women_Group_A.json
│   │   │   ├── Event_03_800m_Freestyle_Men_Group_B.json
│   │   │   └── ... (All 67 Championship Events)
│   │   ├── meet_info.json
│   │   ├── Swimmers_Registry.json
│   │   └── Recovery_Bin\
│   │       └── Deleted_Results\
│   │             └── Event_1_1500m_Freestyle_deleted_...json
│   │
│   └── 11th_Telangana_Masters_Inter_District_Swimming_Championship_2026\
│       ├── events\
│       ├── meet_info.json
│       ├── Swimmers_Registry.json
│       └── Recovery_Bin\
│
└── Recovery_Bin\
    └── <Deleted_Full_Meets_Archive>\
```

### The "Open Meet Folder" Button:
* In the **Meet Setup** sidebar and **Swimmer Registry** header, click **`📁 Open Meet Folder`**.
* Windows File Explorer immediately pops open directly to that specific meet’s disk directory so you can inspect, copy, or backup event files and rosters.

---

## 6. Recovery Bin & Deleted Items Architecture

TouchTeck follows a **two-level safety recovery system**:

### Level 1: Individual Result / Event Deletions
* If an operator clears or deletes results for an individual event:
* The previous results are automatically archived to:
  `TouchTeck_Data\Meets\<Meet_Name>\Recovery_Bin\Deleted_Results\<EventName>_deleted_<Timestamp>.json`
* This keeps deleted items filed strictly inside their parent championship.

### Level 2: Full Meet Deletion
* If an operator clicks **`Delete`** on a full meet in Meet Setup:
* TouchTeck **never permanently destroys the folder**.
* The entire meet folder (all event files, swimmer registries, reports, and results) is moved directly to:
  `C:\Users\charleswesley\OneDrive\Desktop\TouchTeck_Data\Recovery_Bin\<Meet_Name>_deleted_<Timestamp>\`
* To restore a deleted meet, simply move the folder back into `TouchTeck_Data\Meets\` or re-open the app.

---

## 7. Swimmer Registry & Athlete Management

### Features of the Swimmer Registry:
* **Active Championship Roster**: Displays all athletes registered for the active meet.
* **Search & Filters**: Instant live filtering by SFI UID, athlete name, district/club, gender, and age category.
* **Expandable Assigned Events**: Click **`# Events ⌵`** on any athlete row to view all events they are entered in along with their Heat and Lane numbers.
* **Add & Edit Athletes**: Modify athlete details, change SFI UIDs, or assign/remove events on the fly.
* **Multi-Meet Support**: Switch between championships directly from the **`ACTIVE MEET`** dropdown in the registry header.

---

## 8. Live Timing, Result Exports & Reports

### Operator Desk & Race Management:
* **Hardware Integration**: Connects via serial bridge to ARES21 / TouchTeck timing consoles at 9600 baud.
* **Lane Supervisor**: Real-time monitoring of Touchpad primary times (T1), backup button times (T2), and official times.
* **Auto-Save & Advance**: When a race finishes, results are saved to memory and disk simultaneously, and the console can automatically advance to the next heat.

### Export & Printing Options:
* **Print Heat Sheets**: Formatted printouts for officials, marshals, and spectators.
* **Download Excel / CSV**: Complete schedule and entry lists exported with 1 click.
* **Championship Reports**: PDF and printable summaries with official Federation logos and headers.
