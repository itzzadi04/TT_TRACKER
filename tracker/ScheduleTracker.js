/*
* each entity faculty room track there 3 maps
* curr, next and base
* will map unique_key with slot obj used for metadata
*/
class ScheduleTracker {
    constructor(ownerId, ownerType) {
        this.ownerId = ownerId;     // faculty id, section id, or room no
        this.ownerType = ownerType; // FACULTY, SECTION, or ROOM
        this.baseSchedule = new Map();
        this.currentWeek = new Map();
        this.nextWeek = new Map();
    }

    //gets the correct table
    _getTable(weekType) {
        if (weekType === 'base' || weekType === 'permanent') return this.baseSchedule;
        if (weekType === 'next') return this.nextWeek;
        return this.currentWeek;
    }

    //makes sure time is always 2 digit:2 digit
    //eg 09:00 otherwise 9:00 and 09:00 will behave differently
    //even tho they are same representation
    padTime(t) {
        if (!t) return '00:00';
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }

    //the general key looks like DAY_START_END eg MON_09:00_10:00
    getKey(day, start, end) {
        return `${day.toUpperCase()}_${this.padTime(start)}_${this.padTime(end)}`;
    }

    /*
     * checks if 1 hr slots are empty labs are divided into 2 atomic slots
     * of one hour/
     * Group & Session aware:
     * - If existing slot belongs to the same sessionId as the incoming slot -> NOT a conflict (same logical session / shared lab).
     * - If section already has a group lab (e.g. G1), a whole-section normal class (incomingGroup = null) CANNOT be scheduled -> CONFLICT.
     * - If both have groups and they are different (e.g. G1 in P4 vs G2 in B1) -> NOT a conflict (parallel labs allowed).
     */
    isAtomicSlotFree(weekType, day, start, end, incomingGroup, incomingSessionId) {
        const key = this.getKey(day, start, end);
        const table = this._getTable(weekType);
        
        //direct check for lazy copying as majority of time classes
        //of groups are same
        const existing = table.get(key);
        if (existing) {
            //self session check
            if (incomingSessionId && existing.sessionId && existing.sessionId === incomingSessionId) {
                return true;
            }
            // If existing is whole-section and incoming is anything -> CONFLICT
            return false;
        }
        //group specific check
        //group keys are key_G:n eg key_G:2 represnts group 2 to same class
        for (const [k, slot] of table) {
            if (k.startsWith(key + '_G:')) {
                //self session check for group keys
                if (incomingSessionId && slot.sessionId && slot.sessionId === incomingSessionId) {
                    continue;
                }
                // If section owner we will need to check raw+group
                if (this.ownerType === 'SECTION') {

                    // If incoming is a whole-section class (no group specified), it conflicts with ANY active group session!
                    if (!incomingGroup) {
                        return false;
                    }
                    // If incoming has a group and it matches the existing group -> conflict
                    if (slot.group === incomingGroup) {
                        return false;
                    }
                    // If different groups (e.g. existing G1, incoming G2) -> permitted!
                    continue;
                }
                //room occupied by any one makes directly unavailable
                if (this.ownerType === 'ROOM') {
                    return false;
                }
                //fac teaches any group direct unavailable
                if (this.ownerType === 'FACULTY') {
                    return false;
                }
            }
        }

        return true;
    }

    //assumes caller checks if conflict from isAtomicSlotFree
    getConflictReason(weekType, day, start, end, incomingGroup) {
        //get the key+ curr table for whole class
        const key = this.getKey(day, start, end);
        const table = this._getTable(weekType);
        let slot = table.get(key);


        //as for whole class not found check possible groups
        if (!slot) {
            for (const [k, s] of table) {
                if (k.startsWith(key + '_G:')) {
                    if (!incomingGroup || s.group === incomingGroup) {
                        slot = s;
                        break;
                    }
                }
            }
        }

        if (!slot) return null;

        const labTag = slot.isLab ? ' [LAB]' : '';
        const groupTag = slot.group ? ` (Group ${slot.group})` : '';

        if (this.ownerType === 'FACULTY') {
            return `FACULTY conflict: ${this.ownerId} is already teaching ${slot.subjectCode}${labTag}${groupTag} to ${slot.sectionId} in Room ${slot.roomNo} at ${day} ${start}-${end}`;
        }
        if (this.ownerType === 'SECTION') {
            if (slot.isLab) {
                return `LAB_TIME_CONFLICT: Section ${this.ownerId} is already attending laboratory session ${slot.subjectCode}${groupTag} in Room ${slot.roomNo} at ${day} ${start}-${end}`;
            }
            return `SECTION conflict: Section ${this.ownerId} already has ${slot.subjectCode}${labTag}${groupTag} in Room ${slot.roomNo} with ${slot.facultyId} at ${day} ${start}-${end}`;
        }
        return `ROOM conflict: Room ${this.ownerId} is occupied by ${slot.sectionId} for ${slot.subjectCode}${labTag}${groupTag} (Faculty: ${slot.facultyId}) at ${day} ${start}-${end}`;
    }

    //assumes caller checked isAtomicSlotFree
    setSlot(weekType, slot) {
        //get whole key
        const key = this.getKey(slot.day, slot.starting, slot.ending);
        const table = this._getTable(weekType);

        //group attri change to group key
        if (slot.group) {
            const groupKey = `${key}_G:${slot.group}`;
            table.set(groupKey, slot);
        } else {
            table.set(key, slot);
        }
    }

    //assumes caller checked isAtomicSlotFree
    deleteSlot(weekType, day, start, end, group) {
        const key = this.getKey(day, start, end);
        const table = this._getTable(weekType);

        if (group) {
            table.delete(`${key}_G:${group}`);
        } else {
            table.delete(key);
            // Also clean up any grouped variants if ungrouped removal is triggered
            for (const k of Array.from(table.keys())) {
                if (k.startsWith(key)) {
                    table.delete(k);
                }
            }
        }
    }

    //returns the 2d representation of week
    exportGrid(weekType, days, timeIntervals) {
        const table = this._getTable(weekType);
        return days.map(day => ({
            day,
            slots: timeIntervals.map(interval => {
                const key = this.getKey(day, interval.start, interval.end);

                const allSlots = [];
                if (table.has(key)) allSlots.push(table.get(key));
                for (const [k, v] of table) {
                    if (k.startsWith(key + '_G:')) allSlots.push(v);
                }

                if (allSlots.length === 0) {
                    return {
                        start: interval.start,
                        end: interval.end,
                        occupied: false,
                        data: null,
                        multipleSlots: null
                    };
                }

                return {
                    start: interval.start,
                    end: interval.end,
                    occupied: true,
                    data: allSlots[0],
                    multipleSlots: allSlots.length > 1 ? allSlots : null
                };
            })
        }));
    }

    clear() {
        this.baseSchedule.clear();
        this.currentWeek.clear();
        this.nextWeek.clear();
    }
}

module.exports = ScheduleTracker;