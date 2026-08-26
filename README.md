# Academic Timetable Studio (TT_TRACKER)
### National Institute of Technology Hamirpur (NIT Hamirpur)

A production-grade, authoritative academic timetable management and conflict-resolution platform built with **Node.js, Express, React (Vite), MongoDB Atlas**, and an in-memory transactional registry.

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

## ⚡ Core Business & Timetable Rules

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

## 🛠️ Quick Start & Running Locally

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
