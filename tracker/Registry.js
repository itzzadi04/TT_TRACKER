const ScheduleTracker = require('./ScheduleTracker');
/*tracks the Schedules for every entity
* every entity must use the same instance of registry for orcastrating there work
* as registry is the view of central truth as to update database
* maps are checked first
*
* conclusion:use only 1 server machine
*/
class Registry {
    constructor() {
        this.faculties = new Map();
        this.rooms = new Map();
        this.sections = new Map();
        this.isRollingOver = false;

        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        //1 hr intervals
        this.timeIntervals = [
            { start: '09:00', end: '10:00', isLunch: false },
            { start: '10:00', end: '11:00', isLunch: false },
            { start: '11:00', end: '12:00', isLunch: false },
            { start: '12:00', end: '13:00', isLunch: false },
            { start: '13:00', end: '14:00', isLunch: true  },
            { start: '14:00', end: '15:00', isLunch: false },
            { start: '15:00', end: '16:00', isLunch: false },
            { start: '16:00', end: '17:00', isLunch: false }
        ];
    }

    //same as schdule tracker 2 dig:2dig
    padTime(t) {
        if (!t) return '00:00';
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }

    //returns the approprite map and if doesnt exist creates it
    //as side effect must not be used to check states use direct .get()
    getOwner(type, id) {
        const targetMap =
            type === 'FACULTY' ? this.faculties :
                type === 'ROOM' ? this.rooms : this.sections;

        if (!targetMap.has(id)) {
            targetMap.set(id, new ScheduleTracker(id, type));
        }
        return targetMap.get(id);
    }

    //returns arrays of atomic time intervals
    //09:00 -10:00 becomes and interval bigger intervals will be split into
    //1 hr slots
    getSpannedIntervals(rawStart, rawEnd) {
        const start = this.padTime(rawStart);
        const end = this.padTime(rawEnd);

        const exact = this.timeIntervals.find(t => t.start === start && t.end === end);
        if (exact) return [exact];

        const matched = this.timeIntervals.filter(t => t.start < end && t.end > start);
        return matched.length > 0 ? matched : [{ start, end, isLunch: false }];
    }

    /*
     * Check for conflicts across faculty, room, and section.
     * Group & Session aware:
     * - Parallel group labs (G1 in Room A, G2 in Room B) are valid.
     * - Shared lab/session (same sessionId) is valid.
     * - Normal lecture moved into a lab-only room/slot is rejected with INVALID_LAB_TARGET.
     */
    checkConflict(weekType, { facultyId, roomNo, sectionId, day, start, end, group, sessionId, isLab = false, targetRoomType = null }) {
        const errors = [];
        const conflictTypes = new Set();
        const intervals = this.getSpannedIntervals(start, end);

        // Check Invalid Lab Target: Non-lab class cannot be placed in a dedicated Lab room
        if (!isLab && targetRoomType && targetRoomType.toLowerCase() === 'lab') {
            errors.push('INVALID_LAB_TARGET: This class cannot be scheduled in this lab slot.');
            conflictTypes.add('INVALID_LAB_TARGET');
        }

        const fac = this.faculties.get(facultyId);
        const room = this.rooms.get(roomNo);
        const sec = this.sections.get(sectionId);

        for (const interval of intervals) {
            // 1. Faculty conflict
            if (fac && !fac.isAtomicSlotFree(weekType, day, interval.start, interval.end, group, sessionId)) {
                const reason = fac.getConflictReason(weekType, day, interval.start, interval.end, group);
                if (reason) {
                    errors.push(reason);
                    conflictTypes.add('FACULTY_CONFLICT');
                }
            }
            // 2. Room conflict
            if (room && !room.isAtomicSlotFree(weekType, day, interval.start, interval.end, group, sessionId)) {
                const reason = room.getConflictReason(weekType, day, interval.start, interval.end, group);
                if (reason) {
                    errors.push(reason);
                    conflictTypes.add('ROOM_CONFLICT');
                }
            }
            // 3. Section / Lab conflict
            if (sec && !sec.isAtomicSlotFree(weekType, day, interval.start, interval.end, group, sessionId)) {
                const reason = sec.getConflictReason(weekType, day, interval.start, interval.end, group);
                if (reason) {
                    errors.push(reason);
                    if (reason.startsWith('LAB_TIME_CONFLICT')) {
                        conflictTypes.add('LAB_TIME_CONFLICT');
                    } else {
                        conflictTypes.add(group ? 'GROUP_CONFLICT' : 'SECTION_CONFLICT');
                    }
                }
            }
        }

        const hasNonRoomConflict = conflictTypes.has('LAB_TIME_CONFLICT') ||
                                   conflictTypes.has('INVALID_LAB_TARGET') ||
                                   conflictTypes.has('FACULTY_CONFLICT') ||
                                   conflictTypes.has('SECTION_CONFLICT') ||
                                   conflictTypes.has('GROUP_CONFLICT');

        return {
            isAvailable: errors.length === 0,
            errors: [...new Set(errors)],
            conflictTypes: Array.from(conflictTypes),
            isRoomOnlyConflict: conflictTypes.has('ROOM_CONFLICT') && !hasNonRoomConflict
        };
    }

