const express = require('express');
const router = express.Router();
const registry = require('../tracker/Registry');
const TimetableSlot = require('../models/TimetableSlot');

// FIFO Queue for serializing write mutations
let writeQueue = Promise.resolve();

function enqueueWrite(task) {
    writeQueue = writeQueue.then(async () => {
        if (registry.isRollingOver) {
            await new Promise(res => setTimeout(res, 200));
        }
        return task();
    }).catch(err => {
        console.error('[WriteQueue Error]', err);
    });
    return writeQueue;
}

// 1. Read Grid (Concurrent, Non-blocking from RAM)
router.get('/grid', (req, res) => {
    const { type = 'FACULTY', id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing entity ID.' });

    const grid = registry.getRepresentation(type, id, 'current');
    res.json({ success: true, grid });
});

// 2. Fetch Entity List
router.get('/entities', (req, res) => {
    res.json({
        faculties: Array.from(registry.faculties.keys()).sort(),
        rooms: Array.from(registry.rooms.keys()).sort(),
        sections: Array.from(registry.sections.keys()).sort()
    });
});

// 3. Cancel Slot (Works for both lectures and labs)
router.post('/cancel', (req, res) => {
    const { slot } = req.body;
    if (!slot) return res.status(400).json({ error: 'Missing slot payload.' });

    enqueueWrite(async () => {
        try {
            //database operation
            if (slot.slotId && !slot.slotId.startsWith('mock_')) {
                await TimetableSlot.findByIdAndDelete(slot.slotId);
            }

            // only to be done after database over else error and undefined state in ram maps
            registry.removeSlot('current', {
                facultyId: slot.facultyId,
                roomNo: slot.roomNo,
                sectionId: slot.sectionId,
                day: slot.day,
                starting: slot.parentStart || slot.starting,
                ending: slot.parentEnd || slot.ending
            });

            res.json({ success: true, message: 'Slot deleted from database and RAM.' });
        } catch (dbErr) {
            res.status(500).json({ success: false, error: 'Database delete failed: ' + dbErr.message });
        }
    });
});

// 4. Move (Lectures Only) or Add Extra Copy
router.post('/move-or-add', (req, res) => {
    const { actionType, originalSlot, targetSlot } = req.body;

    //lab immutable cuz not working
    if (originalSlot && originalSlot.isLab && actionType === 'RESCHEDULE') {
        return res.status(403).json({ error: 'Labs cannot be rescheduled; only cancelled.' });
    }

    enqueueWrite(async () => {
        // Step A: In-Memory Conflict Verification
        if (actionType === 'RESCHEDULE' && originalSlot) {
            registry.removeSlot('current', {
                facultyId: originalSlot.facultyId,
                roomNo: originalSlot.roomNo,
                sectionId: originalSlot.sectionId,
                day: originalSlot.day,
                starting: originalSlot.parentStart || originalSlot.starting,
                ending: originalSlot.parentEnd || originalSlot.ending
            });
        }

        const check = registry.checkConflict('current', {
            facultyId: targetSlot.facultyId,
            roomNo: targetSlot.roomNo,
            sectionId: targetSlot.sectionId,
            day: targetSlot.day,
            start: targetSlot.starting,
            end: targetSlot.ending
        });

        if (!check.isAvailable) {
            // Rollback RAM
            if (actionType === 'RESCHEDULE' && originalSlot) {
                registry.addSlot('current', originalSlot);
            }
            return res.status(409).json({ success: false, errors: check.errors });
        }

        //Database Mutation
        try {
            let savedId = targetSlot.slotId;

            if (actionType === 'RESCHEDULE' && originalSlot && originalSlot.slotId && !originalSlot.slotId.startsWith('mock_')) {
                // Update existing record in DB
                await TimetableSlot.findByIdAndUpdate(originalSlot.slotId, {
                    'time.day': targetSlot.day,
                    'time.starting': targetSlot.starting,
                    'time.ending': targetSlot.ending,
                    room: targetSlot.roomNo
                });
            } else if (actionType === 'DUPLICATE' || !originalSlot) {
                // Insert new copy record in DB
                const newDoc = await TimetableSlot.create({
                    faculty: targetSlot.facultyId,
                    room: targetSlot.roomNo,
                    classSection: targetSlot.sectionId,
                    subject: targetSlot.subjectCode,
                    time: { day: targetSlot.day, starting: targetSlot.starting, ending: targetSlot.ending },
                    isFixed: false
                });
                savedId = newDoc._id.toString();
            }

            //bring to ram
            registry.addSlot('current', { ...targetSlot, slotId: savedId });
            res.json({ success: true, message: 'Database and RAM updated successfully.' });
        } catch (dbErr) {
            // DB failed -> Rollback ram
            if (actionType === 'RESCHEDULE' && originalSlot) {
                registry.addSlot('current', originalSlot);
            }
            res.status(500).json({ success: false, error: 'Database persistence failed: ' + dbErr.message });
        }
    });
});

module.exports = router;