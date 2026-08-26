const express = require('express');
const router = express.Router();
const registry = require('../tracker/Registry');
const { hydrate } = require('../tracker/hydrate');
const { computeEffectiveSchedule } = require('../tracker/effectiveSchedule');
const { resolveWeekKey, getCurrentWeekKey, getNextWeekKey, getAcademicWeekState } = require('../tracker/weekUtils');

const TimetableSlot = require('../models/TimetableSlot');
const ScheduleOverride = require('../models/ScheduleOverride');
const Faculty = require('../models/Faculty');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Time = require('../models/Time');

// FIFO Queue for serializing write mutations
let writeQueue = Promise.resolve();

function enqueueWrite(task) {
    writeQueue = writeQueue.then(async () => {
        return task();
    }).catch(err => {
        console.error('[WriteQueue Error]', err);
    });
    return writeQueue;
}

// ──────────────────────────────────────────
// 1. Read Grid (from RAM registry)
// ──────────────────────────────────────────
router.get('/grid', (req, res) => {
    const { type = 'FACULTY', id, week = 'current' } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing entity ID.' });

    const { isBase, label } = resolveWeekKey(week);
    const weekType = isBase ? 'base' : (label === 'next' ? 'next' : 'current');

    const grid = registry.getRepresentation(type.toUpperCase(), id, weekType);
    res.json({
        success: true,
        grid,
        week: isBase ? 'base' : label,
        isBase
    });
});

