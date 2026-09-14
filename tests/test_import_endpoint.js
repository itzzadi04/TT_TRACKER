const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const timetableRoutes = require('../routes/timetableroutes');
const registry = require('../tracker/Registry');
const { hydrate } = require('../tracker/hydrate');
const { normalizeSectionName } = require('../routes/importController');

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
    console.log('TT_TRACKER — PRODUCTION TIMETABLE IMPORT TEST SUITE (25+ SPEC)');
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
    async function postImport(body, customHeaders = {}, endpoint = '/api/timetable/import') {
        const headers = {
            'Content-Type': 'application/json',
            'x-import-secret': validSecret,
            ...customHeaders
        };
        const res = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, data };
    }

    try {
        console.log('[Setup] Verifying baseline entities in DB...');
        const facCount = await Faculty.countDocuments();
        const roomCount = await Room.countDocuments();
        const secCount = await ClassSection.countDocuments();
        const subCount = await Subject.countDocuments();
        console.log(`Existing entities: ${facCount} faculties, ${roomCount} rooms, ${secCount} sections, ${subCount} subjects.\n`);

        // Baseline canonical valid package
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

        const basePackage = {
            packageId: "FATGS_ODD_SEM_2026_TEST_A",
            academicYear: "2026-2027",
            semesterType: "Odd",
            slots: baseValidSlots
        };

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 1: AUTHENTICATION & HEADERS
        // ════════════════════════════════════════════════════════════
        console.log('>>> [TEST SUITE 1] Authentication & Headers');

        // 1.1: Missing secret header -> 401
        const resA1 = await fetch(`${baseUrl}/api/timetable/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(basePackage)
        });
        assert(resA1.status === 401, '1.1: Missing import secret returns 401 Unauthorized');

        // 1.2: Invalid secret -> 401
        const resA2 = await postImport(basePackage, { 'x-import-secret': 'wrong-secret-123' });
        assert(resA2.status === 401, '1.2: Invalid secret returns 401 Unauthorized');

        // 1.3: Valid secret via canonical x-import-secret -> 200
        const resA3 = await postImport(basePackage);
        assert(resA3.status === 200, '1.3: Valid secret via x-import-secret accepted (200 OK)');
        assert(resA3.data?.importedSlots === 4, '1.3b: Response contains canonical "importedSlots" field');

        // 1.4: Valid secret via Authorization: Bearer <secret> -> 200
        const resA4 = await postImport(basePackage, {
            'x-import-secret': '',
            'authorization': `Bearer ${validSecret}`
        });
        assert(resA4.status === 200, '1.4: Valid secret via Authorization: Bearer accepted (200 OK)');

        // 1.5: Valid secret via x-api-key compatibility header -> 200
        const resA5 = await postImport(basePackage, {
            'x-import-secret': '',
            'x-api-key': validSecret
        });
        assert(resA5.status === 200, '1.5: Valid secret via x-api-key compatibility header accepted (200 OK)');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 2: ENDPOINT ALIAS COMPATIBILITY (/import-base)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 2] Endpoint Alias Compatibility');

        // 2.1: /api/timetable/import-base works identically
        const resAlias = await postImport(basePackage, {}, '/api/timetable/import-base');
        assert(resAlias.status === 200, '2.1: /api/timetable/import-base alias returns 200 OK');
        assert(resAlias.data?.success === true, '2.1b: Alias response reports success: true');

        // 2.2: /api/import-base works identically (dual mounting)
        const resAlias2 = await postImport(basePackage, {}, '/api/import-base');
        assert(resAlias2.status === 200, '2.2: /api/import-base dual-mounted route returns 200 OK');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 3: PAYLOAD SHAPE COMPATIBILITY (slots vs timetable)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 3] Payload Normalization');

        // 3.1: Backward compatibility: "timetable" array accepted and normalized
        const timetablePayload = {
            packageId: "FATGS_ODD_COMPAT_1",
            academicYear: "2026-2027",
            semesterType: "Odd",
            timetable: baseValidSlots
        };
        const resCompat = await postImport(timetablePayload);
        assert(resCompat.status === 200, '3.1: Backward compatible "timetable" field accepted and normalized');
        assert(resCompat.data?.importedSlots === 4, '3.1b: Response returns correct importedSlots count');

        // 3.2: Direct JSON array payload accepted
        const resDirect = await postImport(baseValidSlots);
        assert(resDirect.status === 200, '3.2: Direct JSON array payload accepted');

        // 3.3: Malformed payload rejected
        const resBad = await postImport({ nonSlotKey: 123 });
        assert(resBad.status === 400, '3.3: Malformed payload rejected with 400 Bad Request');

        // 3.4: Empty array rejected
        const resEmpty = await postImport({ packageId: "P1", academicYear: "2026-27", semesterType: "Odd", slots: [] });
        assert(resEmpty.status === 400, '3.4: Empty slots array rejected with 400 Bad Request');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 4: PACKAGE-LEVEL VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 4] Package-Level Validation');

        // 4.1: Missing packageId
        const missingPkgId = { academicYear: "2026-2027", semesterType: "Odd", slots: baseValidSlots };
        const resPkgId = await postImport(missingPkgId);
        assert(resPkgId.status === 400, '4.1: Missing packageId rejected with 400');

        // 4.2: Missing academicYear
        const missingYear = { packageId: "P1", semesterType: "Odd", slots: baseValidSlots };
        const resYear = await postImport(missingYear);
        assert(resYear.status === 400, '4.2: Missing academicYear rejected with 400');

        // 4.3: Missing semesterType
        const missingSem = { packageId: "P1", academicYear: "2026-2027", slots: baseValidSlots };
        const resSem = await postImport(missingSem);
        assert(resSem.status === 400, '4.3: Missing semesterType rejected with 400');

        // 4.4: Invalid semesterType (e.g. "Summer")
        const invalidSem = { packageId: "P1", academicYear: "2026-2027", semesterType: "Summer", slots: baseValidSlots };
        const resInvSem = await postImport(invalidSem);
        assert(resInvSem.status === 400, '4.4: Invalid semesterType ("Summer") rejected with 400');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 5: M.TECH SECTION COMPATIBILITY & REGEX INTEGRITY
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 5] M.Tech Section Compatibility & Mapping');

        // 5.1: Unit test normalizeSectionName does NOT corrupt MT1 or MA1
        const normMT1 = normalizeSectionName('MT1');
        const normMA1 = normalizeSectionName('MA1');
        assert(normMT1 === 'MTECH-CSE', '5.1: normalizeSectionName("MT1") maps to MTECH-CSE (not MT)');
        assert(normMA1 === 'MTECH-AI', '5.2: normalizeSectionName("MA1") maps to MTECH-AI (not MA)');

        // 5.2: B.Tech sections still correctly strip digits (e.g. CS2 -> CS)
        const normCS2 = normalizeSectionName('CS2');
        assert(normCS2 === 'CS', '5.3: normalizeSectionName("CS2") correctly maps to CS');

        // 5.3: Import slot with section "MT1" resolves to Y1_S1_MTECH-CSE
        const mtechCseSlot = {
            section: "MT1",
            year: 1,
            semester: 1,
            day: "Tuesday",
            start: "09:00",
            end: "10:00",
            subjectCode: "CS-611",
            faculty: "KD",
            room: "B4",
            isLab: false,
            duration: 1,
            sessionId: "MTECH_CSE_KD_CS611_TUE_0900"
        };
        const mtechAiSlot = {
            section: "MA1",
            year: 1,
            semester: 1,
            day: "Tuesday",
            start: "10:00",
            end: "11:00",
            subjectCode: "CS-631",
            faculty: "NC",
            room: "B4",
            isLab: false,
            duration: 1,
            sessionId: "MTECH_AI_NC_CS631_TUE_1000"
        };

        const mtechPkg = {
            packageId: "FATGS_MTECH_2026",
            academicYear: "2026-2027",
            semesterType: "Odd",
            slots: [mtechCseSlot, mtechAiSlot]
        };
        const resMtech = await postImport(mtechPkg);
        assert(resMtech.status === 200, '5.4: M.Tech import with MT1 and MA1 succeeds (200 OK)');

        // Verify section ObjectIds in MongoDB
        const dbMtechSlots = await TimetableSlot.find({ week: 'base' }).populate('classSection').populate('subject').lean();
        const cseSlot = dbMtechSlots.find(s => s.sessionId === 'MTECH_CSE_KD_CS611_TUE_0900' || (s.subject && s.subject.subjectCode === 'CS-611'));
        const aiSlot = dbMtechSlots.find(s => s.sessionId === 'MTECH_AI_NC_CS631_TUE_1000' || (s.subject && s.subject.subjectCode === 'CS-631'));
        assert(cseSlot?.classSection?.sectionId === 'Y1_S1_MTECH-CSE', '5.5: MT1 resolved to sectionId Y1_S1_MTECH-CSE');
        assert(aiSlot?.classSection?.sectionId === 'Y1_S1_MTECH-AI', '5.6: MA1 resolved to sectionId Y1_S1_MTECH-AI');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 6: ODD / EVEN SEMESTER ISOLATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 6] Odd / Even Semester Isolation');

        // 6.1: Package is Odd, but contains an Even semester slot (e.g. sem 4) -> REJECT
        const oddPkgWithEvenSlot = {
            packageId: "ODD_EVEN_CROSS_1",
            academicYear: "2026-2027",
            semesterType: "Odd",
            slots: [
                {
                    section: "CS",
                    year: 2,
                    semester: 4, // Even semester in Odd package!
                    day: "Monday",
                    start: "09:00",
                    end: "10:00",
                    subjectCode: "CS-212",
                    faculty: "RK",
                    room: "G5"
                }
            ]
        };
        const resCross1 = await postImport(oddPkgWithEvenSlot);
        assert(resCross1.status === 422, '6.1: Even semester slot in Odd package rejected with 422');

        // 6.2: Package is Even, but contains an Odd semester slot (e.g. sem 3) -> REJECT
        const evenPkgWithOddSlot = {
            packageId: "ODD_EVEN_CROSS_2",
            academicYear: "2026-2027",
            semesterType: "Even",
            slots: [
                {
                    section: "CS",
                    year: 2,
                    semester: 3, // Odd semester in Even package!
                    day: "Monday",
                    start: "09:00",
                    end: "10:00",
                    subjectCode: "CS-212",
                    faculty: "RK",
                    room: "G5"
                }
            ]
        };
        const resCross2 = await postImport(evenPkgWithOddSlot);
        assert(resCross2.status === 422, '6.2: Odd semester slot in Even package rejected with 422');

        // 6.3: Package is Even, and unresolvable Even semester section does not exist in TT_TRACKER -> REJECT cleanly
        const evenPkg = {
            packageId: "EVEN_SEM_TEST_3",
            academicYear: "2026-2027",
            semesterType: "Even",
            slots: [
                {
                    section: "UNKNOWN_EVEN_SEC", // section that does not exist in TT_TRACKER
                    year: 2,
                    semester: 4,
                    day: "Monday",
                    start: "09:00",
                    end: "10:00",
                    subjectCode: "CS-212",
                    faculty: "RK",
                    room: "G5"
                }
            ]
        };
        const resEvenMissing = await postImport(evenPkg);
        assert(resEvenMissing.status === 422, '6.3: Even import rejected because unresolvable Even section does not exist in TT_TRACKER');
        assert(resEvenMissing.data?.error?.includes('Even semester'), '6.3b: Error message specifies Even semester registry limitation');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 7: REFERENCE VALIDATION (FACULTY, ROOM, SUBJECT, TIME)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 7] Reference Validation');

        // 7.1: Unknown faculty
        const badFacPkg = JSON.parse(JSON.stringify(basePackage));
        badFacPkg.slots[0].faculty = 'UNKNOWN_PROF_XYZ';
        const resBadFac = await postImport(badFacPkg);
        assert(resBadFac.status === 422, '7.1: Unknown faculty rejected with 422');

        // 7.2: Unknown room
        const badRoomPkg = JSON.parse(JSON.stringify(basePackage));
        badRoomPkg.slots[0].room = 'NON_EXISTENT_HALL_999';
        const resBadRoom = await postImport(badRoomPkg);
        assert(resBadRoom.status === 422, '7.2: Unknown room rejected with 422');

        // 7.3: Unknown subject
        const badSubPkg = JSON.parse(JSON.stringify(basePackage));
        badSubPkg.slots[0].subjectCode = 'FAKE-999';
        const resBadSub = await postImport(badSubPkg);
        assert(resBadSub.status === 422, '7.3: Unknown subject code rejected with 422');

        // 7.4: Invalid day
        const badDayPkg = JSON.parse(JSON.stringify(basePackage));
        badDayPkg.slots[0].day = 'Funday';
        const resBadDay = await postImport(badDayPkg);
        assert(resBadDay.status === 422, '7.4: Invalid day rejected with 422');

        // 7.5: Invalid time range (end <= start)
        const badTimePkg = JSON.parse(JSON.stringify(basePackage));
        badTimePkg.slots[0].start = '11:00';
        badTimePkg.slots[0].end = '10:00';
        const resBadTime = await postImport(badTimePkg);
        assert(resBadTime.status === 422, '7.5: End time before start time rejected with 422');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 8: DUPLICATE & CONFLICT VALIDATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 8] Conflict Validation');

        // 8.1: Exact duplicate slot in package
        const dupPkg = JSON.parse(JSON.stringify(basePackage));
        dupPkg.slots.push({ ...basePackage.slots[0] });
        const resDup = await postImport(dupPkg);
        assert(resDup.status === 422, '8.1: Duplicate slot in package rejected with 422');

        // 8.2: Faculty conflict in package
        const facConfPkg = JSON.parse(JSON.stringify(basePackage));
        facConfPkg.slots.push({
            section: "CD",
            year: 2,
            semester: 3,
            day: "Monday",
            start: "09:00",
            end: "10:00",
            subjectCode: "CS-214",
            faculty: "RK", // RK already booked at 09:00
            room: "B4",
            sessionId: "CONFLICT_RK_SESS"
        });
        const resFacConf = await postImport(facConfPkg);
        assert(resFacConf.status === 422, '8.2: Faculty conflict rejected with 422');

        // 8.3: Room conflict in package
        const roomConfPkg = JSON.parse(JSON.stringify(basePackage));
        roomConfPkg.slots.push({
            section: "CD",
            year: 2,
            semester: 3,
            day: "Monday",
            start: "09:00",
            end: "10:00",
            subjectCode: "CS-214",
            faculty: "AKM",
            room: "G5", // G5 already booked at 09:00
            sessionId: "CONFLICT_G5_SESS"
        });
        const resRoomConf = await postImport(roomConfPkg);
        assert(resRoomConf.status === 422, '8.3: Room conflict rejected with 422');

        // 8.4: Section concurrency conflict
        const secConfPkg = JSON.parse(JSON.stringify(basePackage));
        secConfPkg.slots.push({
            section: "CS",
            year: 2,
            semester: 3,
            day: "Monday",
            start: "09:00",
            end: "10:00",
            subjectCode: "CS-213",
            faculty: "AKM",
            room: "B4",
            sessionId: "CONFLICT_CS_SESS"
        });
        const resSecConf = await postImport(secConfPkg);
        assert(resSecConf.status === 422, '8.4: Section conflict rejected with 422');

        // 8.5: Parallel G1 and G2 labs in separate rooms accepted
        const parallelRes = await postImport(basePackage);
        assert(parallelRes.status === 200, '8.5: Parallel G1 & G2 labs in separate rooms accepted');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 9: ATOMICITY GUARANTEE
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 9] Atomicity Guarantee');

        // Establish known state
        await postImport(basePackage);
        const slotsBefore = await TimetableSlot.find({ week: 'base' }).lean();
        const countBefore = slotsBefore.length;
        const idsBefore = slotsBefore.map(s => s._id.toString()).sort();

        // Attempt package with 1 poison slot
        const poisonPkg = JSON.parse(JSON.stringify(basePackage));
        poisonPkg.slots.push({
            section: "CS",
            year: 2,
            semester: 3,
            day: "Monday",
            start: "14:00",
            end: "15:00",
            subjectCode: "CS-212",
            faculty: "POISON_PROF_INVALID",
            room: "G5"
        });
        const resPoison = await postImport(poisonPkg);
        assert(resPoison.status === 422, '9.1: Package with single invalid slot rejected');

        const slotsAfter = await TimetableSlot.find({ week: 'base' }).lean();
        const countAfter = slotsAfter.length;
        const idsAfter = slotsAfter.map(s => s._id.toString()).sort();

        assert(countBefore === countAfter, `9.2: Database slot count identical after abort (${countBefore} === ${countAfter})`);
        assert(JSON.stringify(idsBefore) === JSON.stringify(idsAfter), '9.3: Original MongoDB ObjectIds untouched');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 10: ATOMIC REPLACEMENT, OVERRIDES, & HYDRATION
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 10] Replacement, Overrides & Immediate Activation');

        // Create a distinct new timetable package
        const freshPackage = {
            packageId: "FRESH_SEM_REPLACEMENT_2026",
            academicYear: "2026-2027",
            semesterType: "Odd",
            slots: [
                {
                    section: "CS",
                    year: 2,
                    semester: 3,
                    day: "Wednesday",
                    start: "10:00",
                    end: "11:00",
                    subjectCode: "CS-214",
                    faculty: "DPM",
                    room: "B4",
                    isLab: false,
                    duration: 1,
                    sessionId: "FRESH_DPM_CS214_WED_1000"
                }
            ]
        };

        // Plant dummy ScheduleOverride on old slot
        const oldSlots = await TimetableSlot.find({ week: 'base' });
        const dummyFaculty = await Faculty.findOne({ facultyId: 'RK' });
        const dummySection = await ClassSection.findOne({ sectionId: 'Y2_S3_CS' });
        const dummySub = await Subject.findOne({ subjectCode: 'CS-212' });
        const dummyRoom = await Room.findOne({ roomNo: 'G5' });
        const dummyTime = await Time.findOne({ day: 'Monday', starting: '09:00', ending: '10:00' });

        await ScheduleOverride.create({
            weekKey: '2026-W38',
            originalSlot: oldSlots[0]._id,
            action: 'CANCEL',
            scope: 'CURRENT_WEEK',
            faculty: dummyFaculty._id,
            classSection: dummySection._id,
            subject: dummySub._id,
            room: dummyRoom._id,
            time: dummyTime._id,
            sessionId: 'OLD_STALE_OVERRIDE_TO_PURGE',
            status: 'ACTIVE'
        });

        const activeOverridesBefore = await ScheduleOverride.countDocuments({ status: 'ACTIVE' });
        assert(activeOverridesBefore >= 1, '10.1: Stale override exists before import');

        // Execute import
        const resFresh = await postImport(freshPackage);
        assert(resFresh.status === 200, '10.2: Fresh package import succeeds');

        // Verify MongoDB replacement
        const newDbSlots = await TimetableSlot.find({ week: 'base' }).populate('faculty subject').lean();
        assert(newDbSlots.length === 1, '10.3: Old base slots completely replaced by new slot');
        assert(newDbSlots[0].subject.subjectCode === 'CS-214', '10.4: New slot subject CS-214 active in MongoDB');

        // Verify stale overrides purged
        const activeOverridesAfter = await ScheduleOverride.countDocuments({ status: 'ACTIVE' });
        assert(activeOverridesAfter === 0, '10.5: Stale overrides purged during base replacement');

        // Verify immediate in-memory hydration
        const facultyGrid = registry.getRepresentation('FACULTY', 'DPM', 'current');
        const wedDay = Array.isArray(facultyGrid) ? facultyGrid.find(d => d.day === 'Wednesday') : null;
        const activeWedSlot = wedDay?.slots?.find(s => s.occupied && s.data?.subjectCode === 'CS-214');
        assert(activeWedSlot !== undefined, '10.6: In-memory Registry immediately reflects new timetable for DPM');

        // Verify API endpoint returns new timetable
        const apiRes = await fetch(`${baseUrl}/api/timetable/grid?type=FACULTY&id=DPM&week=current`);
        const apiJson = await apiRes.json();
        const apiWed = Array.isArray(apiJson?.grid) ? apiJson.grid.find(d => d.day === 'Wednesday') : null;
        const apiCell = apiWed?.slots?.find(s => s.occupied && s.data?.subjectCode === 'CS-214');
        assert(apiCell !== undefined, '10.7: GET /api/timetable/grid returns newly imported slot immediately');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 11: RESTART PERSISTENCE & IDEMPOTENCY
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 11] Restart Persistence & Idempotency');

        // 11.1: Clear memory and rehydrate as if server restarted
        registry.clear();
        assert(registry.getEntityIds('FACULTY').length === 0, '11.1: Memory cleared completely');
        await hydrate();
        const rehydratedFac = registry.getEntityIds('FACULTY');
        assert(rehydratedFac.includes('DPM'), '11.2: Hydration from MongoDB restores newly imported timetable across simulated restart');

        // ════════════════════════════════════════════════════════════
        // TEST SUITE 12: ACADEMIC MASTER DATA SYNCHRONIZATION (P1-P6, FACULTY, SECTIONS, SUBJECTS)
        // ════════════════════════════════════════════════════════════
        console.log('\n>>> [TEST SUITE 12] Academic Master Data Synchronization (P1..P6, Faculty, Sections, Subjects)');

        const masterDataPackage = {
            packageId: "FATGS_MASTER_SYNC_TEST_2026",
            academicYear: "2026-2027",
            semesterType: "Odd",
            rooms: [
                { roomNo: "P1", labOrClass: "Lab", building: "DoCSE Block A Top Floor" },
                { roomNo: "P2", labOrClass: "Lab", building: "DoCSE Block A Top Floor" },
                { roomNo: "P3", labOrClass: "Lab", building: "DoCSE Block A Top Floor" },
                { roomNo: "P4", labOrClass: "Lab", building: "DoCSE Block A Top Floor" },
                { roomNo: "P5", labOrClass: "Lab", building: "DoCSE Block A Top Floor" },
                { roomNo: "P6", labOrClass: "Lab", building: "DoCSE Block A Top Floor" }
            ],
            faculties: [
                { facultyId: "NEW_FAC_1", name: "Dr Alpha Beta" },
                { facultyId: "NEW_FAC_2", name: "Dr Gamma Delta" }
            ],
            subjects: [
                { subjectCode: "CS-901", name: "Advanced Distributed Systems" },
                { subjectCode: "CS-902", name: "Neural Information Processing" }
            ],
            sections: [
                "MT1",
                "MA1",
                "CS5"
            ],
            times: [
                { day: "Thursday", start: "14:00", end: "16:00" }
            ],
            slots: [
                {
                    section: "MT1",
                    year: 1,
                    semester: 1,
                    day: "Thursday",
                    start: "14:00",
                    end: "16:00",
                    subjectCode: "CS-901",
                    faculty: "NEW_FAC_1",
                    room: "P6",
                    isLab: true,
                    duration: 2,
                    group: "G1",
                    sessionId: "PKG_P6_LAB_SESSION_G1"
                },
                {
                    section: "MA1",
                    year: 1,
                    semester: 1,
                    day: "Thursday",
                    start: "14:00",
                    end: "16:00",
                    subjectCode: "CS-902",
                    faculty: "NEW_FAC_2",
                    room: "P1",
                    isLab: true,
                    duration: 2,
                    group: "G2",
                    sessionId: "PKG_P1_LAB_SESSION_G2"
                }
            ]
        };

        // 12.1: Import package containing full master data & P6 slot
        const resMaster = await postImport(masterDataPackage);
        assert(resMaster.status === 200, '12.1: Package with master data and P6 lab slot accepted with 200 OK');

        // 12.2: Verify Room P6 synchronized into MongoDB
        const p6Room = await Room.findOne({ roomNo: 'P6' });
        assert(p6Room !== null, '12.2: Room P6 successfully synchronized into MongoDB Room collection');
        assert(p6Room?.labOrClass === 'Lab', '12.3: Room P6 correctly classified as "Lab"');
        assert(p6Room?.building === 'DoCSE Block A Top Floor', '12.4: Room P6 building correctly set to "DoCSE Block A Top Floor"');

        // 12.5: Verify P1 through P6 all exist in MongoDB via generic mechanism
        const pRooms = await Room.find({ roomNo: { $in: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] } });
        assert(pRooms.length === 6, `12.5: All rooms P1 through P6 synchronized generically (${pRooms.length} of 6 present)`);

        // 12.6: Verify unknown room NOT in package is rejected
        const unknownRoomPkg = {
            ...masterDataPackage,
            packageId: "UNKNOWN_ROOM_REJECT_TEST",
            rooms: [
                { roomNo: "P6", labOrClass: "Lab", building: "DoCSE Block A Top Floor" }
            ],
            slots: [
                {
                    ...masterDataPackage.slots[0],
                    room: "ROOM_NOT_IN_PKG_OR_DB_999"
                }
            ]
        };
        const resUnknownRoom = await postImport(unknownRoomPkg);
        assert(resUnknownRoom.status === 422, '12.6: Unknown room NOT in package or DB rejected with 422');
        assert(resUnknownRoom.data?.error?.includes('ROOM_NOT_IN_PKG_OR_DB_999'), '12.6b: Error message names the unknown room');

        // 12.7: Verify Faculty synchronized into MongoDB
        const fac1 = await Faculty.findOne({ facultyId: 'NEW_FAC_1' });
        assert(fac1 !== null && fac1.name === 'Dr Alpha Beta', '12.7: Faculty NEW_FAC_1 synchronized into MongoDB');

        // 12.8: Verify Subject synchronized into MongoDB
        const sub1 = await Subject.findOne({ subjectCode: 'CS-901' });
        assert(sub1 !== null && sub1.name === 'Advanced Distributed Systems', '12.8: Subject CS-901 synchronized into MongoDB');

        // 12.9: Verify Sections synchronized and M.Tech CSE vs AI preserved
        const secMt = await ClassSection.findOne({ sectionId: 'Y1_S1_MTECH-CSE' });
        const secMa = await ClassSection.findOne({ sectionId: 'Y1_S1_MTECH-AI' });
        assert(secMt !== null, '12.9: M.Tech CSE section (MT1 -> Y1_S1_MTECH-CSE) synchronized into MongoDB');
        assert(secMa !== null, '12.10: M.Tech AI section (MA1 -> Y1_S1_MTECH-AI) synchronized into MongoDB');
        assert(secMt?._id.toString() !== secMa?._id.toString(), '12.11: M.Tech CSE and M.Tech AI remain distinct MongoDB documents');

        // 12.12: Verify TimetableSlot MongoDB references and preserved attributes
        const p6Slot = await TimetableSlot.findOne({ week: 'base', room: p6Room?._id })
            .populate('faculty classSection subject room time');
        assert(p6Slot !== null, '12.12: Base slot references MongoDB P6 room document');
        assert(p6Slot?.faculty?.facultyId === 'NEW_FAC_1', '12.13: Slot references MongoDB NEW_FAC_1 faculty document');
        assert(p6Slot?.subject?.subjectCode === 'CS-901', '12.14: Slot references MongoDB CS-901 subject document');
        assert(p6Slot?.classSection?.sectionId === 'Y1_S1_MTECH-CSE', '12.15: Slot references MongoDB MTECH-CSE section document');
        assert(p6Slot?.isLab === true, '12.16: isLab preserved as true');
        assert(p6Slot?.duration === 2, '12.17: duration preserved as 2');
        assert(p6Slot?.group === 'G1', '12.18: group preserved as G1');
        assert(p6Slot?.sessionId === 'PKG_P6_LAB_SESSION_G1', '12.19: sessionId preserved as PKG_P6_LAB_SESSION_G1');

        // 12.20: Idempotency check - Re-importing package does NOT create duplicates
        const roomCountBefore = await Room.countDocuments();
        const facCountBefore = await Faculty.countDocuments();
        const subCountBefore = await Subject.countDocuments();
        const secCountBefore = await ClassSection.countDocuments();
        const slotCountBefore = await TimetableSlot.countDocuments({ week: 'base' });

        const resReimport = await postImport(masterDataPackage);
        assert(resReimport.status === 200, '12.20: Re-importing identical master data package succeeds with 200');

        const roomCountAfter = await Room.countDocuments();
        const facCountAfter = await Faculty.countDocuments();
        const subCountAfter = await Subject.countDocuments();
        const secCountAfter = await ClassSection.countDocuments();
        const slotCountAfter = await TimetableSlot.countDocuments({ week: 'base' });

        assert(roomCountBefore === roomCountAfter, `12.21: Zero duplicate rooms created (${roomCountBefore} === ${roomCountAfter})`);
        assert(facCountBefore === facCountAfter, `12.22: Zero duplicate faculties created (${facCountBefore} === ${facCountAfter})`);
        assert(subCountBefore === subCountAfter, `12.23: Zero duplicate subjects created (${subCountBefore} === ${subCountAfter})`);
        assert(secCountBefore === secCountAfter, `12.24: Zero duplicate sections created (${secCountBefore} === ${secCountAfter})`);
        assert(slotCountBefore === slotCountAfter, `12.25: Base slot count identical after re-import (${slotCountBefore} === ${slotCountAfter})`);

        // 12.26: Immediate Registry and API access for P6 without restart
        const p6Grid = registry.getRepresentation('ROOM', 'P6', 'current');
        const thuDay = Array.isArray(p6Grid) ? p6Grid.find(d => d.day === 'Thursday') : null;
        const thuSlot = thuDay?.slots?.find(s => s.occupied && (s.data?.roomNo === 'P6' || s.data?.room === 'P6'));
        assert(thuSlot !== undefined, '12.26: Room P6 immediately visible in Registry without restart');

        const apiP6Res = await fetch(`${baseUrl}/api/timetable/grid?type=ROOM&id=P6&week=current`);
        const apiP6Json = await apiP6Res.json();
        const apiThuDay = Array.isArray(apiP6Json?.grid) ? apiP6Json.grid.find(d => d.day === 'Thursday') : null;
        const apiThuSlot = apiThuDay?.slots?.find(s => s.occupied && (s.data?.roomNo === 'P6' || s.data?.room === 'P6'));
        assert(apiThuSlot !== undefined, '12.27: GET /api/timetable/grid for Room P6 returns occupied slot immediately');

    } finally {
        server.close();
        console.log('\n[Cleanup] Test Express server closed.');
        try {
            await Faculty.deleteMany({ facultyId: { $in: ['NEW_FAC_1', 'NEW_FAC_2'] } });
            await Subject.deleteMany({ subjectCode: { $in: ['CS-901', 'CS-902'] } });
            console.log('[Cleanup] Test faculty and subject fixtures cleaned up from MongoDB.');
        } catch (cleanupErr) {
            console.warn('[Cleanup Warning] Could not clean up test fixtures:', cleanupErr.message);
        }
    }

    console.log('\n============================================================');
    console.log(`TOTAL IMPORT TESTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    if (failedTests > 0) {
        process.exit(1);
    }
}

runImportTestSuite().catch(err => {
    console.error('Fatal Import Test Suite Error:', err);
    process.exit(1);
});
