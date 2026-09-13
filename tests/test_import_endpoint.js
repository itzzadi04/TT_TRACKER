const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const timetableRoutes = require('../routes/timetableroutes');
const registry = require('../tracker/Registry');
const { hydrate } = require('../tracker/hydrate');

const Faculty = require('../models/Faculty');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Time = require('../models/Time');
const TimetableSlot = require('../models/TimetableSlot');
const ScheduleOverride = require('../models/ScheduleOverride');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✔ PASS: ${message}`);
        passedTests++;
    } else {
        console.error(`  ✖ FAIL: ${message}`);
        failedTests++;
    }
}

async function runImportTestSuite() {
    console.log('============================================================');
    console.log('TT_TRACKER — PRODUCTION TIMETABLE IMPORT TEST SUITE');
    console.log('============================================================\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');

    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/timetable', timetableRoutes);
    app.use('/api', timetableRoutes);

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Test Express server listening on ${baseUrl}\n`);

    const validSecret = process.env.TT_TRACKER_IMPORT_SECRET || 'local_tt_tracker_test_secret_key_2026';

    // Helper to send HTTP requests to import endpoint
    async function postImport(body, customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'x-import-secret': validSecret,
            ...customHeaders
        };
        const res = await fetch(`${baseUrl}/api/timetable/import`, {
            method: 'POST',
            headers,
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, data };
    }

    try {
        // ── Ensure baseline data is seeded ──
        console.log('[Setup] Verifying baseline entities in DB...');
        const facCount = await Faculty.countDocuments();
        const roomCount = await Room.countDocuments();
        const secCount = await ClassSection.countDocuments();
        const subCount = await Subject.countDocuments();
        console.log(`Existing entities: ${facCount} faculties, ${roomCount} rooms, ${secCount} sections, ${subCount} subjects.\n`);

        // Baseline valid slot template
        const baseValidSlots = [
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "09:00",
                end: "10:00",
                subjectCode: "CS-212",
                faculty: "RK",
                room: "G5",
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "TEST_RK_Y2_S3_CS_CS-212_Mon_0900"
            },
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "10:00",
                end: "11:00",
                subjectCode: "EC-219",
                faculty: "AMK",
                room: "F4",
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "TEST_AMK_Y2_S3_CS_EC-219_Mon_1000"
            },
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "11:00",
                end: "13:00",
                subjectCode: "CS-218",
                faculty: "NG",
                room: "P4",
                isLab: true,
                duration: 2,
                group: "G1",
                sessionId: "TEST_NG_Y2_S3_CS_CS-218_Mon_1100_G1"
            },
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "11:00",
                end: "13:00",
                subjectCode: "CS-219",
                faculty: "NC",
                room: "B1",
                isLab: true,
                duration: 2,
                group: "G2",
                sessionId: "TEST_NC_Y2_S3_CS_CS-219_Mon_1100_G2"
            }
        ];

        // ════════════════════════════════════════════════════════════
        // TEST SUITE A: AUTHENTICATION
        // ════════════════════════════════════════════════════════════
        console.log('>>> [TEST SUITE A] Authentication');

        // A.1: Missing secret header
        const resA1 = await fetch(`${baseUrl}/api/timetable/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slots: baseValidSlots })
        });
        assert(resA1.status === 401, 'A.1: Missing import secret returns 401 Unauthorized');

        // A.2: Invalid secret
        const resA2 = await postImport({ slots: baseValidSlots }, { 'x-import-secret': 'wrong-secret-123' });
        assert(resA2.status === 401, 'A.2: Invalid secret returns 401 Unauthorized');

        // A.3: Valid secret via x-import-secret
        const resA3 = await postImport({ slots: baseValidSlots });
        assert(resA3.status === 200, 'A.3: Valid secret via x-import-secret header accepted (200 OK)');

        // A.4: Valid secret via Authorization: Bearer <secret>
        const resA4 = await postImport({ slots: baseValidSlots }, {
            'x-import-secret': '',
            'authorization': `Bearer ${validSecret}`
        });
        assert(resA4.status === 200, 'A.4: Valid secret via Authorization: Bearer accepted (200 OK)');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE B: PAYLOAD STRUCTURE VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE B] Payload Structure Validation');

        // B.1: Malformed / non-array payload
        const resB1 = await postImport({ randomKey: 'invalid' });
        assert(resB1.status === 400, 'B.1: Malformed payload returns 400 Bad Request');

        // B.2: Empty array
        const resB2 = await postImport({ slots: [] });
        assert(resB2.status === 400, 'B.2: Empty slots array returns 400 Bad Request');

        // B.3: Direct array support (without outer object wrapper)
        const resB3 = await postImport(baseValidSlots);
        assert(resB3.status === 200, 'B.3: Direct JSON array payload accepted');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE C: DAY & TIME VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE C] Day & Time Validation');

        // C.1: Invalid day
        const invalidDaySlots = JSON.parse(JSON.stringify(baseValidSlots));
        invalidDaySlots[0].day = 'Funday';
        const resC1 = await postImport({ slots: invalidDaySlots });
        assert(resC1.status === 422, 'C.1: Invalid day returns 422 Unprocessable Entity');

        // C.2: End time before start time
        const invalidTimeSlots = JSON.parse(JSON.stringify(baseValidSlots));
        invalidTimeSlots[0].start = '12:00';
        invalidTimeSlots[0].end = '10:00';
        const resC2 = await postImport({ slots: invalidTimeSlots });
        assert(resC2.status === 422, 'C.2: End time before start time returns 422');

        // C.3: Missing time fields
        const missingTimeSlots = JSON.parse(JSON.stringify(baseValidSlots));
        delete missingTimeSlots[0].start;
        const resC3 = await postImport({ slots: missingTimeSlots });
        assert(resC3.status === 422, 'C.3: Missing time parameters returns 422');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE D: FACULTY VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE D] Faculty Validation');

        // D.1: Unknown faculty
        const unknownFacSlots = JSON.parse(JSON.stringify(baseValidSlots));
        unknownFacSlots[0].faculty = 'NON_EXISTENT_PROF_999';
        const resD1 = await postImport({ slots: unknownFacSlots });
        assert(resD1.status === 422, 'D.1: Unknown faculty identifier returns 422');
        assert(resD1.data?.error?.includes('Unknown faculty'), 'D.1b: Returns informative error about unknown faculty');

        // D.2: Faculty match by full name
        const nameFacSlots = JSON.parse(JSON.stringify(baseValidSlots));
        nameFacSlots[0].faculty = 'Dr Rajeev Kumar'; // matches RK
        const resD2 = await postImport({ slots: nameFacSlots });
        assert(resD2.status === 200, 'D.2: Faculty matched by name accepted (200 OK)');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE E: ROOM VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE E] Room Validation');

        // E.1: Unknown room
        const unknownRoomSlots = JSON.parse(JSON.stringify(baseValidSlots));
        unknownRoomSlots[0].room = 'ROOM_NON_EXISTENT_HALL';
        const resE1 = await postImport({ slots: unknownRoomSlots });
        assert(resE1.status === 422, 'E.1: Unknown room returns 422');
        assert(resE1.data?.error?.includes('Unknown room'), 'E.1b: Returns informative error about unknown room');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE F: SUBJECT VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE F] Subject Validation');

        // F.1: Unknown subject
        const unknownSubSlots = JSON.parse(JSON.stringify(baseValidSlots));
        unknownSubSlots[0].subjectCode = 'FAKE-999';
        const resF1 = await postImport({ slots: unknownSubSlots });
        assert(resF1.status === 422, 'F.1: Unknown subject code returns 422');
        assert(resF1.data?.error?.includes('Unknown subject'), 'F.1b: Returns informative error about unknown subject');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE G: SECTION RESOLUTION & VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE G] Section Resolution');

        // G.1: FATGS string formats e.g. "CS2", "2nd Year", "3rd Semester"
        const fatgsSectionSlots = JSON.parse(JSON.stringify(baseValidSlots));
        fatgsSectionSlots[0].section = 'CS2';
        fatgsSectionSlots[0].year = '2nd Year';
        fatgsSectionSlots[0].semester = '3rd Semester';
        const resG1 = await postImport({ slots: fatgsSectionSlots });
        assert(resG1.status === 200, 'G.1: Section resolved from FATGS-style "CS2" + "2nd Year" + "3rd Semester"');

        // G.2: Unresolvable section
        const unknownSecSlots = JSON.parse(JSON.stringify(baseValidSlots));
        unknownSecSlots[0].section = 'XYZ99_NON_EXISTENT';
        unknownSecSlots[0].year = 99;
        unknownSecSlots[0].semester = 99;
        const resG2 = await postImport({ slots: unknownSecSlots });
        assert(resG2.status === 422, 'G.2: Unresolvable class section returns 422');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE H: CONFLICT & DUPLICATE VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE H] Duplicate & Conflict Validation');

        // H.1: Exact duplicate slot in package
        const dupSlots = [
            ...baseValidSlots,
            { ...baseValidSlots[0] } // exact duplicate of slot 0
        ];
        const resH1 = await postImport({ slots: dupSlots });
        assert(resH1.status === 422, 'H.1: Exact duplicate record in package rejected with 422');

        // H.2: Faculty conflict in package (RK booked concurrently for different sections)
        const facConflictSlots = [
            ...baseValidSlots,
            {
                section: "CD",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "09:00",
                end: "10:00",
                subjectCode: "CS-214",
                faculty: "RK", // RK is already teaching CS-212 in G5 at Monday 09:00!
                room: "B4",
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "CONFLICTING_RK_SESSION"
            }
        ];
        const resH2 = await postImport({ slots: facConflictSlots });
        assert(resH2.status === 422, 'H.2: Concurrent faculty conflict in package rejected with 422');
        assert(resH2.data?.error?.includes('Faculty conflict'), 'H.2b: Returns detailed Faculty conflict message');

        // H.3: Room conflict in package (Room G5 booked concurrently for different sections)
        const roomConflictSlots = [
            ...baseValidSlots,
            {
                section: "CD",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "09:00",
                end: "10:00",
                subjectCode: "CS-214",
                faculty: "AKM",
                room: "G5", // G5 is already occupied by RK at Monday 09:00!
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "CONFLICTING_G5_SESSION"
            }
        ];
        const resH3 = await postImport({ slots: roomConflictSlots });
        assert(resH3.status === 422, 'H.3: Concurrent room conflict in package rejected with 422');
        assert(resH3.data?.error?.includes('Room conflict'), 'H.3b: Returns detailed Room conflict message');

        // H.4: Section conflict in package (Section CS scheduled for 2 regular classes at same time)
        const secConflictSlots = [
            ...baseValidSlots,
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "09:00",
                end: "10:00",
                subjectCode: "CS-213",
                faculty: "AKM",
                room: "B4",
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "CONFLICTING_SECTION_SESSION"
            }
        ];
        const resH4 = await postImport({ slots: secConflictSlots });
        assert(resH4.status === 422, 'H.4: Concurrent section conflict rejected with 422');

        // H.5: Parallel Group Labs are valid simultaneously (G1 in P4 and G2 in B1 at 11:00-13:00)
        const parallelGroupRes = await postImport({ slots: baseValidSlots });
        assert(parallelGroupRes.status === 200, 'H.5: Parallel G1 and G2 labs in separate rooms pass conflict validation');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE I: ATOMICITY (FAILED IMPORT PRESERVES OLD TIMETABLE)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE I] Atomicity Guarantee');

        // Establish known state
        await postImport({ slots: baseValidSlots });
        const beforeSlots = await TimetableSlot.find({ week: 'base' }).lean();
        const beforeCount = beforeSlots.length;
        const beforeIds = beforeSlots.map(s => s._id.toString()).sort();

        // Attempt import with 1 invalid slot among valid slots
        const poisonSlots = [
            ...baseValidSlots,
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Monday",
                start: "14:00",
                end: "15:00",
                subjectCode: "CS-212",
                faculty: "POISON_UNKNOWN_FACULTY",
                room: "G5"
            }
        ];
        const poisonRes = await postImport({ slots: poisonSlots });
        assert(poisonRes.status === 422, 'I.1: Rejected package with single invalid slot');

        const afterSlots = await TimetableSlot.find({ week: 'base' }).lean();
        const afterCount = afterSlots.length;
        const afterIds = afterSlots.map(s => s._id.toString()).sort();

        assert(beforeCount === afterCount, `I.2: Slot count unchanged after rejection (${beforeCount} === ${afterCount})`);
        assert(JSON.stringify(beforeIds) === JSON.stringify(afterIds), 'I.3: Exact original slot ObjectIds remain completely untouched in MongoDB');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE J: REPLACEMENT & INSTANT ACTIVATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE J] Replacement & Immediate Activation');

        // Create an alternative timetable package with distinct subject (CS-215 at 14:00-15:00)
        const newSemesterSlots = [
            {
                section: "CS",
                year: 2,
                semester: 3,
                day: "Tuesday",
                start: "14:00",
                end: "15:00",
                subjectCode: "CS-215",
                faculty: "DPM",
                room: "B4",
                isLab: false,
                duration: 1,
                group: null,
                sessionId: "NEW_SEM_DPM_CS215_TUE_1400"
            }
        ];

        const replaceRes = await postImport({
            packageId: "FATGS_ODD_SEM_2026_TEST",
            academicYear: "2026-2027",
            semesterType: "Odd",
            slots: newSemesterSlots
        });
        assert(replaceRes.status === 200, 'J.1: New semester timetable import succeeded');
        assert(replaceRes.data?.count === 1, 'J.2: Response reports 1 slot imported');

        // Verify in MongoDB
        const dbBaseSlots = await TimetableSlot.find({ week: 'base' }).populate('faculty subject room').lean();
        assert(dbBaseSlots.length === 1, 'J.3: MongoDB base slots replaced (now 1 slot)');
        assert(dbBaseSlots[0].subject.subjectCode === 'CS-215', 'J.4: MongoDB contains new subject CS-215');
        assert(dbBaseSlots[0].faculty.facultyId === 'DPM', 'J.5: MongoDB contains new faculty DPM');

        // Verify in-memory Registry (Immediate activation without restart or Monday rollover)
        const facultyGrid = registry.getRepresentation('FACULTY', 'DPM', 'current');
        const tuesdayDay = Array.isArray(facultyGrid) ? facultyGrid.find(d => d.day === 'Tuesday') : null;
        const activeCell = tuesdayDay?.slots?.find(s => s.occupied && s.data?.subjectCode === 'CS-215');
        assert(activeCell !== undefined, 'J.6: Registry immediately reflects new slot in Current Week for faculty DPM');

        // Verify API Grid Endpoint
        const gridApiRes = await fetch(`${baseUrl}/api/timetable/grid?type=FACULTY&id=DPM&week=current`);
        const gridJson = await gridApiRes.json();
        const apiTuesday = Array.isArray(gridJson?.grid) ? gridJson.grid.find(d => d.day === 'Tuesday') : null;
        const apiCell = apiTuesday?.slots?.find(s => s.occupied && s.data?.subjectCode === 'CS-215');
        assert(apiCell !== undefined, 'J.7: GET /api/timetable/grid returns newly imported timetable immediately');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE K: STALE OVERRIDE CLEANUP
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE K] Stale Override Cleanup');

        // Create a dummy override referencing the current slot
        const dummyFaculty = await Faculty.findOne({ facultyId: 'DPM' });
        const dummySection = await ClassSection.findOne({ sectionId: 'Y2_S3_CS' });
        const dummySub = await Subject.findOne({ subjectCode: 'CS-215' });
        const dummyRoom = await Room.findOne({ roomNo: 'B4' });
        const dummyTime = await Time.findOne({ day: 'Tuesday', starting: '14:00', ending: '15:00' });

        await ScheduleOverride.create({
            weekKey: '2026-W38',
            originalSlot: dbBaseSlots[0]._id,
            action: 'CANCEL',
            scope: 'CURRENT_WEEK',
            faculty: dummyFaculty._id,
            classSection: dummySection._id,
            subject: dummySub._id,
            room: dummyRoom._id,
            time: dummyTime._id,
            sessionId: 'OLD_STALE_OVERRIDE',
            status: 'ACTIVE'
        });

        const overrideBefore = await ScheduleOverride.countDocuments({ status: 'ACTIVE' });
        assert(overrideBefore >= 1, 'K.1: Active override created against old timetable');

        // Now import a fresh base timetable
        await postImport({ slots: baseValidSlots });

        const overrideAfter = await ScheduleOverride.countDocuments({ status: 'ACTIVE' });
        assert(overrideAfter === 0, 'K.2: Stale overrides automatically cleared upon base timetable replacement');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE L: RESTAURANT / RESTART PERSISTENCE
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE L] Restart Persistence (Simulated Server Restart)');

        // Clear in-memory state completely
        registry.clear();
        assert(registry.getEntityIds('FACULTY').length === 0, 'L.1: In-memory registry cleared');

        // Re-hydrate directly from MongoDB as server startup does
        await hydrate();
        const rehydratedFaculties = registry.getEntityIds('FACULTY');
        assert(rehydratedFaculties.includes('RK'), 'L.2: Rehydration restored RK from imported database state');
        assert(rehydratedFaculties.includes('AMK'), 'L.3: Rehydration restored AMK from imported database state');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE M: IDEMPOTENCY (REPEATED IMPORT)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE M] Idempotency');

        const count1 = await TimetableSlot.countDocuments({ week: 'base' });
        const resM1 = await postImport({ slots: baseValidSlots });
        const count2 = await TimetableSlot.countDocuments({ week: 'base' });

        assert(resM1.status === 200, 'M.1: Repeated import returns 200 OK');
        assert(count1 === count2, `M.2: Re-sending identical import produces identical document count (${count1} === ${count2})`);

    } finally {
        server.close();
        console.log('\n[Cleanup] Test Express server closed.');
    }

    console.log('\n============================================================');
    console.log(`IMPORT TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    if (failedTests > 0) {
        process.exit(1);
    }
}

runImportTestSuite().catch(err => {
    console.error('Fatal Import Test Error:', err);
    process.exit(1);
});
