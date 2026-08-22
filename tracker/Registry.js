const ScheduleTracker = require('./ScheduleTracker');

class Registry {
    constructor() {
        this.faculties = new Map();
        this.rooms = new Map();
        this.sections = new Map();

        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // 1-Hour Academic Grid Intervals with 13:00-14:00 reserved for Lunch
        this.timeIntervals = [
            { start: '09:00', end: '10:00', isLunch: false },
            { start: '10:00', end: '11:00', isLunch: false },
            { start: '11:00', end: '12:00', isLunch: false },
            { start: '12:00', end: '13:00', isLunch: false },
            { start: '13:00', end: '14:00', isLunch: true }, // Lunch Break
            { start: '14:00', end: '15:00', isLunch: false },
            { start: '15:00', end: '16:00', isLunch: false },
            { start: '16:00', end: '17:00', isLunch: false }
        ];
    }

    padTime(t) {
        if (!t) return '00:00';
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }

    getOwner(type, id) {
        const targetMap =
            type === 'FACULTY' ? this.faculties :
                type === 'ROOM' ? this.rooms : this.sections;

        if (!targetMap.has(id)) {
            targetMap.set(id, new ScheduleTracker(id, type));
        }
        return targetMap.get(id);
    }

    // Decompose multi-hour spans (e.g. 09:00-11:00 or 14:00-16:00) into atomic 1-hr intervals
    getSpannedIntervals(rawStart, rawEnd) {
        const start = this.padTime(rawStart);
        const end = this.padTime(rawEnd);

        const exact = this.timeIntervals.find(t => t.start === start && t.end === end);
        if (exact) return [exact];

        const matched = this.timeIntervals.filter(t => t.start >= start && t.end <= end && !t.isLunch);
        return matched.length > 0 ? matched : [{ start, end, isLunch: false }];
    }

    checkConflict(weekType, { facultyId, roomNo, sectionId, day, start, end }) {
        const errors = [];
        const intervals = this.getSpannedIntervals(start, end);

        // Block scheduling during lunch
        const spansLunch = this.timeIntervals.some(t => t.isLunch && ((start <= t.start && end >= t.end) || (start >= t.start && start < t.end)));
        if (spansLunch) {
            errors.push(`Slot spans Lunch Break (13:00 - 14:00) which is reserved.`);
        }

        const fac = this.faculties.get(facultyId);
        const room = this.rooms.get(roomNo);
        const sec = this.sections.get(sectionId);

        for (const interval of intervals) {
            if (fac && !fac.isAtomicSlotFree(weekType, day, interval.start, interval.end)) {
                errors.push(fac.getConflictReason(weekType, day, interval.start, interval.end));
            }
            if (room && !room.isAtomicSlotFree(weekType, day, interval.start, interval.end)) {
                errors.push(room.getConflictReason(weekType, day, interval.start, interval.end));
            }
            if (sec && !sec.isAtomicSlotFree(weekType, day, interval.start, interval.end)) {
                errors.push(sec.getConflictReason(weekType, day, interval.start, interval.end));
            }
        }

        return {
            isAvailable: errors.length === 0,
            errors: [...new Set(errors)]
        };
    }

    addSlot(weekType, rawSlot) {
        const intervals = this.getSpannedIntervals(rawSlot.starting, rawSlot.ending);
        const isMultiHour = intervals.length > 1;

        for (let i = 0; i < intervals.length; i++) {
            const subSlot = {
                ...rawSlot,
                starting: intervals[i].start,
                ending: intervals[i].end,
                isLab: isMultiHour,
                labBlockIndex: isMultiHour ? i + 1 : null,
                totalLabBlocks: isMultiHour ? intervals.length : 1
            };

            this.getOwner('FACULTY', rawSlot.facultyId).setSlot(weekType, subSlot);
            this.getOwner('ROOM', rawSlot.roomNo).setSlot(weekType, subSlot);
            this.getOwner('SECTION', rawSlot.sectionId).setSlot(weekType, subSlot);
        }
    }

    removeSlot(weekType, { facultyId, roomNo, sectionId, day, start, end, starting, ending }) {
        const s = start || starting;
        const e = end || ending;
        const intervals = this.getSpannedIntervals(s, e);

        for (const interval of intervals) {
            this.faculties.get(facultyId)?.deleteSlot(weekType, day, interval.start, interval.end);
            this.rooms.get(roomNo)?.deleteSlot(weekType, day, interval.start, interval.end);
            this.sections.get(sectionId)?.deleteSlot(weekType, day, interval.start, interval.end);
        }
    }

    getRepresentation(type, id, weekType = 'current') {
        const owner = this.getOwner(type, id);
        return owner.exportGrid(weekType, this.days, this.timeIntervals);
    }

    rollOverWeeks() {
        const allTrackers = [
            ...this.faculties.values(),
            ...this.rooms.values(),
            ...this.sections.values()
        ];

        for (const tracker of allTrackers) {
            tracker.currentWeek = new Map(tracker.nextWeek);
            tracker.nextWeek.clear();
        }
    }
}

module.exports = new Registry();