    /**
     * Find all available rooms that are completely free at a given week, day, and time span.
     */
    getAvailableRooms(weekType, day, start, end, allRooms = []) {
        const intervals = this.getSpannedIntervals(start, end);
        const available = [];

        for (const r of allRooms) {
            const roomTracker = this.rooms.get(r.roomNo);
            let isFree = true;

            for (const interval of intervals) {
                if (roomTracker && !roomTracker.isAtomicSlotFree(weekType, day, interval.start, interval.end)) {
                    isFree = false;
                    break;
                }
            }

            if (isFree) {
                available.push({
                    id: r._id ? r._id.toString() : r.id,
                    roomNo: r.roomNo,
                    building: r.building,
                    labOrClass: r.labOrClass
                });
            }
        }

        return available;
    }

    addSlot(weekType, rawSlot) {
        const intervals = this.getSpannedIntervals(rawSlot.starting, rawSlot.ending);
        const isMultiHour = intervals.length > 1;

        for (let i = 0; i < intervals.length; i++) {
            const subSlot = {
                ...rawSlot,
                starting: intervals[i].start,
                ending: intervals[i].end,
                isLab: rawSlot.isLab || isMultiHour,
                labBlockIndex: isMultiHour ? i + 1 : null,
                totalLabBlocks: isMultiHour ? intervals.length : 1,
                parentStart: rawSlot.starting,
                parentEnd: rawSlot.ending
            };

            this.getOwner('FACULTY', rawSlot.facultyId).setSlot(weekType, subSlot);
            this.getOwner('ROOM', rawSlot.roomNo).setSlot(weekType, subSlot);
            this.getOwner('SECTION', rawSlot.sectionId).setSlot(weekType, subSlot);
        }
    }

    removeSlot(weekType, { facultyId, roomNo, sectionId, day, start, end, starting, ending, group }) {
        const s = start || starting;
        const e = end || ending;
        const intervals = this.getSpannedIntervals(s, e);

        for (const interval of intervals) {
            this.faculties.get(facultyId)?.deleteSlot(weekType, day, interval.start, interval.end, group);
            this.rooms.get(roomNo)?.deleteSlot(weekType, day, interval.start, interval.end, group);
            this.sections.get(sectionId)?.deleteSlot(weekType, day, interval.start, interval.end, group);
        }
    }

    getRepresentation(type, id, weekType = 'current') {
        const targetMap =
            type === 'FACULTY' ? this.faculties :
                type === 'ROOM' ? this.rooms : this.sections;

        const owner = targetMap.get(id);
        if (!owner) {
            const dummy = new ScheduleTracker(id, type);
            return dummy.exportGrid(weekType, this.days, this.timeIntervals);
        }
        return owner.exportGrid(weekType, this.days, this.timeIntervals);
    }

    clear() {
        for (const tracker of this.faculties.values()) tracker.clear();
        for (const tracker of this.rooms.values()) tracker.clear();
        for (const tracker of this.sections.values()) tracker.clear();
        this.faculties.clear();
        this.rooms.clear();
        this.sections.clear();
    }

    getEntityIds(type) {
        const targetMap =
            type === 'FACULTY' ? this.faculties :
                type === 'ROOM' ? this.rooms : this.sections;
        return Array.from(targetMap.keys()).sort();
    }
}

module.exports = new Registry();