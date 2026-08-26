# Academic Timetable Studio — NIT Hamirpur (TT_TRACKER)

A full-stack, enterprise Academic Timetable Management & Conflict Resolution Studio engineered for the **National Institute of Technology Hamirpur (NIT Hamirpur)**. Built with an **In-Memory Registry & Conflict Resolution Engine**, MongoDB Atlas single source of truth, **Stitch Institutional Academic Design System**, **Effective Schedule Calculation Engine**, **Real Production Calendar (`Asia/Kolkata`)**, and **Group-Aware Laboratory Logic**.

---

## 1. Clean Project Architecture & Structure

```text
TT_TRACKER/
├── public/                     # Static Client Files (Served by Express)
│   ├── css/
│   │   └── style.css           # Stitch Design System & Institutional Tokens
│   ├── js/
│   │   ├── api.js              # API Service Client
│   │   ├── state.js            # Timetable State & Workflow Context Store
│   │   ├── timetable.js        # Timetable Grid & Multi-Event Cell Renderer
│   │   ├── modals.js           # Action, Cancel, Conflict & Room Modal Controllers
│   │   └── app.js              # Main Client Application Orchestrator
│   └── index.html              # Main HTML with Two-Tier Institutional Header
│
├── routes/
│   └── timetableroutes.js      # Backend API Routes & FIFO Mutation Queue
├── models/                     # Mongoose Schema Definitions
│   ├── ClassSection.js
│   ├── Faculty.js
│   ├── Room.js
│   ├── ScheduleOverride.js     # Weekly Deltas (RESCHEDULE, ADD_EXTRA, CANCEL)
│   ├── Subject.js
│   ├── Time.js
│   └── TimetableSlot.js        # Permanent Base Blueprint (196 slots)
│
├── tracker/                    # Core Business & Timetable Logic Engine
│   ├── Registry.js             # Multi-Week In-Memory Representation
│   ├── ScheduleTracker.js      # Conflict Detection Engine
│   ├── effectiveSchedule.js    # Base + Override Calculation
│   ├── hydrate.js              # MongoDB to In-Memory Registry Sync
│   └── weekUtils.js            # Timezone-Aware Academic Calendar Engine
│
├── seed/                       # Database Seed Baseline & Script
│   ├── classSections.json
│   ├── faculty.json
│   ├── rooms.json
│   ├── seed.js                 # Database Seeder
│   ├── subjects.json
│   ├── times.json
│   └── timetableSlots.json
│
├── tests/                      # Automated Verification Matrix
│   └── workflowTestRunner.js   # 61 Automated Assertions
│
├── server.js                   # Application Server Entrypoint (Port 3000)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 2. Institutional Design System (Stitch Framework)

- **Two-Tier Institutional Header**:
  - **Top Tier (White)**: NIT Hamirpur seal, bilingual typography (*"राष्ट्रीय प्रौद्योगिकी संस्थान हमीरपुर / National Institute of Technology Hamirpur"*), and *"Academic Timetable Studio"* subtitle.
  - **Bottom Tier (Dark Institutional Navy `#002147`)**: Gold accent (`#D4AF37`) for active tab, navigation links (*Home, Timetable, Faculty, Sections, Rooms, Guidelines*), and active week status badge.
- **Timetable Grid Aesthetics**:
  - Spreadsheet-like clarity with subtle `#E0E0E0` borders and sticky day headers.
  - **Lectures**: Crisp white cards with 3px Institutional Navy top border.
  - **Labs**: Emerald Green top border (`#008543`), emerald `LAB` badges, and distinct group tags (`G1`, `G2`).
  - **Scheduled / Rescheduled**: Distinguishable visual badges (`SCHEDULED`, `RESCHEDULED`).
  - **Multi-Group Simultaneous Stacking**: Full parallel side-by-side rendering inside `.cell-content-stack`.

---

## 3. Core Business & Scheduling Rules

1. **Effective Schedule Formula**:
   $$\text{Effective Schedule} = \text{Base} + \text{Permanent Mutations} - \text{Weekly Cancellations} - \text{Weekly Reschedules (Old)} + \text{Weekly Reschedules (New)} + \text{Weekly Extra Classes}$$
2. **Calendar & Permissions (`Asia/Kolkata`)**:
   - **Mon–Fri (Weekdays)**: Current Week is **EDITABLE**; Next Week is **READ-ONLY**; Current Week can schedule extra classes for Next Week.
   - **Sat–Sun (Weekends)**: Current Week is **READ-ONLY**; Next Week is **EDITABLE**.
   - **Monday Rollover**: Advances Next Week ($W+1$) into Current Week ($W$), generating a pristine future week ($W+2$).
3. **Lab vs. Normal Class Conflict Protection**:
   - Whole-section lectures can **never** overlap existing lab sessions ($G_1$ or $G_2$), even if the target room is vacant.
   - False-positive "Available Rooms" prompts are strictly suppressed on lab and section conflicts.
4. **Active Timetable Scoping**:
   - The active working timetable determines target week automatically. Cancellation dialog requires confirmation without asking for week context again.

---

## 4. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/timetable/workflow-context` | Timezone-aware calendar state, ISO week keys, and edit permissions |
| `GET` | `/api/timetable/entities` | Lists all faculties, class sections, and rooms |
| `GET` | `/api/timetable/grid` | Returns 6-day matrix (`type=FACULTY\|SECTION\|ROOM`, `id=...`, `week=current\|next\|base`) |
| `GET` | `/api/timetable/rooms/available` | Vacant rooms query (`day`, `start`, `end`, `week`) |
| `POST` | `/api/timetable/validate-drop` | Post-drop pre-write validation guard |
| `POST` | `/api/timetable/move-or-add` | Commits reschedule or extra class placement |
| `POST` | `/api/timetable/cancel` | Cancels class from active week or base blueprint |
| `POST` | `/api/timetable/rollover` | Triggers weekly rollover |

---

## 5. Installation & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in project root:
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/TT_TRACKER?retryWrites=true&w=majority
TZ=Asia/Kolkata
DEV_MODE=false
```

### 3. Seed Database
```bash
npm run seed
```

### 4. Run Automated Test Suite (61 Tests)
```bash
npm test
```

### 5. Start Application Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.
