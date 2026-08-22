class ScheduleTracker {
    constructor(ownerId, ownerType) {
        this.ownerId = ownerId;     // Faculty ID, Room No, or Section ID
        this.ownerType = ownerType; // 'FACULTY' | 'ROOM' | 'SECTION'
        this.currentWeek = new Map();
        this.nextWeek = new Map();
    }

    _getTable(weekType) {
        return weekType === 'next' ? this.nextWeek : this.currentWeek;
    }

    padTime(t) {
        if (!t) return '00:00';
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }

    getKey(day, start, end) {
        return `${day.toUpperCase()}_${this.padTime(start)}_${this.padTime(end)}`;
    }

    isAtomicSlotFree(weekType, day, start, end) {
        const key = this.getKey(day, start, end);
        return !this._getTable(weekType).has(key);
    }

    getConflictReason(weekType, day, start, end) {
        const key = this.getKey(day, start, end);
        const slot = this._getTable(weekType).get(key);
        if (!slot) return null;

        const labTag = slot.isLab ? ' [LAB]' : '';
        if (this.ownerType === 'FACULTY') {
            return `Faculty ${this.ownerId} is teaching ${slot.subjectCode}${labTag} to Section ${slot.sectionId} in Room ${slot.roomNo}`;
        }
        if (this.ownerType === 'SECTION') {
            return `Section ${this.ownerId} has ${slot.subjectCode}${labTag} in Room ${slot.roomNo} with Faculty ${slot.facultyId}`;
        }
        return `Room ${this.ownerId} is occupied by Section ${slot.sectionId} for ${slot.subjectCode}${labTag} (Faculty: ${slot.facultyId})`;
    }

    setSlot(weekType, slot) {
        const key = this.getKey(slot.day, slot.starting, slot.ending);
        this._getTable(weekType).set(key, slot);
    }

    deleteSlot(weekType, day, start, end) {
        const key = this.getKey(day, start, end);
        this._getTable(weekType).delete(key);
    }

    exportGrid(weekType, days, timeIntervals) {
        const table = this._getTable(weekType);
        return days.map(day => ({
            day,
            slots: timeIntervals.map(interval => {
                const key = this.getKey(day, interval.start, interval.end);
                const slotData = table.get(key) || null;
                return {
                    start: interval.start,
                    end: interval.end,
                    occupied: Boolean(slotData),
                    data: slotData
                };
            })
        }));
    }
}

module.exports = ScheduleTracker;