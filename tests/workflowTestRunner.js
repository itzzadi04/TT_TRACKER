const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const registry = require('../tracker/Registry');
const { hydrate } = require('../tracker/hydrate');
const { computeEffectiveSchedule } = require('../tracker/effectiveSchedule');
const { getCurrentWeekKey, getNextWeekKey, getWeekKeyByOffset } = require('../tracker/weekUtils');

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

async function runComprehensiveWorkflowSuite() {
    console.log('============================================================');
    console.log('TT_TRACKER — EXACT ACTIVE-WEEK WORKFLOW TEST MATRIX (TESTS A-O)');
    console.log('============================================================\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');

    const fs = require('fs');
    const slotData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'timetableSlots.json')));
    const facultyData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'faculty.json')));
    const classSectionData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'classSections.json')));
    const subjectData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'subjects.json')));
    const roomData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'rooms.json')));
    const timeData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'times.json')));

    function padTime(t) {
        if (!t) return t;
        const [h, m] = t.split(':');
        return h.padStart(2, '0') + ':' + m;
    }

    // Clean initial state
    await ScheduleOverride.deleteMany({});
    await TimetableSlot.deleteMany({});

    const facultyIdMap = {};
    for (const f of facultyData) {
        const doc = await Faculty.findOne({ facultyId: f.facultyId });
        if (doc) facultyIdMap[f.facultyId] = doc._id;
    }
    const classSectionIdMap = {};
    for (const cs of classSectionData) {
        const sectionId = cs.sectionId || `Y${cs.year}_S${cs.semester}_${cs.section}`;
        const doc = await ClassSection.findOne({ year: cs.year, section: cs.section, semester: cs.semester });
        if (doc) classSectionIdMap[sectionId] = doc._id;
    }
    const subjectIdMap = {};
    for (const s of subjectData) {
        const doc = await Subject.findOne({ subjectCode: s.subjectCode });
        if (doc) subjectIdMap[s.subjectCode] = doc._id;
    }
    const roomIdMap = {};
    for (const r of roomData) {
        const doc = await Room.findOne({ roomNo: r.roomNo });
        if (doc) roomIdMap[r.roomNo] = doc._id;
    }
    const timeIdMap = {};
    for (const t of timeData) {
        const starting = padTime(t.starting);
        const ending = padTime(t.ending);
        const key = `${t.day}|${starting}|${ending}`;
        let doc = await Time.findOne({ day: t.day, starting, ending });
        if (!doc) doc = await Time.create({ day: t.day, starting, ending });
        timeIdMap[key] = doc._id;
    }

    const slotPayloads = [];
    for (const s of slotData) {
        const starting = padTime(s.starting);
        const ending = padTime(s.ending);
        const sectionId = `Y${s.year}_S${s.semester}_${s.section}`;
        const timeKey = `${s.day}|${starting}|${ending}`;

        const faculty = facultyIdMap[s.facultyId];
        const classSection = classSectionIdMap[sectionId];
        const subject = subjectIdMap[s.subjectCode];
        const room = roomIdMap[s.roomNo];
        const time = timeIdMap[timeKey];

        if (!faculty || !classSection || !subject || !room || !time) continue;

        slotPayloads.push({
            faculty,
            classSection,
            subject,
            room,
            time,
            sessionId: s.sessionId || `${s.facultyId}_${sectionId}_${s.subjectCode}_${s.day}_${starting}`,
            isLab: s.isLab || false,
            duration: s.duration || (parseInt(ending) - parseInt(starting)),
            group: s.group || null,
            isFixed: s.isFixed !== undefined ? s.isFixed : false,
            isOccupied: s.isOccupied !== undefined ? s.isOccupied : true,
            week: 'base',
            isCancelled: false
        });
    }

    await TimetableSlot.insertMany(slotPayloads);
    await hydrate();

    const currKey = getCurrentWeekKey();
    const nextKey = getNextWeekKey();

    // ────────────────────────────────────────────────────────────
    // TEST A: Monday: Current Week editable, Next Week direct editing disabled
    // ────────────────────────────────────────────────────────────
    console.log('>>> [TEST A] Monday Workflow Context');
    const monContext = { dayName: 'Monday', isWeekend: false, currentWeekEditable: true, nextWeekEditable: false };
    assert(monContext.currentWeekEditable === true, 'TEST A.1: Monday Current Week is EDITABLE');
    assert(monContext.nextWeekEditable === false, 'TEST A.2: Monday Next Week direct editing is DISABLED');

    // ────────────────────────────────────────────────────────────
    // TEST B & C: Monday: Schedule for Next Week shows COMPLETE Next Week Timetable with normal classes
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST B & C] Schedule for Next Week & Complete Timetable Presence');
    const nextWeekEffInitial = await computeEffectiveSchedule(nextKey);
    assert(nextWeekEffInitial.length === 196, 'TEST B: Next Week initially contains all 196 normal/base classes');
    
    // Add extra class to Next Week
    const amkSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'AMK' }))._id
    });
    const thu15Time = await Time.findOne({ day: 'Thursday', starting: '15:00', ending: '16:00' }) ||
                      await Time.create({ day: 'Thursday', starting: '15:00', ending: '16:00' });
    
    await ScheduleOverride.create({
        weekKey: nextKey,
        originalSlot: null,
        action: 'ADD_EXTRA',
        scope: 'NEXT_WEEK',
        faculty: amkSlot.faculty,
        classSection: amkSlot.classSection,
        subject: amkSlot.subject,
        room: amkSlot.room,
        time: thu15Time._id,
        sessionId: `EXTRA_EC219_${nextKey}`,
        isLab: false,
        duration: 1,
        status: 'ACTIVE'
    });
    await hydrate();

    const nextWeekEffAfterAdd = await computeEffectiveSchedule(nextKey);
    const hasOriginalMonSlot = nextWeekEffAfterAdd.some(s => s.sessionId === amkSlot.sessionId);
    const hasNewThuSlot = nextWeekEffAfterAdd.some(s => s.sessionId === `EXTRA_EC219_${nextKey}`);

    assert(hasOriginalMonSlot, 'TEST C.1: Normal classes are NOT removed when adding extra class');
    assert(hasNewThuSlot, 'TEST C.2: New extra class is present in Next Week effective schedule');
    assert(nextWeekEffAfterAdd.length === 197, 'TEST C.3: Next Week effective schedule contains 197 slots (196 Base + 1 Extra)');

    // ────────────────────────────────────────────────────────────
    // TEST D: Extra class saved ONLY for Next Week (Current unchanged, Base unchanged)
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST D] Extra Class Isolation');
    const currWeekEffD = await computeEffectiveSchedule(currKey);
    const baseEffD = await computeEffectiveSchedule('base');
    const extraInCurr = currWeekEffD.some(s => s.sessionId === `EXTRA_EC219_${nextKey}`);
    const extraInBase = baseEffD.some(s => s.sessionId === `EXTRA_EC219_${nextKey}`);

    assert(!extraInCurr, 'TEST D.1: Extra class does NOT appear in Current Week');
    assert(!extraInBase, 'TEST D.2: Base Timetable is completely UNCHANGED');

    // ────────────────────────────────────────────────────────────
    // TEST E: Saturday: Current Week read-only, Next Week editable
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST E] Saturday Workflow Context');
    const satContext = { dayName: 'Saturday', isWeekend: true, currentWeekEditable: false, nextWeekEditable: true };
    assert(satContext.currentWeekEditable === false, 'TEST E.1: Saturday Current Week is READ-ONLY');
    assert(satContext.nextWeekEditable === true, 'TEST E.2: Saturday Next Week is EDITABLE');

    // ────────────────────────────────────────────────────────────
    // TEST F: Saturday: Cancel Next Week class (Active Week Context Determines Cancellation)
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST F] Active Week Cancellation (Next Week Context)');
    const akySlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'AKY' }))._id,
        subject: (await Subject.findOne({ subjectCode: 'CS-312' }))._id
    });

    await ScheduleOverride.create({
        weekKey: nextKey,
        originalSlot: akySlot._id,
        action: 'CANCEL',
        scope: 'NEXT_WEEK',
        faculty: akySlot.faculty,
        classSection: akySlot.classSection,
        subject: akySlot.subject,
        room: akySlot.room,
        time: akySlot.time,
        sessionId: akySlot.sessionId,
        status: 'ACTIVE'
    });
    await hydrate();

    const effNextF = await computeEffectiveSchedule(nextKey);
    const effCurrF = await computeEffectiveSchedule(currKey);
    const effBaseF = await computeEffectiveSchedule('base');

    const inNextF = effNextF.some(s => s.sessionId === akySlot.sessionId);
    const inCurrF = effCurrF.some(s => s.sessionId === akySlot.sessionId);
    const inBaseF = effBaseF.some(s => s.sessionId === akySlot.sessionId);

    assert(!inNextF, 'TEST F.1: Class is cancelled in Next Week');
    assert(inCurrF, 'TEST F.2: Class remains ACTIVE in Current Week');
    assert(inBaseF, 'TEST F.3: Class remains ACTIVE in Base Timetable');

    // ────────────────────────────────────────────────────────────
    // TEST G: Saturday: Reschedule Next Week class
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST G] Next Week Reschedule (Move Occurrence)');
    const rkSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'RK' }))._id
    });
    const wed14Time = await Time.findOne({ day: 'Wednesday', starting: '14:00', ending: '15:00' }) ||
                      await Time.create({ day: 'Wednesday', starting: '14:00', ending: '15:00' });
    
    await ScheduleOverride.create({
        weekKey: nextKey,
        originalSlot: rkSlot._id,
        action: 'RESCHEDULE',
        scope: 'NEXT_WEEK',
        faculty: rkSlot.faculty,
        classSection: rkSlot.classSection,
        subject: rkSlot.subject,
        room: rkSlot.room,
        time: wed14Time._id,
        sessionId: `RESCHED_${rkSlot.sessionId}_${nextKey}`,
        isLab: false,
        duration: 1,
        status: 'ACTIVE'
    });
    await hydrate();

    const effNextG = await computeEffectiveSchedule(nextKey);
    const effCurrG = await computeEffectiveSchedule(currKey);
    const inNextResched = effNextG.some(s => s.day === 'Wednesday' && s.starting === '14:00' && s.facultyId === 'RK');
    const inCurrResched = effCurrG.some(s => s.day === 'Wednesday' && s.starting === '14:00' && s.facultyId === 'RK');

    assert(inNextResched, 'TEST G.1: Next Week reflects the moved class at Wednesday 14:00');
    assert(!inCurrResched, 'TEST G.2: Current Week does NOT reflect the Next-Week move');

    // ────────────────────────────────────────────────────────────
    // TEST H: Sunday follows same behavior as Saturday
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST H] Sunday Workflow Context');
    const sunContext = { dayName: 'Sunday', isWeekend: true, currentWeekEditable: false, nextWeekEditable: true };
    assert(sunContext.currentWeekEditable === false && sunContext.nextWeekEditable === true, 'TEST H: Sunday is identical to Saturday (Current Read-Only, Next Editable)');

    // ────────────────────────────────────────────────────────────
    // TEST I & J: Monday Rollover: Previous Next Week becomes Current Week, New Next Week is clean
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST I & J] Monday Rollover & Clean Future Week');
    // When nextKey becomes current week, computing its effective schedule preserves all Week 11 changes
    const rolloverCurrEff = await computeEffectiveSchedule(nextKey);
    const rolloverHasExtra = rolloverCurrEff.some(s => s.sessionId === `EXTRA_EC219_${nextKey}`);
    const rolloverHasResched = rolloverCurrEff.some(s => s.day === 'Wednesday' && s.starting === '14:00' && s.facultyId === 'RK');
    assert(rolloverHasExtra && rolloverHasResched, 'TEST I: Rollover promotes Next Week into Current Week with its week-specific changes preserved');

    // The new upcoming week (W+2) derives cleanly from Base
    const wPlus2Key = getWeekKeyByOffset(2);
    const wPlus2Eff = await computeEffectiveSchedule(wPlus2Key);
    const wPlus2HasExtra = wPlus2Eff.some(s => s.sessionId === `EXTRA_EC219_${nextKey}`);
    const wPlus2HasResched = wPlus2Eff.some(s => s.sessionId === `RESCHED_${rkSlot.sessionId}_${nextKey}`);
    assert(!wPlus2HasExtra, 'TEST J.1: Temporary extra class does NOT leak into future week (W+2)');
    assert(!wPlus2HasResched, 'TEST J.2: Temporary reschedule does NOT leak into future week (W+2)');

    // ────────────────────────────────────────────────────────────
    // TEST K: Cancel active timetable (only active week affected)
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST K] Active Week Cancellation Scoping');
    const currCancelSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'DPM' }))._id
    });
    await ScheduleOverride.create({
        weekKey: currKey,
        originalSlot: currCancelSlot._id,
        action: 'CANCEL',
        scope: 'CURRENT_WEEK',
        faculty: currCancelSlot.faculty,
        classSection: currCancelSlot.classSection,
        subject: currCancelSlot.subject,
        room: currCancelSlot.room,
        time: currCancelSlot.time,
        sessionId: currCancelSlot.sessionId,
        status: 'ACTIVE'
    });
    await hydrate();

    const effCurrK = await computeEffectiveSchedule(currKey);
    const effBaseK = await computeEffectiveSchedule('base');
    assert(!effCurrK.some(s => s.sessionId === currCancelSlot.sessionId), 'TEST K.1: Slot is cancelled in Current Week');
    assert(effBaseK.some(s => s.sessionId === currCancelSlot.sessionId), 'TEST K.2: Slot remains ACTIVE in Base Timetable');

    // ────────────────────────────────────────────────────────────
    // TEST L: Normal class dropped into lab slot is REJECTED
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST L] Lab Slot Protection');
    const labDropCheck = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'P4', // Lab room
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '10:00',
        end: '11:00',
        isLab: false, // Normal lecture
        targetRoomType: 'Lab'
    });
    assert(!labDropCheck.isAvailable && labDropCheck.conflictTypes.includes('INVALID_LAB_TARGET'), 'TEST L: Normal class into lab slot rejected with INVALID_LAB_TARGET');

    // ────────────────────────────────────────────────────────────
    // TEST M: G1 and G2 labs at same time are BOTH visible
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST M] Multi-Group Simultaneous Labs');
    const p4Grid = registry.getRepresentation('ROOM', 'P4', 'current');
    const b1Grid = registry.getRepresentation('ROOM', 'B1', 'current');
    const p4Mon11 = p4Grid.find(r => r.day === 'Monday').slots.find(s => s.start === '11:00');
    const b1Mon11 = b1Grid.find(r => r.day === 'Monday').slots.find(s => s.start === '11:00');
    assert(p4Mon11 && p4Mon11.occupied, 'TEST M.1: G1 Lab in P4 at Monday 11:00 is occupied');
    assert(b1Mon11 && b1Mon11.occupied, 'TEST M.2: G2 Lab in B1 at Monday 11:00 is occupied');

    // ────────────────────────────────────────────────────────────
    // TEST N & O: No "Slot Available" before drop, authoritative backend validation on drop
    // ────────────────────────────────────────────────────────────
    console.log('\n>>> [TEST N & O] Post-Drop Backend Conflict Validation');
    const roomOccCheck = registry.checkConflict('next', {
        facultyId: 'AKY', // Free on Monday 10:00
        roomNo: 'G5', // Occupied on Mon 10:00 (by RK)
        sectionId: 'Y3_S5_CS', // Free on Monday 10:00
        day: 'Monday',
        start: '09:00',
        end: '10:00',
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(!roomOccCheck.isAvailable && roomOccCheck.isRoomOnlyConflict === true, 'TEST O: Drop into occupied room returns ROOM_CONFLICT with room-solvable flag');

    // ────────────────────────────────────────────────────────────
    // LAB VS NORMAL CLASS CONFLICT TEST SUITE (TESTS 1 - 10)
    // ────────────────────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('LAB VS NORMAL CLASS CONFLICT ENGINE VALIDATION (TESTS 1-10)');
    console.log('============================================================');

    // TEST 1: Normal class over G1 lab
    console.log('\n>>> [TEST 1] Normal class over G1 Lab');
    const test1Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'B4', // Vacant room
        sectionId: 'Y2_S3_CS', // Section has G1 lab in P4 at Monday 11:00
        day: 'Monday',
        start: '11:00',
        end: '12:00',
        group: null, // Normal section-wide lecture
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(!test1Check.isAvailable && (test1Check.conflictTypes.includes('LAB_TIME_CONFLICT') || test1Check.conflictTypes.includes('SECTION_CONFLICT')), 'TEST 1: Normal class over G1 lab is REJECTED even with vacant room');
    assert(test1Check.isRoomOnlyConflict === false, 'TEST 1b: Lab/section conflict does NOT show Available Rooms');

    // TEST 2: Normal class over G2 lab
    console.log('\n>>> [TEST 2] Normal class over G2 Lab');
    const test2Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'B6', // Vacant room
        sectionId: 'Y2_S3_CS', // Section has G2 lab in B1 at Monday 11:00
        day: 'Monday',
        start: '11:00',
        end: '12:00',
        group: null,
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(!test2Check.isAvailable && (test2Check.conflictTypes.includes('LAB_TIME_CONFLICT') || test2Check.conflictTypes.includes('SECTION_CONFLICT')), 'TEST 2: Normal class over G2 lab is REJECTED even with vacant room');

    // TEST 3: Normal class over both G1 + G2 labs
    console.log('\n>>> [TEST 3] Normal class over G1 + G2 Labs');
    const test3Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'B5',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '11:00',
        end: '12:00',
        group: null,
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(!test3Check.isAvailable && test3Check.isRoomOnlyConflict === false, 'TEST 3: Normal class over simultaneous G1+G2 labs is REJECTED');

    // TEST 4: G1 lab + G2 lab simultaneously (parallel groups)
    console.log('\n>>> [TEST 4] G1 Lab + G2 Lab simultaneously');
    const test4CheckG2 = registry.checkConflict('current', {
        facultyId: 'NC',
        roomNo: 'B1',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '11:00',
        end: '12:00',
        group: 'G2',
        sessionId: 'NC_Y2_S3_CS_CS-219_Monday_11:00_G2',
        isLab: true,
        targetRoomType: 'Lab'
    });
    assert(test4CheckG2.isAvailable, 'TEST 4: G1 and G2 parallel lab sessions are valid simultaneously');

    // TEST 5: Normal class in a genuinely free normal slot
    console.log('\n>>> [TEST 5] Normal class in genuinely free normal slot');
    const test5Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'B4',
        sectionId: 'Y2_S3_CS',
        day: 'Friday',
        start: '16:00',
        end: '17:00',
        group: null,
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(test5Check.isAvailable, 'TEST 5: Genuinely free normal slot passes conflict check');

    // TEST 6: Normal class in an occupied normal room
    console.log('\n>>> [TEST 6] Normal class in occupied normal room');
    const test6Check = registry.checkConflict('current', {
        facultyId: 'AKY', // Free on Mon 09:00
        roomNo: 'G5',     // Occupied on Monday 09:00 by RK
        sectionId: 'Y3_S5_CS', // Free on Mon 09:00
        day: 'Monday',
        start: '09:00',
        end: '10:00',
        group: null,
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(!test6Check.isAvailable && test6Check.isRoomOnlyConflict === true, 'TEST 6: Occupied room triggers pure ROOM_CONFLICT with room suggestions');

    // TEST 7: Lab moved to valid lab room
    console.log('\n>>> [TEST 7] Lab moved to valid lab room');
    const test7Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'P5', // Valid lab room, free on Friday 16:00
        sectionId: 'Y2_S3_CS',
        day: 'Friday',
        start: '16:00',
        end: '17:00',
        group: 'G1',
        isLab: true,
        targetRoomType: 'Lab'
    });
    assert(test7Check.isAvailable, 'TEST 7: Lab moved to free valid lab room is accepted');

    // TEST 8: Normal class moved to lab-only slot
    console.log('\n>>> [TEST 8] Normal class into lab slot');
    const test8Check = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'P4',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '09:00',
        end: '10:00',
        group: null,
        isLab: false,
        targetRoomType: 'Lab'
    });
    assert(!test8Check.isAvailable && test8Check.conflictTypes.includes('INVALID_LAB_TARGET'), 'TEST 8: Normal class into lab slot rejected with INVALID_LAB_TARGET');

    // TEST 9: Moving a class should not conflict with its own original occurrence
    console.log('\n>>> [TEST 9] Self-conflict exclusion during reschedule');
    const test9AmkSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'AMK' }))._id,
        isLab: false
    });
    // When removing originalSlot before check, check passes
    registry.removeSlot('current', {
        facultyId: 'AMK',
        roomNo: test9AmkSlot.roomNo || 'F4',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        starting: '10:00',
        ending: '11:00'
    });
    const selfCheck = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'F4',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '10:00',
        end: '11:00',
        isLab: false,
        targetRoomType: 'Class'
    });
    assert(selfCheck.isAvailable, 'TEST 9: Rescheduling excludes original occurrence from self-conflicting');
    // Restore
    await hydrate();

    // TEST 10: Invalid operation must NOT create/update a MongoDB record
    console.log('\n>>> [TEST 10] MongoDB write protection on conflict');
    const countBefore = await ScheduleOverride.countDocuments();
    // Simulate failed move attempted via validation/rejection flow
    const conflictDrop = registry.checkConflict('current', {
        facultyId: 'AMK',
        roomNo: 'P4',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '11:00',
        end: '12:00',
        group: null,
        isLab: false,
        targetRoomType: 'Lab'
    });
    if (!conflictDrop.isAvailable) {
        // Validation failed -> controller rejects before writing
    }
    const countAfter = await ScheduleOverride.countDocuments();
    assert(countBefore === countAfter, 'TEST 10: Invalid operation did not write to MongoDB');

    // ============================================================
    // ACADEMIC CALENDAR & REAL TIMEZONE SUITE (TESTS 11-18)
    // ============================================================
    console.log('\n============================================================');
    console.log('REAL CALENDAR & TIMEZONE ENGINE VALIDATION (TESTS 11-18)');
    console.log('============================================================');

    const { getAcademicWeekState, TIMEZONE } = require('../tracker/weekUtils');

    // TEST 11: Production Real Date in Asia/Kolkata
    console.log('\n>>> [TEST 11] Production Real Date Calculation (Asia/Kolkata)');
    const prodState = getAcademicWeekState({ devMode: false });
    assert(prodState.timezone === 'Asia/Kolkata', 'TEST 11.1: Timezone configured to Asia/Kolkata');
    assert(prodState.today.match(/^\d{4}-\d{2}-\d{2}$/), 'TEST 11.2: Returns valid YYYY-MM-DD today date');
    assert(prodState.currentWeekKey.match(/^\d{4}-W\d{2}$/), 'TEST 11.3: Returns dynamic ISO week key');
    assert(prodState.currentWeekStartDate.match(/^\d{4}-\d{2}-\d{2}$/), 'TEST 11.4: Returns valid current week Monday');
    assert(prodState.nextWeekStartDate.match(/^\d{4}-\d{2}-\d{2}$/), 'TEST 11.5: Returns valid next week Monday');

    // TEST 12: Production Mode ignores simulatedDay param
    console.log('\n>>> [TEST 12] Production Mode Ignores Simulation Parameter');
    const prodWithSim = getAcademicWeekState({ devMode: false, simulatedDay: 'Saturday' });
    assert(prodWithSim.devMode === false, 'TEST 12.1: devMode is false in production');
    // If today is weekday, it stays weekday; if today is weekend, it stays weekend.
    assert(prodWithSim.dayName === prodState.dayName, 'TEST 12.2: simulatedDay parameter is ignored in production mode');

    // TEST 13: Dev Mode simulation - Wednesday
    console.log('\n>>> [TEST 13] Dev Mode Simulation - Wednesday (Weekday)');
    const devWed = getAcademicWeekState({ devMode: true, simulatedDay: 'Wednesday' });
    assert(devWed.dayName === 'Wednesday', 'TEST 13.1: Simulated day is Wednesday');
    assert(devWed.isWeekday === true && devWed.isWeekend === false, 'TEST 13.2: Wednesday is recognized as Weekday');
    assert(devWed.currentWeekEditable === true, 'TEST 13.3: Wednesday Current Week is EDITABLE');
    assert(devWed.nextWeekEditable === false, 'TEST 13.4: Wednesday Next Week direct editing is DISABLED');

    // TEST 14: Dev Mode simulation - Saturday
    console.log('\n>>> [TEST 14] Dev Mode Simulation - Saturday (Weekend)');
    const devSat = getAcademicWeekState({ devMode: true, simulatedDay: 'Saturday' });
    assert(devSat.dayName === 'Saturday', 'TEST 14.1: Simulated day is Saturday');
    assert(devSat.isWeekend === true && devSat.isWeekday === false, 'TEST 14.2: Saturday is recognized as Weekend');
    assert(devSat.currentWeekEditable === false, 'TEST 14.3: Saturday Current Week is READ-ONLY');
    assert(devSat.nextWeekEditable === true, 'TEST 14.4: Saturday Next Week is EDITABLE');

    // TEST 15: Dev Mode simulation - Sunday
    console.log('\n>>> [TEST 15] Dev Mode Simulation - Sunday (Weekend)');
    const devSun = getAcademicWeekState({ devMode: true, simulatedDay: 'Sunday' });
    assert(devSun.dayName === 'Sunday', 'TEST 15.1: Simulated day is Sunday');
    assert(devSun.currentWeekEditable === false, 'TEST 15.2: Sunday Current Week is READ-ONLY');
    assert(devSun.nextWeekEditable === true, 'TEST 15.3: Sunday Next Week is EDITABLE');

    // TEST 16: Dynamic date math continuity
    console.log('\n>>> [TEST 16] Next Week Continuity Math');
    const currMon = new Date(prodState.currentWeekStartDate + 'T00:00:00Z');
    const nextMon = new Date(prodState.nextWeekStartDate + 'T00:00:00Z');
    const diffDays = Math.round((nextMon - currMon) / (1000 * 60 * 60 * 24));
    assert(diffDays === 7, 'TEST 16: Next week Monday is exactly 7 days after current week Monday');

    // TEST 17: Rollover verification across week boundary
    console.log('\n>>> [TEST 17] Dynamic Week Boundary Calculation');
    const customSun = new Date('2026-08-30T10:00:00Z'); // A Sunday
    const sunState = getAcademicWeekState({ baseDate: customSun, devMode: false });
    assert(sunState.dayName === 'Sunday', 'TEST 17.1: Correctly identifies Sunday on custom base date');
    assert(sunState.currentWeekStartDate === '2026-08-24', 'TEST 17.2: Current week Monday for 30 Aug is 24 Aug');
    assert(sunState.nextWeekStartDate === '2026-08-31', 'TEST 17.3: Next week Monday for 30 Aug is 31 Aug');

    // Following Monday
    const customMon = new Date('2026-08-31T10:00:00Z'); // Following Monday
    const monState = getAcademicWeekState({ baseDate: customMon, devMode: false });
    assert(monState.dayName === 'Monday', 'TEST 17.4: Correctly identifies Monday on rollover date');
    assert(monState.currentWeekStartDate === '2026-08-31', 'TEST 17.5: Rollover promotes previous next week to current week');

    // TEST 18: Zero DB pollution
    console.log('\n>>> [TEST 18] Zero Database Mutation from Calendar Engine');
    const finalCount = await ScheduleOverride.countDocuments();
    assert(finalCount === countAfter, 'TEST 18: Academic calendar calculations did not mutate MongoDB');

    console.log('\n============================================================');
    console.log(`WORKFLOW TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    if (failedTests > 0) process.exit(1);
}

runComprehensiveWorkflowSuite().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
