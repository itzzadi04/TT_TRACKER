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
- **Canonical Endpoint**: `POST /api/timetable/import`
- **Compatibility Aliases**:
  - `POST /api/timetable/import-base`
  - `POST /api/import`
  - `POST /api/import-base`
- **Authentication Headers** (one required):
  - `x-import-secret: <TT_TRACKER_IMPORT_SECRET>` (Preferred)
  - `Authorization: Bearer <TT_TRACKER_IMPORT_SECRET>`
  - `x-api-key: <TT_TRACKER_IMPORT_SECRET>` (Compatibility)
- **Environment Variable**: `TT_TRACKER_IMPORT_SECRET` in `.env` (must match the secret configured in FATGS; never logged or exposed in client responses).

### 2. Integration Contract (Payload Format)
The canonical request body carries both the authoritative academic master collections and the timetable `slots`:

```json
{
  "packageId": "FATGS_ODD_SEM_2026_BATCH_1",
  "academicYear": "2026-2027",
  "semesterType": "Odd",
  "rooms": [
    { "roomNo": "P6", "labOrClass": "Lab", "building": "DoCSE Block A Top Floor", "isLab": true },
    { "roomNo": "B4", "labOrClass": "Class", "building": "Vivekanand Lecture Hall", "isLab": false }
  ],
  "faculties": [
    { "facultyId": "KD", "name": "Dr Kamlesh Dutta" },
    { "facultyId": "RK", "name": "Dr Rajeev Kumar" }
  ],
  "subjects": [
    { "subjectCode": "CS-212", "name": "Discrete Structures" },
    { "subjectCode": "CS-315", "name": "Design & Analysis of Algorithms Lab" }
  ],
  "sections": [
    { "section": "CS2", "year": "2nd Year", "semester": "3rd Semester" },
    { "section": "MTECH-CSE", "originalSection": "MT1", "year": "M.Tech 1st Year", "semester": "1st Semester" },
    { "section": "MTECH-AI", "originalSection": "MA1", "year": "M.Tech 1st Year", "semester": "1st Semester" }
  ],
  "times": [
    { "day": "Monday", "start": "09:00", "end": "10:00" }
  ],
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
      "section": "MTECH-CSE",
      "year": "M.Tech 1st Year",
      "semester": "1st Semester",
      "day": "Monday",
      "start": "10:00",
      "end": "12:00",
      "subjectCode": "CS-315",
      "faculty": "AKY",
      "room": "P6",
      "isLab": true,
      "duration": 2,
      "group": "G1",
      "sessionId": "AKY_MTECH-CSE_CS-315_Monday_10:00_G1"
    }
  ]
}
```

*Note: For backward compatibility, payloads containing `"timetable": [...]` or a raw array of slots `[...]` are normalized internally.*

### 3. Academic Master Data Synchronization
TT_TRACKER treats FATGS as the authoritative source for academic master data:
1. **Rooms**: Extracted and upserted into MongoDB `Room` by `roomNo`. Preserves `labOrClass` ('Lab' | 'Class') and `building` (e.g. `P6` as Lab in `DoCSE Block A Top Floor`). All rooms `P1` through `P6` work through the identical generic mechanism. Unknown rooms not present in the package or DB are rejected (`422`).
2. **Faculty**: Extracted and upserted into MongoDB `Faculty` by `facultyId`.
3. **Subjects**: Extracted and upserted into MongoDB `Subject` by `subjectCode`.
4. **Sections**: Extracted and upserted into MongoDB `ClassSection` by `sectionId` and `(year, section, semester)`.
5. **Idempotency**: Repeatedly importing the same package produces zero duplicate documents.

### 4. M.Tech Section Compatibility
FATGS and TT_TRACKER use different identifier conventions for post-graduate sections:
- `MT1` or `MT` in FATGS maps to `MTECH-CSE` (`Y1_S1_MTECH-CSE`) in TT_TRACKER.
- `MA1` or `MA` in FATGS maps to `MTECH-AI` (`Y1_S1_MTECH-AI`) in TT_TRACKER.

The normalization engine protects `MT1` and `MA1` from generic regex digit stripping (which would otherwise corrupt them to `MT`/`MA`), ensuring exact one-to-one resolution and keeping M.Tech CSE and M.Tech AI distinct.

### 5. Odd / Even Semester Isolation
- The import validates semester parity against `semesterType`:
  - `Odd` semester imports accept only odd semesters (1, 3, 5, 7, 9). Any even semester slot is rejected (`422 Unprocessable Entity`).
  - `Even` semester imports accept only even semesters (2, 4, 6, 8, 10). Any odd semester slot is rejected.
- Resolvers never cross semester boundaries, preventing cross-semester corruption.

### 6. Validation & Safety Guarantees
1. **Pre-flight Reference Resolution**: Every slot is validated against MongoDB documents freshly synchronized from the package:
   - **Faculty**: Looked up by `facultyId` or exact full `name`. Unknown faculty rejects the entire package.
   - **Room**: Looked up by `roomNo`. Unknown room rejects the entire package.
   - **Subject**: Looked up by `subjectCode`. Unknown subject rejects the entire package.
   - **Section**: Resolved via explicit mapping or `(year, semester, section)` tuple. Unknown section rejects the package.
   - **Time**: Validated day (`Monday`–`Saturday`) and time range (`start < end`).
2. **Pre-flight Conflict Validation**:
   - Detects exact duplicate slot records.
   - Verifies faculty concurrency (same faculty cannot teach two different sessions at the same time).
   - Verifies room concurrency (same room cannot host two different sessions at the same time).
   - Verifies section concurrency (permits parallel multi-group labs like $G_1$ in `P4` and $G_2$ in `B1`, but rejects overlapping regular lectures).
3. **Atomic Replacement in MongoDB Transaction**:
   - Validation occurs **BEFORE** any destructive database write.
   - Base timetable replacement executes inside a MongoDB multi-document transaction (`session.withTransaction`), with automatic retry on transient write conflicts.
   - If any step fails, the transaction is rolled back and the existing timetable remains completely untouched.
4. **Stale Override Purging & Immediate Hydration**:
   - Replacing the base timetable automatically purges stale `ScheduleOverride` records tied to the replaced schedule.
   - `await hydrate()` is called immediately upon transaction commit, reloading the in-memory `Registry` so the new base schedule is immediately active for current week grid views without server restart.
5. **Idempotency**: Repeatedly importing the same package produces identical database state without duplicate documents.

### 7. Response Contract
**Success (`200 OK`)**:
```json
{
  "success": true,
  "packageId": "FATGS_ODD_SEM_2026_BATCH_1",
  "academicYear": "2026-2027",
  "semesterType": "Odd",
  "importedSlots": 223,
  "count": 223,
  "message": "Base timetable imported successfully"
}
```

**Failure (`400 Bad Request` or `422 Unprocessable Entity`)**:
```json
{
  "success": false,
  "message": "Slot #5: Unknown faculty \"XYZ\". Faculty must exist in TT_TRACKER faculty registry or package master data.",
  "error": "Slot #5: Unknown faculty \"XYZ\". Faculty must exist in TT_TRACKER faculty registry or package master data.",
  "errors": ["Slot #5: Unknown faculty \"XYZ\". Faculty must exist in TT_TRACKER faculty registry or package master data."]
}
```

### 8. Verification Test Suites
```bash
# Run the authoritative 78-assertion import test suite (including master data sync, P1..P6, idempotency)
npm run test:import

# Run the 61-assertion active-week workflow test suite
npm test

# Re-seed the baseline pristine dataset at any time
npm run seed
```
