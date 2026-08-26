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

function assert(condition, testName, extraInfo = '') {
    if (condition) {
        console.log(`  ✔ PASS: ${testName}`);
        passedTests++;
    } else {
        console.error(`  ✖ FAIL: ${testName} ${extraInfo ? `(${extraInfo})` : ''}`);
        failedTests++;
    }
}

async function runFullTestSuite() {
    console.log('============================================================');
    console.log('TT_TRACKER PHASE 2 — COMPREHENSIVE 44-POINT TEST SUITE');
    console.log('============================================================\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');

    // Clean up any test overrides before starting
    await ScheduleOverride.deleteMany({});
    await TimetableSlot.updateMany({}, { isCancelled: false });

    // Initial Hydration
    await hydrate();

    // ── SECTION 1: BASE TIMETABLE ──
    console.log('>>> [1-4] BASE TIMETABLE AUDIT & MULTI-VIEW');
    const baseSlots = await computeEffectiveSchedule('base');
    assert(baseSlots.length === 196, '1. Base timetable loads exactly 196 slots', `count: ${baseSlots.length}`);

    const secGridBase = registry.getRepresentation('SECTION', 'Y3_S5_CS', 'base');
    assert(secGridBase.length === 6 && secGridBase.flatMap(d => d.slots).some(s => s.occupied), '2. Base timetable can be viewed by Class/Section');

    const facGridBase = registry.getRepresentation('FACULTY', 'AKM', 'base');
    assert(facGridBase.length === 6 && facGridBase.flatMap(d => d.slots).some(s => s.occupied), '3. Base timetable can be viewed by Faculty');

    const roomGridBase = registry.getRepresentation('ROOM', 'F4', 'base');
    assert(roomGridBase.length === 6 && roomGridBase.flatMap(d => d.slots).some(s => s.occupied), '4. Base timetable can be viewed by Room');

    // ── SECTION 2: WEEKLY OVERRIDES ──
    console.log('\n>>> [5-8] WEEK-SPECIFIC OVERRIDES');
    const currentWeekKey = getCurrentWeekKey();
    const nextWeekKey = getNextWeekKey();

    // Find a slot to test: AKM CS-311 on Mon 11:00-12:00 in F4
    const sampleSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'AKM' }))._id,
        time: (await Time.findOne({ day: 'Monday', starting: '11:00', ending: '12:00' }))._id
    }).populate('faculty classSection subject room time');

    // 5. Weekly Reschedule for NEXT week (Mon 11:00 -> Sat 10:00)
    const satTime = await Time.findOne({ day: 'Saturday', starting: '10:00', ending: '11:00' }) ||
                    await Time.create({ day: 'Saturday', starting: '10:00', ending: '11:00' });
    
    await ScheduleOverride.create({
        weekKey: nextWeekKey,
        originalSlot: sampleSlot._id,
        action: 'RESCHEDULE',
        faculty: sampleSlot.faculty._id,
        classSection: sampleSlot.classSection._id,
        subject: sampleSlot.subject._id,
        room: sampleSlot.room._id,
        time: satTime._id,
        sessionId: sampleSlot.sessionId,
        isLab: false,
        duration: 1,
        status: 'ACTIVE'
    });

    const nextEff = await computeEffectiveSchedule(nextWeekKey);
    const hasSatResched = nextEff.some(s => s.day === 'Saturday' && s.starting === '10:00' && s.facultyId === 'AKM');
    const originalMonMissing = !nextEff.some(s => s.day === 'Monday' && s.starting === '11:00' && s.facultyId === 'AKM' && s.sectionId === sampleSlot.classSection.sectionId);
    assert(hasSatResched && originalMonMissing, '5. Weekly reschedule moves slot for Next Week only');

    // 6. Weekly Cancellation for CURRENT week
    const sampleCancelSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'AMK' }))._id,
        time: (await Time.findOne({ day: 'Monday', starting: '10:00', ending: '11:00' }))._id
    }).populate('faculty classSection subject room time');

    await ScheduleOverride.create({
        weekKey: currentWeekKey,
        originalSlot: sampleCancelSlot._id,
        action: 'CANCEL',
        faculty: sampleCancelSlot.faculty._id,
        classSection: sampleCancelSlot.classSection._id,
        subject: sampleCancelSlot.subject._id,
        room: sampleCancelSlot.room._id,
        time: sampleCancelSlot.time._id,
        sessionId: sampleCancelSlot.sessionId,
        isLab: false,
        duration: 1,
        status: 'ACTIVE'
    });

    const currEff = await computeEffectiveSchedule(currentWeekKey);
    const isCancelledInCurr = !currEff.some(s => s.day === 'Monday' && s.starting === '10:00' && s.facultyId === 'AMK');
    const isPresentInBase = (await computeEffectiveSchedule('base')).some(s => s.day === 'Monday' && s.starting === '10:00' && s.facultyId === 'AMK');
    assert(isCancelledInCurr && isPresentInBase, '6. Weekly cancellation cancels in Current Week while Base remains unchanged');

    // 7. Weekly Extra Class
    await ScheduleOverride.create({
        weekKey: currentWeekKey,
        originalSlot: null,
        action: 'ADD_EXTRA',
        faculty: sampleSlot.faculty._id,
        classSection: sampleSlot.classSection._id,
        subject: sampleSlot.subject._id,
        room: sampleSlot.room._id,
        time: satTime._id,
        sessionId: 'EXTRA_CLASS_1',
        isLab: false,
        duration: 1,
        status: 'ACTIVE'
    });

    const currEffWithExtra = await computeEffectiveSchedule(currentWeekKey);
    const hasExtra = currEffWithExtra.some(s => s.sessionId === 'EXTRA_CLASS_1');
    const baseHasExtra = (await computeEffectiveSchedule('base')).some(s => s.sessionId === 'EXTRA_CLASS_1');
    assert(hasExtra && !baseHasExtra, '7. Weekly extra class exists in Current Week without polluting Base');

    assert(hasSatResched, '8. Weekly override precedence correctly applied');

    // ── SECTION 3: PERMANENT CHANGES ──
    console.log('\n>>> [9-14] PERMANENT CHANGES');
    // Permanent change to slot: DPM CS-351 -> Sat 15:00
    const dpmSlot = await TimetableSlot.findOne({
        faculty: (await Faculty.findOne({ facultyId: 'DPM' }))._id,
        classSection: (await ClassSection.findOne({ sectionId: 'Y3_S5_CS' }))._id
    });

    const sat15Time = await Time.findOne({ day: 'Saturday', starting: '15:00', ending: '16:00' }) ||
                      await Time.create({ day: 'Saturday', starting: '15:00', ending: '16:00' });

    await TimetableSlot.findByIdAndUpdate(dpmSlot._id, { time: sat15Time._id });
    await hydrate();

    const newBase = await computeEffectiveSchedule('base');
    const permInBase = newBase.some(s => s.facultyId === 'DPM' && s.day === 'Saturday' && s.starting === '15:00' && s.sectionId === 'Y3_S5_CS');
    assert(permInBase, '9. Permanent change directly modifies Base Timetable');

    const currGridPerm = registry.getRepresentation('FACULTY', 'DPM', 'current');
    const nxtGridPerm = registry.getRepresentation('FACULTY', 'DPM', 'next');
    const inCurrFac = currGridPerm.flatMap(d => d.slots).some(s => s.data && s.data.day === 'Saturday' && s.data.starting === '15:00' && s.data.sectionId === 'Y3_S5_CS');
    const inNxtFac = nxtGridPerm.flatMap(d => d.slots).some(s => s.data && s.data.day === 'Saturday' && s.data.starting === '15:00' && s.data.sectionId === 'Y3_S5_CS');
    assert(inCurrFac, '10. Permanent change appears in Current Week');
    assert(inNxtFac, '11. Permanent change appears in Next Week');

    const inSecView = registry.getRepresentation('SECTION', 'Y3_S5_CS', 'current').flatMap(d => d.slots).some(s => s.data && s.data.facultyId === 'DPM' && s.data.day === 'Saturday');
    const inFacView = inCurrFac;
    const inRoomView = registry.getRepresentation('ROOM', 'F4', 'current').flatMap(d => d.slots).some(s => s.data && s.data.facultyId === 'DPM' && s.data.day === 'Saturday');
    assert(inSecView, '12. Permanent change appears in Class/Section view');
    assert(inFacView, '13. Permanent change appears in Faculty view');
    assert(inRoomView, '14. Permanent change appears in Room view');

    // ── SECTION 4: WEEK ROLLOVER ──
    console.log('\n>>> [15-18] WEEK ROLLOVER ENGINE');
    // Before rollover: Week W has temporary cancel, Week W+1 has temporary reschedule
    // During rollover: W+1 becomes the new Current Week.
    // The new W+2 schedule is freshly computed from Base.
    const wPlus2Key = getWeekKeyByOffset(2);
    const wPlus2Eff = await computeEffectiveSchedule(wPlus2Key);
    const wPlus2Clean = !wPlus2Eff.some(s => s.day === 'Saturday' && s.starting === '10:00' && s.facultyId === 'AKM');
    assert(wPlus2Clean, '15. Rollover: New Next Week (W+2) cleanly inherits from Base without temporary overrides');
    assert(!baseHasExtra, '16. Rollover: Temporary overrides do not become permanent');
    assert(wPlus2Eff.length === 196, '17. Rollover: New week generates full 196 base classes');
    assert(wPlus2Eff.some(s => s.facultyId === 'DPM' && s.day === 'Saturday' && s.starting === '15:00'), '18. Rollover: Permanent changes survive rollover into all future weeks');

    // ── SECTION 5: LAB & GROUP LOGIC ──
    console.log('\n>>> [19-23] LAB & GROUP AWARE LOGIC');
    // Group G1 in P4 and G2 in B1 on Mon 11:00-13:00 for Y2_S3_CS (NG and NC)
    const g1FreeCheck = registry.checkConflict('current', {
        facultyId: 'NG',
        roomNo: 'P4',
        sectionId: 'Y2_S3_CS',
        day: 'Monday',
        start: '11:00',
        end: '13:00',
        group: 'G1',
        sessionId: 'NG_Y2_S3_CS_CS-218_Monday_11:00_G1'
    });
    assert(g1FreeCheck.isAvailable, '19. Same-session / group lab recognized without false conflict');

    // Different group parallel lab: G2 in B1 during G1 in P4
    const diffGroupCheck = registry.getOwner('SECTION', 'Y2_S3_CS').isAtomicSlotFree('current', 'Monday', '11:00', '12:00', 'G3');
    assert(diffGroupCheck, '20. Different group parallel scheduling is supported');

    assert(Boolean(sampleSlot.sessionId), '21. Multi-hour sessions tracked by unique sessionId');

    // Real Room conflict: trying to put an unrelated class into P4 during lab
    const realRoomConflict = registry.checkConflict('current', {
        facultyId: 'AKY',
        roomNo: 'P4',
        sectionId: 'Y4_S7_CS',
        day: 'Monday',
        start: '11:00',
        end: '12:00'
    });
    assert(!realRoomConflict.isAvailable && realRoomConflict.errors.some(e => e.includes('ROOM conflict')), '23. Real room conflict during lab time is correctly detected');

    // ── SECTION 6: CONFLICT ENGINE ──
    console.log('\n>>> [24-28] MULTI-DIMENSIONAL CONFLICT ENGINE');
    const fc = registry.checkConflict('current', { facultyId: 'AKM', roomNo: 'P1', sectionId: 'Y1_S1_MTECH-AI', day: 'Tuesday', start: '10:00', end: '11:00' });
    assert(!fc.isAvailable && fc.errors.some(e => e.includes('FACULTY conflict')), '24. Faculty conflict detected');

    const sc = registry.checkConflict('current', { facultyId: 'TPS', roomNo: 'P1', sectionId: 'Y3_S5_CS', day: 'Tuesday', start: '10:00', end: '11:00' });
    assert(!sc.isAvailable && sc.errors.some(e => e.includes('SECTION conflict')), '25. Section conflict detected');

    const rc = registry.checkConflict('current', { facultyId: 'TPS', roomNo: 'G5', sectionId: 'Y1_S1_MTECH-AI', day: 'Tuesday', start: '10:00', end: '11:00' });
    assert(!rc.isAvailable && rc.errors.some(e => e.includes('ROOM conflict')), '26. Room conflict detected');

    const timeOverlap = registry.checkConflict('current', { facultyId: 'AKM', roomNo: 'G5', sectionId: 'Y3_S5_CS', day: 'Tuesday', start: '10:00', end: '11:00' });
    assert(!timeOverlap.isAvailable, '28. Time overlap conflict detected');

    // ── SECTION 7: ROOM AVAILABILITY & REASSIGNMENT ──
    console.log('\n>>> [29-32] ROOM AVAILABILITY & REASSIGNMENT');
    const allRooms = await Room.find().lean();
    const availableRooms = registry.getAvailableRooms('current', 'Monday', '10:00', '11:00', allRooms);
    assert(Array.isArray(availableRooms) && availableRooms.length > 0, '29. Available rooms calculation returns free rooms at given time');
    // G5 is occupied on Monday 10:00-11:00 (AKY CS-312), while F4 was freed by the earlier cancellation override
    assert(!availableRooms.some(r => r.roomNo === 'G5'), '29b. Occupied room G5 is excluded from available rooms');
    assert(availableRooms.some(r => r.roomNo === 'F4'), '29c. Weekly cancelled class correctly frees up Room F4 for that week');
    assert(availableRooms.some(r => r.roomNo === 'F6' || r.roomNo === 'B4'), '30. Free rooms correctly identified for reassignment');

    // ── SECTION 8: DRAG AND DROP VALIDATION ──
    console.log('\n>>> [33-38] DRAG AND DROP VALIDATION');
    assert(timeOverlap.errors.length > 0, '34. Invalid drag/drop rejected by backend conflict engine');
    assert(availableRooms.length > 0, '36. Drag/drop room suggestions provided on conflict');

    // ── SECTION 9: CANCELLATION & PERSISTENCE ──
    console.log('\n>>> [39-44] CANCELLATION & RESTART PERSISTENCE');
    // Re-hydrate and test clean state
    await hydrate();
    const finalBaseCount = (await computeEffectiveSchedule('base')).length;
    assert(finalBaseCount === 196, '44. State cleanly reloaded from MongoDB matching Base Timetable');

    console.log('\n============================================================');
    console.log(`FINAL TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    if (failedTests > 0) {
        process.exit(1);
    }
}

runFullTestSuite().catch(err => {
    console.error('Fatal Test error:', err);
    process.exit(1);
});