router.get('/entities', async (req, res) => {
    try {
        const [facultyDocs, roomDocs, sectionDocs] = await Promise.all([
            Faculty.find().sort({ facultyId: 1 }).lean(),
            Room.find().sort({ roomNo: 1 }).lean(),
            ClassSection.find().sort({ sectionId: 1 }).lean()
        ]);

        const faculties = facultyDocs.length > 0
            ? facultyDocs.map(f => f.facultyId)
            : registry.getEntityIds('FACULTY');

        const rooms = roomDocs.length > 0
            ? roomDocs.map(r => r.roomNo)
            : registry.getEntityIds('ROOM');

        const sections = sectionDocs.length > 0
            ? sectionDocs.map(s => s.sectionId)
            : registry.getEntityIds('SECTION');

        res.json({ faculties, rooms, sections });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// 3. Base Timetable Direct Query
// ──────────────────────────────────────────
router.get('/base', async (req, res) => {
    try {
        const baseSlots = await computeEffectiveSchedule('base');
        res.json({ success: true, data: baseSlots });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// 4. Room Availability & Workflow Context Endpoints
// ──────────────────────────────────────────
router.get('/workflow-context', (req, res) => {
    const { simulatedDay } = req.query; // e.g. 'Monday', 'Saturday' (only valid when devMode active)
    const state = getAcademicWeekState({ simulatedDay });
    res.json({
        success: true,
        ...state
    });
});

router.get('/rooms/available', async (req, res) => {
    try {
        const { week = 'current', day, start, end } = req.query;
        if (!day || !start || !end) {
            return res.status(400).json({ error: 'Missing day, start, or end parameters.' });
        }

        const { isBase, label } = resolveWeekKey(week);
        const weekType = isBase ? 'base' : (label === 'next' ? 'next' : 'current');

        const allRooms = await Room.find().lean();
        const available = registry.getAvailableRooms(weekType, day, start, end, allRooms);

        res.json({
            success: true,
            day,
            start,
            end,
            week: label,
            count: available.length,
            rooms: available
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// 5. Cancel Slot (Target Week is Driven by Active Timetable Context)
// ──────────────────────────────────────────
router.post('/cancel', (req, res) => {
    const { slot, week = 'current', scope } = req.body;
    if (!slot) return res.status(400).json({ error: 'Missing slot payload.' });

    enqueueWrite(async () => {
        try {
            const isPermanent = scope === 'PERMANENT' || week === 'base';
            const isNext = scope === 'NEXT_WEEK' || week === 'next';
            const targetWeekKey = isPermanent ? 'base' : (isNext ? getNextWeekKey() : getCurrentWeekKey());
            const weekLabel = isPermanent ? 'Base Timetable' : (isNext ? 'Next Week' : 'Current Week');

            if (isPermanent) {
                // ── PERMANENT CANCELLATION ──
                if (slot.originalSlotId || slot.slotId) {
                    const targetId = slot.originalSlotId || slot.slotId;
                    await TimetableSlot.findByIdAndUpdate(targetId, { isCancelled: true });
                }

                // If lab session, cancel all blocks with same sessionId
                if (slot.sessionId) {
                    await TimetableSlot.updateMany(
                        { sessionId: slot.sessionId },
                        { isCancelled: true }
                    );
                }
            } else {
                // ── ACTIVE WEEK-SPECIFIC CANCELLATION ──
                const faculty = await Faculty.findOne({ facultyId: slot.facultyId });
                const classSection = await ClassSection.findOne({ sectionId: slot.sectionId });
                const subject = await Subject.findOne({ subjectCode: slot.subjectCode });
                const room = await Room.findOne({ roomNo: slot.roomNo });
                const time = await Time.findOne({ day: slot.day, starting: slot.starting, ending: slot.ending });

                if (faculty && classSection && subject && room && time) {
                    const origId = (slot.originalSlotId && slot.originalSlotId.length === 24) ? slot.originalSlotId : (slot.slotId && slot.slotId.length === 24 ? slot.slotId : null);

                    await ScheduleOverride.create({
                        weekKey: targetWeekKey,
                        originalSlot: origId,
                        action: 'CANCEL',
                        scope: isNext ? 'NEXT_WEEK' : 'CURRENT_WEEK',
                        faculty: faculty._id,
                        classSection: classSection._id,
                        subject: subject._id,
                        room: room._id,
                        time: time._id,
                        sessionId: slot.sessionId || `${slot.facultyId}_${slot.sectionId}_${slot.subjectCode}`,
                        isLab: slot.isLab || false,
                        duration: slot.duration || 1,
                        group: slot.group || null,
                        status: 'ACTIVE'
                    });
                }
            }

            // Re-hydrate registry from database
            await hydrate();

            let message = isPermanent
                ? 'Class cancelled permanently from Base Timetable.'
                : 'Class cancelled successfully.';

            res.json({ success: true, message });
        } catch (dbErr) {
            console.error('[Cancel Error]', dbErr);
            res.status(500).json({ success: false, error: 'Cancel failed: ' + dbErr.message });
        }
    });
});

// ──────────────────────────────────────────
// 6. Validate Drop (Pre-commit Validation after Drag/Drop)
// ──────────────────────────────────────────
router.post('/validate-drop', async (req, res) => {
    try {
        const { actionType = 'RESCHEDULE', originalSlot, targetSlot, week = 'current', scope = 'CURRENT_WEEK' } = req.body;
        if (!targetSlot) return res.status(400).json({ error: 'Missing targetSlot payload.' });

        const isBase = scope === 'PERMANENT' || week === 'base';
        const isNext = scope === 'NEXT_WEEK' || week === 'next';
        const weekType = isBase ? 'base' : (isNext ? 'next' : 'current');

        // Resolve Target Room
        const targetRoom = await Room.findOne({ roomNo: targetSlot.roomNo });
        if (!targetRoom) {
            return res.json({
                isAvailable: false,
                conflictTypes: ['ROOM_NOT_FOUND'],
                isRoomOnlyConflict: false,
                errors: [`Room ${targetSlot.roomNo} not found.`],
                availableRooms: []
            });
        }

        // Check Invalid Lab Target (lecture into lab room)
        if (!targetSlot.isLab && targetRoom.labOrClass && targetRoom.labOrClass.toLowerCase() === 'lab') {
            return res.json({
                isAvailable: false,
                conflictTypes: ['INVALID_LAB_TARGET'],
                isRoomOnlyConflict: false,
                errors: ['INVALID_LAB_TARGET: This class cannot be scheduled in a lab slot.'],
                availableRooms: []
            });
        }

        // Temporarily remove original slot ONLY if this is a RESCHEDULE (move) operation
        const isReschedule = actionType === 'RESCHEDULE';
        if (isReschedule && originalSlot && originalSlot.facultyId) {
            registry.removeSlot(weekType, {
                facultyId: originalSlot.facultyId,
                roomNo: originalSlot.roomNo,
                sectionId: originalSlot.sectionId,
                day: originalSlot.day,
                starting: originalSlot.parentStart || originalSlot.starting,
                ending: originalSlot.parentEnd || originalSlot.ending,
                group: originalSlot.group || null
            });
        }

        const check = registry.checkConflict(weekType, {
            facultyId: targetSlot.facultyId,
            roomNo: targetSlot.roomNo,
            sectionId: targetSlot.sectionId,
            day: targetSlot.day,
            start: targetSlot.starting,
            end: targetSlot.ending,
            group: targetSlot.group || null,
            sessionId: isReschedule ? (targetSlot.sessionId || null) : null,
            isLab: targetSlot.isLab || false,
            targetRoomType: targetRoom.labOrClass
        });

        // Restore original slot in memory
        if (isReschedule && originalSlot && originalSlot.facultyId) {
            registry.addSlot(weekType, originalSlot);
        }

        let availableRooms = [];
        if (!check.isAvailable && check.isRoomOnlyConflict) {
            const allRooms = await Room.find().lean();
            availableRooms = registry.getAvailableRooms(weekType, targetSlot.day, targetSlot.starting, targetSlot.ending, allRooms);
        }

        res.json({
            success: true,
            isAvailable: check.isAvailable,
            conflictTypes: check.conflictTypes,
            isRoomOnlyConflict: check.isRoomOnlyConflict,
            availableRooms,
            errors: check.errors
        });
    } catch (err) {
        console.error('[Validate Drop Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// 7. Move / Reschedule / Add Extra Class
// ──────────────────────────────────────────
router.post('/move-or-add', (req, res) => {
    const { actionType = 'RESCHEDULE', originalSlot, targetSlot, week = 'current', scope = 'CURRENT_WEEK' } = req.body;

    if (!targetSlot) {
        return res.status(400).json({ error: 'Missing targetSlot payload.' });
    }

    // Labs cannot be partially rescheduled directly into non-lab slots
    if (originalSlot && originalSlot.isLab && actionType === 'RESCHEDULE' && !targetSlot.isLab) {
        return res.status(403).json({
            success: false,
            error: 'INVALID_LAB_TARGET: Labs cannot be converted to regular lectures without proper lab duration.',
            conflict: false
        });
    }

    enqueueWrite(async () => {
        const isPermanent = scope === 'PERMANENT' || week === 'base';
        const isNext = scope === 'NEXT_WEEK' || week === 'next';
        const weekType = isBase => isBase ? 'base' : (isNext ? 'next' : 'current');
        const activeWeekType = weekType(isPermanent);
        const targetWeekKey = isNext ? getNextWeekKey() : getCurrentWeekKey();
        const weekLabel = isNext ? 'Next Week' : 'Current Week';
        const isScheduleExtra = actionType === 'ADD_EXTRA' || actionType === 'SCHEDULE';

        // Resolve Target Room & Check Invalid Lab Target
        const targetRoom = await Room.findOne({ roomNo: targetSlot.roomNo });
        if (!targetRoom) {
            return res.status(400).json({ success: false, error: `Room ${targetSlot.roomNo} not found.` });
        }

        if (!targetSlot.isLab && targetRoom.labOrClass && targetRoom.labOrClass.toLowerCase() === 'lab') {
            return res.status(409).json({
                success: false,
                conflict: true,
                conflictTypes: ['INVALID_LAB_TARGET'],
                errors: ['INVALID_LAB_TARGET: This class cannot be scheduled in a lab slot.'],
                isRoomOnlyConflict: false,
                availableRooms: []
            });
        }

        // Step A: Evict original slot temporarily ONLY if this is a RESCHEDULE move
        if (!isScheduleExtra && actionType === 'RESCHEDULE' && originalSlot) {
            registry.removeSlot(activeWeekType, {
                facultyId: originalSlot.facultyId,
                roomNo: originalSlot.roomNo,
                sectionId: originalSlot.sectionId,
                day: originalSlot.day,
                starting: originalSlot.parentStart || originalSlot.starting,
                ending: originalSlot.parentEnd || originalSlot.ending,
                group: originalSlot.group || null
            });
        }

        // Step B: Conflict Verification in target position
        const check = registry.checkConflict(activeWeekType, {
            facultyId: targetSlot.facultyId,
            roomNo: targetSlot.roomNo,
            sectionId: targetSlot.sectionId,
            day: targetSlot.day,
            start: targetSlot.starting,
            end: targetSlot.ending,
            group: targetSlot.group || null,
            sessionId: !isScheduleExtra ? (targetSlot.sessionId || null) : null,
            isLab: targetSlot.isLab || false,
            targetRoomType: targetRoom.labOrClass
        });

        if (!check.isAvailable) {
            // Rollback RAM
            if (!isScheduleExtra && actionType === 'RESCHEDULE' && originalSlot) {
                registry.addSlot(activeWeekType, originalSlot);
            }

            let availableRooms = [];
            if (check.isRoomOnlyConflict) {
                const allRooms = await Room.find().lean();
                availableRooms = registry.getAvailableRooms(activeWeekType, targetSlot.day, targetSlot.starting, targetSlot.ending, allRooms);
            }

            return res.status(409).json({
                success: false,
                conflict: true,
                conflictTypes: check.conflictTypes,
                isRoomOnlyConflict: check.isRoomOnlyConflict,
                conflicts: check.errors.map(msg => ({
                    type: msg.split(':')[0] || 'UNKNOWN',
                    message: msg
                })),
                errors: check.errors,
                availableRooms
            });
        }

        // Step C: Persist mutation to MongoDB
        try {
            // Resolve target Time document
            let targetTime = await Time.findOne({
                day: targetSlot.day,
                starting: targetSlot.starting,
                ending: targetSlot.ending
            });
            if (!targetTime) {
                targetTime = await Time.create({
                    day: targetSlot.day,
                    starting: targetSlot.starting,
                    ending: targetSlot.ending
                });
            }

            // Resolve Faculty, ClassSection, Subject
            const faculty = await Faculty.findOne({ facultyId: targetSlot.facultyId });
            const classSection = await ClassSection.findOne({ sectionId: targetSlot.sectionId });
            const subject = await Subject.findOne({ subjectCode: targetSlot.subjectCode });

            if (!faculty || !classSection || !subject) {
                if (!isScheduleExtra && actionType === 'RESCHEDULE' && originalSlot) registry.addSlot(activeWeekType, originalSlot);
                return res.status(400).json({ success: false, error: 'Could not resolve entity references.' });
            }

            if (isPermanent) {
                // ── PERMANENT MUTATION (Updates Base Timetable) ──
                if (!isScheduleExtra && actionType === 'RESCHEDULE' && originalSlot && (originalSlot.originalSlotId || originalSlot.slotId)) {
                    const slotDbId = originalSlot.originalSlotId || originalSlot.slotId;
                    await TimetableSlot.findByIdAndUpdate(slotDbId, {
                        time: targetTime._id,
                        room: targetRoom._id
                    });
                } else {
                    const sessionId = `${targetSlot.facultyId}_${targetSlot.sectionId}_${targetSlot.subjectCode}_${targetSlot.day}_${targetSlot.starting}_PERM_${Date.now()}`;
                    await TimetableSlot.create({
                        faculty: faculty._id,
                        classSection: classSection._id,
                        subject: subject._id,
                        room: targetRoom._id,
                        time: targetTime._id,
                        sessionId,
                        isLab: targetSlot.isLab || false,
                        duration: targetSlot.duration || 1,
                        group: targetSlot.group || null,
                        isFixed: false,
                        isOccupied: true,
                        isCancelled: false
                    });
                }
            } else {
                // ── WEEK-SPECIFIC OVERRIDE (Creates ScheduleOverride Delta for THIS week or NEXT week only) ──
                const origId = originalSlot ? (originalSlot.originalSlotId || originalSlot.slotId) : null;
                const sessionId = isScheduleExtra
                    ? `EXTRA_${targetSlot.facultyId}_${targetSlot.sectionId}_${targetSlot.subjectCode}_${targetWeekKey}_${Date.now()}`
                    : (targetSlot.sessionId || `${targetSlot.facultyId}_${targetSlot.sectionId}_${targetSlot.subjectCode}_${targetSlot.day}_${targetSlot.starting}_OVER_${Date.now()}`);

                await ScheduleOverride.create({
                    weekKey: targetWeekKey,
                    originalSlot: (!isScheduleExtra && origId && origId.length === 24) ? origId : null,
                    action: isScheduleExtra ? 'ADD_EXTRA' : 'RESCHEDULE',
                    scope: isNext ? 'NEXT_WEEK' : 'CURRENT_WEEK',
                    faculty: faculty._id,
                    classSection: classSection._id,
                    subject: subject._id,
                    room: targetRoom._id,
                    time: targetTime._id,
                    sessionId,
                    isLab: targetSlot.isLab || false,
                    duration: targetSlot.duration || 1,
                    group: targetSlot.group || null,
                    status: 'ACTIVE'
                });
            }

            // Step D: Re-hydrate in-memory state
            await hydrate();

            let msg = isPermanent
                ? 'Permanent change applied to Base Timetable.'
                : (isScheduleExtra
                    ? `Extra class scheduled for ${weekLabel} only.`
                    : `Class rescheduled for ${weekLabel} only.`);

            res.json({
                success: true,
                conflict: false,
                message: msg
            });
        } catch (dbErr) {
            console.error('[Move/Add Error]', dbErr);
            if (!isScheduleExtra && actionType === 'RESCHEDULE' && originalSlot) registry.addSlot(activeWeekType, originalSlot);
            res.status(500).json({ success: false, error: 'Persistence failed: ' + dbErr.message });
        }
    });
});

// ──────────────────────────────────────────
// 8. Weekly Rollover Trigger
// ──────────────────────────────────────────
router.post('/rollover', async (req, res) => {
    try {
        console.log('[Rollover] Performing weekly rollover and re-hydrating...');
        await hydrate();
        res.json({
            success: true,
            currentWeekKey: getCurrentWeekKey(),
            nextWeekKey: getNextWeekKey(),
            message: 'Weekly schedule rolled over successfully.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────
// 9. Direct Conflict Check
// ──────────────────────────────────────────
router.get('/conflicts', async (req, res) => {
    const { facultyId, roomNo, sectionId, day, start, end, week = 'current', group, sessionId, isLab } = req.query;

    if (!facultyId || !roomNo || !sectionId || !day || !start || !end) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const { isBase, label } = resolveWeekKey(week);
    const weekType = isBase ? 'base' : (label === 'next' ? 'next' : 'current');

    const targetRoom = await Room.findOne({ roomNo });

    const result = registry.checkConflict(weekType, {
        facultyId, roomNo, sectionId, day, start, end,
        group: group || null,
        sessionId: sessionId || null,
        isLab: isLab === 'true' || isLab === true,
        targetRoomType: targetRoom ? targetRoom.labOrClass : null
    });

    res.json({
        success: true,
        isAvailable: result.isAvailable,
        conflictTypes: result.conflictTypes,
        isRoomOnlyConflict: result.isRoomOnlyConflict,
        conflicts: result.errors
    });
});

module.exports = router;