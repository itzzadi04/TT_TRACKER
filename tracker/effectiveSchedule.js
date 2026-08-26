const TimetableSlot = require('../models/TimetableSlot');
const ScheduleOverride = require('../models/ScheduleOverride');

/**
 * Calculate the Effective Timetable for a given week.
 *
 * Rules:
 * 1. Load all active Base Timetable slots (non-cancelled).
 * 2. If weekKey === 'base', return the base timetable directly.
 * 3. Otherwise, load all active ScheduleOverrides for this weekKey.
 * 4. Filter out any base slot that has an active 'CANCEL' or 'RESCHEDULE' override.
 * 5. Add all 'RESCHEDULE' and 'ADD_EXTRA' override slots.
 * 6. Return the combined, fully-resolved effective timetable slot list.
 */
async function computeEffectiveSchedule(weekKey = 'base') {
    // 1. Fetch active Base Timetable slots
    const baseSlots = await TimetableSlot.find({ isCancelled: false })
        .populate('faculty classSection subject room time')
        .lean();

    if (weekKey === 'base') {
        return baseSlots.map(slot => formatSlotPayload(slot, 'base'));
    }

    // 2. Fetch overrides for the specific week
    const overrides = await ScheduleOverride.find({ weekKey, status: 'ACTIVE' })
        .populate('faculty classSection subject room time originalSlot')
        .lean();

    // Map cancelled or rescheduled originalSlot IDs & sessionIds
    const cancelledSlotIds = new Set();
    const cancelledSessionIds = new Set();
    const rescheduledSlotIds = new Set();

    for (const ov of overrides) {
        if (ov.action === 'CANCEL') {
            if (ov.originalSlot) {
                cancelledSlotIds.add(ov.originalSlot._id ? ov.originalSlot._id.toString() : ov.originalSlot.toString());
            }
            if (ov.sessionId) {
                cancelledSessionIds.add(ov.sessionId);
            }
        } else if (ov.action === 'RESCHEDULE') {
            if (ov.originalSlot) {
                rescheduledSlotIds.add(ov.originalSlot._id ? ov.originalSlot._id.toString() : ov.originalSlot.toString());
            }
        }
    }

    // 3. Filter Base slots
    const effectiveList = [];
    for (const s of baseSlots) {
        const idStr = s._id.toString();
        // Exclude if cancelled or rescheduled
        if (cancelledSlotIds.has(idStr) || cancelledSessionIds.has(s.sessionId) || rescheduledSlotIds.has(idStr)) {
            continue;
        }
        effectiveList.push(formatSlotPayload(s, weekKey, false));
    }

    // 4. Add weekly override slots (RESCHEDULE and ADD_EXTRA)
    for (const ov of overrides) {
        if (ov.action === 'RESCHEDULE' || ov.action === 'ADD_EXTRA') {
            if (!ov.faculty || !ov.classSection || !ov.subject || !ov.room || !ov.time) {
                continue;
            }
            const origIdStr = ov.originalSlot ? (ov.originalSlot._id ? ov.originalSlot._id.toString() : ov.originalSlot.toString()) : null;
            if (origIdStr && cancelledSlotIds.has(origIdStr)) continue;
            if (ov.sessionId && cancelledSessionIds.has(ov.sessionId)) continue;
            effectiveList.push(formatOverridePayload(ov, weekKey));
        }
    }

    return effectiveList;
}

/**
 * Format a standard TimetableSlot document into a flat payload.
 */
function formatSlotPayload(s, weekKey, isOverride = false) {
    const sectionKey = s.classSection.sectionId || `Y${s.classSection.year}_S${s.classSection.semester}_${s.classSection.section}`;

    return {
        slotId: s._id.toString(),
        originalSlotId: s._id.toString(),
        facultyId: s.faculty.facultyId,
        facultyName: s.faculty.name,
        roomNo: s.room.roomNo,
        building: s.room.building,
        sectionId: sectionKey,
        subjectCode: s.subject.subjectCode,
        subjectName: s.subject.name,
        day: s.time.day,
        starting: s.time.starting,
        ending: s.time.ending,
        sessionId: s.sessionId,
        isLab: s.isLab || false,
        duration: s.duration || 1,
        group: s.group || null,
        isFixed: s.isFixed || false,
        weekKey: weekKey,
        isOverride: isOverride,
        overrideAction: null
    };
}

/**
 * Format a ScheduleOverride document into a flat payload.
 */
function formatOverridePayload(ov, weekKey) {
    const sectionKey = ov.classSection.sectionId || `Y${ov.classSection.year}_S${ov.classSection.semester}_${ov.classSection.section}`;

    return {
        slotId: ov._id.toString(),
        overrideId: ov._id.toString(),
        originalSlotId: ov.originalSlot ? (ov.originalSlot._id ? ov.originalSlot._id.toString() : ov.originalSlot.toString()) : null,
        facultyId: ov.faculty.facultyId,
        facultyName: ov.faculty.name,
        roomNo: ov.room.roomNo,
        building: ov.room.building,
        sectionId: sectionKey,
        subjectCode: ov.subject.subjectCode,
        subjectName: ov.subject.name,
        day: ov.time.day,
        starting: ov.time.starting,
        ending: ov.time.ending,
        sessionId: ov.sessionId,
        isLab: ov.isLab || false,
        duration: ov.duration || 1,
        group: ov.group || null,
        isFixed: false,
        weekKey: weekKey,
        isOverride: true,
        overrideAction: ov.action
    };
}

module.exports = {
    computeEffectiveSchedule,
    formatSlotPayload,
    formatOverridePayload
};
