# Academic Timetable (TT_TRACKER)
### National Institute of Technology Hamirpur (NIT Hamirpur)

A production-grade, authoritative academic timetable management and conflict-resolution platform built with **Node.js, Express, React (Vite)(vibe-coded), MongoDB Atlas**, and an in-memory transactional registry.

---

## 🏛️ System Architecture

```text
TT_TRACKER/
│
├── frontend/                          # [REACT + VITE FRONTEND]
│   ├── public/                        # Static assets (Favicon)
│   ├── src/
│   │   ├── components/                # Modular React Components (Header, Toolbar, Grid, Modals, Feedback)
│   │   ├── hooks/useTimetable.js      # Central Timetable State & Mutation Hook
│   │   ├── services/api.js            # Frontend API Service
│   │   ├── styles/index.css           # Canonical Stitch Institutional Design System
│   │   ├── App.jsx                    # Root Studio Component
│   │   └── main.jsx                   # React Entrypoint
│   ├── index.html                     # Vite HTML Entrypoint
│   ├── package.json                   # React Dependencies
│   └── vite.config.js                 # Vite Config & Proxy to Express
│
├── models/                            # [MONGOOSE SCHEMAS & DATABASE MODELS]
│   ├── ClassSection.js                # Academic Sections (CE-II, CSE-IV, etc.)
│   ├── Faculty.js                     # Faculty Profiles & IDs
│   ├── Room.js                        # Rooms, Lecture Halls & Labs
│   ├── ScheduleOverride.js            # Temporary / Permanent Overrides & Cancellations
│   ├── Subject.js                     # Course Codes & Names
│   ├── Time.js                        # Academic Period Definitions
│   └── TimetableSlot.js               # Base Master Timetable Slots
│
├── tracker/                           # [TIMETABLE & CONFLICT ENGINE]
│   ├── Registry.js                    # In-Memory High-Performance Timetable Registry
│   ├── ScheduleTracker.js             # Hard Conflict Rules & Validation Engine
│   ├── effectiveSchedule.js           # Multi-Week Overlay Compiler (Base + Overrides)
│   ├── hydrate.js                     # MongoDB Startup Hydrator & Cache Sync
│   └── weekUtils.js                   # Timezone Calendar Engine (Asia/Kolkata)
│
├── routes/                            # [REST API ROUTES & SERIALIZED MUTATION QUEUE]
│   └── timetableroutes.js             # Express Routes (/api/timetable/*)
│
├── seed/                              # [DATABASE SEEDING & BASELINE DATASETS]
│   ├── seed.js                        # Baseline Seeder Script (npm run seed)
│   └── *.json                         # Pristine Academic Datasets (196 Slots)
│
├── tests/                             # [AUTOMATED VERIFICATION SUITE]
│   ├── workflowTestRunner.js          # Authoritative 61-Assertion Test Suite (npm test)
│   └── testRunner.js                  # Engine Verification Suite
│
├── docs/                              # [DOCUMENTATION & DESIGN ASSETS]
│   └── design-reference/              # Stitch Framework Design Tokens & References
│
├── server.js                          # Express Server & React Static Host (Port 3000)
├── package.json                       # Backend Dependencies & Run Scripts
├── .env.example                       # Environment Template
├── .gitignore                         # Comprehensive Ignore Rules
└── README.md                          # Master Project Documentation
```

---

## Core Business & Timetable Rules

1. **Active Week Scoping**: All rescheduling and cancellations apply strictly to the currently active timetable context (`Current Week`, `Next Week`, or `Base Blueprint`).
2. **Lab Protection & Simultaneous Groups**:
   - Multi-group parallel lab sessions ($G_1$ in `P4` and $G_2$ in `B1`) stack simultaneously without conflict.
   - Normal lectures attempting to occupy lab slots or lab periods are strictly rejected (`LAB_TIME_CONFLICT`), and room reassignments are suppressed.
3. **Room Conflict Resolver**: Moving a class into an occupied room triggers `ROOM_CONFLICT` with a dynamic selection of vacant rooms for instantaneous reassignment.
4. **Academic Calendar (Asia/Kolkata)**:
   - **Weekdays (Mon–Fri)**: Current Week is **EDITABLE**; Next Week is view-only with ability to schedule additional classes.
   - **Weekends (Sat–Sun)**: Current Week becomes **READ-ONLY**; Next Week opens for **EDITING**.
   - **Monday Rollover**: Automatic promotion of Next Week to Current Week, generating a clean future schedule without override leakage.

---

## Quick Start & Running Locally

### Prerequisites
- **Node.js**: v18+ (tested on v24)
- **MongoDB**: MongoDB Atlas or local MongoDB instance

### 1. Backend Setup
```bash
# Install backend dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and supply your MONGO_URI

# Seed pristine baseline timetable data into MongoDB
npm run seed

# Run automated 61-assertion verification test suite
npm test

# Start the Express server
npm start
```

