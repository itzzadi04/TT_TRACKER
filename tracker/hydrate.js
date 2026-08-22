const TimetableSlot = require('../models/TimetableSlot');
const registry = require('./Registry');

async function hydrate() {
    console.log('[Hydration] Loading timetable slots into RAM...');

    const slots = await TimetableSlot.find()
        .populate('faculty classSection subject room time')
        .lean();

    for (const s of slots) {
        if (!s.faculty || !s.classSection || !s.subject || !s.room || !s.time) {
            continue;
        }

        const sectionKey = `Y${s.classSection.year}_S${s.classSection.semester}_${s.classSection.section}`;

        const payload = {
            slotId: s._id.toString(),
            facultyId: s.faculty.facultyId,
            roomNo: s.room.roomNo,
            sectionId: sectionKey,
            subjectCode: s.subject.subjectCode,
            subjectName: s.subject.name,
            day: s.time.day,
            starting: s.time.starting,
            ending: s.time.ending,
            isFixed: s.isFixed
        };

        // If starting is '09:00' and ending is '11:00', addSlot will auto-book both 09:00-10:00 & 10:00-11:00
        registry.addSlot('current', payload);
        registry.addSlot('next', payload);
    }

    console.log(`[Hydration] Hydrated ${slots.length} parent records into RAM grids.`);
}

module.exports = { hydrate };