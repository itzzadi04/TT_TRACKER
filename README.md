# TT_TRACKER — Academic Timetable Management & Conflict Studio

A robust, full-stack Academic Timetable Management and Conflict Tracking system with MongoDB as the single source of truth, featuring an **Effective Schedule Calculation Engine**, **Base Timetable Blueprint vs. Weekly Override Deltas**, **Date-Based Automatic Sunday Rollover**, **Multi-perspective Timetable Views** (Faculty-wise, Class/Section-wise, Room-wise), **Group-aware Laboratory Scheduling**, and **Interactive Drag-and-Drop with Intelligent Room Suggestions**.

---

## 1. Core Architecture & Concept

TT_TRACKER separates the **Base Timetable (Permanent Blueprint)** from **Week-Specific Overrides (Deltas)**. It calculates the **Effective Schedule** on the fly without duplicating whole datasets:

```
                       ┌────────────────────────┐
                       │     BASE TIMETABLE     │
                       │ (TimetableSlot Model)  │
                       └───────────┬────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
     ┌──────────────────────┐              ┌──────────────────────┐
     │  PERMANENT MUTATIONS │              │   WEEKLY OVERRIDES   │
     │   (Updates Base)     │              │  (ScheduleOverride)  │
     └──────────────────────┘              └──────────┬───────────┘
                                                      │
                                           ┌──────────┴──────────┐
                                           ▼                     ▼
                                    CURRENT WEEK (W)     NEXT WEEK (W+1)
                                           │                     │
                                           └──────────┬──────────┘
                                                      ▼
                                           ┌──────────────────────┐
                                           │  EFFECTIVE SCHEDULE  │
                                           │  CALCULATION ENGINE  │
                                           └──────────┬───────────┘
                                                      ▼
                                           ┌──────────────────────┐
                                           │  IN-MEMORY REGISTRY  │
                                           │  & CONFLICT ENGINE   │
                                           └──────────┬───────────┘
                                                      ▼
                                           ┌──────────────────────┐
                                           │  REST API & FRONTEND │
                                           │ (Class, Faculty, Room│
                                           │  Permanent/Curr/Next)│
                                           └──────────────────────┘
```

$$\text{Effective Schedule} = \text{Base} + \text{Permanent Mutations} - \text{Weekly Cancellations} - \text{Weekly Reschedules (Old)} + \text{Weekly Reschedules (New)} + \text{Weekly Extra Classes}$$

---

## 2. Key Capabilities & Features

1. **Base / Permanent Timetable**:
   - Stores the recurring template of 196 lecture and lab sessions.
   - Accessible via the **Permanent / Base** view mode for any Section, Faculty, or Room.
2. **Permanent Changes**:
   - Choosing **"Make Permanent"** directly updates the Base Timetable in MongoDB.
   - Immediately reflects across Base, Current Week, Next Week, and all future weeks.
3. **Week-Specific Overrides**:
   - Choosing **"Save for this week only"** creates a lightweight `ScheduleOverride` delta in MongoDB.
   - The Base Timetable remains completely untouched.
4. **Weekly Rollover (Sunday Midnight)**:
   - Calendar date-driven ($W \rightarrow \text{Past}$, $W+1 \rightarrow \text{Current}$, $W+2 \rightarrow \text{New Next Week}$).
   - Future weeks automatically generate clean schedules from the Base Timetable without inheriting temporary overrides.
5. **Group-Aware Laboratory Logic**:
   - Understands parallel lab groups ($G_1$ in `P4` and $G_2$ in `B1`) attending different rooms simultaneously without false conflicts.
   - Recognizes shared laboratory sessions (`sessionId`) taking place in the same room.
6. **Room Availability & Reassignment**:
   - On room conflict during drag-and-drop or reschedule, the API returns `availableRooms` that are free at that day and time.
   - Frontend displays an interactive **Room Reassignment Dialog** allowing one-click room substitution.
7. **Three Synchronized Perspectives**:
   - **Class/Section-wise**: View by semester/section (e.g. `Y3_S5_CS`).
   - **Faculty-wise**: View by professor (e.g. `AKM`).
   - **Room-wise**: View by classroom or lab (e.g. `F4`, `P4`).
8. **Interactive Visual Drag-and-Drop**:
   - Drag lecture cards directly between grid slots with backend-enforced conflict checking.

---

## 3. Database Models

| Model | Schema File | Purpose |
|---|---|---|
| **Faculty** | `models/Faculty.js` | Teacher entity (`facultyId`, `name`) |
| **ClassSection** | `models/ClassSection.js` | Academic section (`sectionId`, `year`, `semester`, `section`) |
| **Subject** | `models/Subject.js` | Course entity (`subjectCode`, `name`) |
| **Room** | `models/Room.js` | Physical room/lab (`roomNo`, `building`, `labOrClass`) |
| **Time** | `models/Time.js` | Normalized time slot (`day`, `starting`, `ending`) |
| **TimetableSlot** | `models/TimetableSlot.js` | Permanent Base Timetable slot (196 items) |
| **ScheduleOverride** | `models/ScheduleOverride.js` | Week-specific delta (`weekKey`, `action`, `originalSlot`, `time`, `room`, etc.) |

---

## 4. REST API Reference

| Method | Endpoint | Query / Body Params | Description |
|---|---|---|---|
| `GET` | `/api/timetable/grid` | `type` (FACULTY/SECTION/ROOM), `id`, `week` (base/current/next/`YYYY-Www`) | Returns 6-day matrix for entity and week |
| `GET` | `/api/timetable/entities` | — | Returns lists of all faculties, sections, rooms |
| `GET` | `/api/timetable/base` | — | Returns raw Base Timetable slots |
| `GET` | `/api/rooms/available` | `week`, `day`, `start`, `end` | Returns array of free rooms at given time |
| `POST` | `/api/timetable/move-or-add` | `{ actionType, originalSlot, targetSlot, week, scope }` | Moves or duplicates slot (`scope: 'WEEK'` or `'PERMANENT'`) |
| `POST` | `/api/timetable/cancel` | `{ slot, week, scope }` | Cancels slot (`scope: 'WEEK'` or `'PERMANENT'`) |
| `POST` | `/api/timetable/rollover` | — | Triggers weekly rollover and re-hydrates |
| `GET` | `/api/timetable/conflicts` | `facultyId`, `roomNo`, `sectionId`, `day`, `start`, `end`, `week`, `sessionId` | Checks slot availability |

---

## 5. Running and Testing

### Start Server
```bash
npm start
```
*Server runs at `http://localhost:3000`.*

### Seed Database
```bash
npm run seed
```

### Run Comprehensive Automated Tests
```bash
npm test
```
*Executes all 44 automated verification checks.*