### 2. Frontend Development (React + Vite)
```bash
cd frontend

# Install frontend dependencies
npm install

# Start Vite dev server with proxy to http://localhost:3000
npm run dev

# Build production bundle into frontend/dist/
npm run build
```

### 3. Production Deployment
When running `npm start` from the root directory, Express serves the optimized React bundle from `frontend/dist/` with full client-side SPA routing fallback.

---

## 🔄 FATGS Timetable Import Integration (Server-to-Server)

TT_TRACKER provides a secure, authenticated server-to-server endpoint allowing FATGS (Faculty Allocation & Timetable Generation System) to hand off a complete generated semester timetable.

> [!IMPORTANT]
> **System Roles & Database Ownership**:
> - **FATGS** generates, validates, and exports the timetable package.
> - **TT_TRACKER** receives, validates, and owns its MongoDB database. FATGS never connects directly to TT_TRACKER's database.
> - After import, the timetable immediately becomes the **BASE** and **CURRENT** timetable.

### 1. Endpoint & Authentication
- **Method & Route**: `POST /api/timetable/import` (or `POST /api/import`)
- **Headers**:
  - `Content-Type: application/json`
  - `x-import-secret: <TT_TRACKER_IMPORT_SECRET>` or `Authorization: Bearer <TT_TRACKER_IMPORT_SECRET>`
- **Environment Variable**: `TT_TRACKER_IMPORT_SECRET` in `.env` (configured locally or via deployment secrets; never committed to git).

### 2. Integration Contract (Payload Format)
The endpoint accepts either a wrapped package object or a direct array of flat slots:

```json
{
  "academicYear": "2026-2027",
  "semesterType": "Odd",
  "packageId": "FATGS_ODD_SEM_2026_BATCH_1",
  "slots": [
    {
      "section": "CS2",
      "year": "2nd Year",
      "semester": "3rd Semester",
      "day": "Monday",
      "start": "09:00",
      "end": "10:00",
      "subjectCode": "CS-212",
      "faculty": "RK",
      "room": "G5",
      "isLab": false,
      "duration": 1,
      "group": null,
      "sessionId": "RK_Y2_S3_CS_CS-212_Monday_09:00"
    },
    {
      "section": "CS2",
      "year": "2nd Year",
      "semester": "3rd Semester",
      "day": "Monday",
      "start": "11:00",
      "end": "13:00",
      "subjectCode": "CS-218",
      "faculty": "NG",
      "room": "P4",
      "isLab": true,
      "duration": 2,
      "group": "G1",
      "sessionId": "NG_Y2_S3_CS_CS-218_Monday_11:00_G1"
    }
  ]
}
```

### 3. Validation & Safety Guarantees
1. **Pre-flight Reference Resolution**: Every slot is checked against authoritative collections:
   - **Faculty**: Looked up by `facultyId` or exact full `name`. Unknown faculty rejects the package.
   - **Room**: Looked up by `roomNo`. Unknown room rejects the package.
   - **Subject**: Looked up by `subjectCode`. Unknown subject rejects the package.
   - **Section**: Resolved from `sectionId` (e.g. `Y2_S3_CS`) or tuple `(year, semester, section)` with normalization (e.g. `"2nd Year"` / `2`, `"3rd Semester"` / `3`, `"CS2"` / `"CS"`).
   - **Time**: Validated day (`Monday`–`Saturday`) and time range (`start < end`).
2. **Pre-flight Conflict Validation**:
   - Detects exact duplicate records.
   - Verifies faculty concurrency (same faculty cannot teach two different sessions at the same time).
   - Verifies room concurrency (same room cannot host two different sessions at the same time).
   - Verifies section concurrency (permits simultaneous parallel group labs such as $G_1$ in `P4` and $G_2$ in `B1`, but rejects overlapping regular lectures).
3. **Atomicity Guarantee**:
   - If ANY validation fails, the request is rejected with `422 Unprocessable Entity` or `400 Bad Request`.
   - The existing timetable in MongoDB and runtime `Registry` remains 100% untouched.
4. **Replacement & Override Cleanup**:
   - On complete validation, base timetable slots in `TimetableSlot` are replaced inside a MongoDB transaction (or sequential fallback).
   - Stale timetable-specific `ScheduleOverride` records tied to the old base timetable are automatically purged.
   - `await hydrate()` is called immediately to update the in-memory `Registry`.
   - The new timetable is immediately active for current week views without requiring a server restart or Monday rollover.
5. **Idempotency**: Repeatedly importing the same package is safe and produces identical database state.

### 4. Running Verification Tests
```bash
# Run the 43-assertion import endpoint test suite
npm run test:import

# Run the 61-assertion active-week workflow test suite
npm test
```
