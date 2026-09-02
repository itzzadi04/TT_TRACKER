/**
 * In-memory ledger of week-scoped mutations (CANCEL / RESCHEDULE / ADD_EXTRA)
 * that have already been applied to the RAM Registry but NOT yet persisted
 * to MongoDB.
 *
 * These are flushed to MongoDB (as ScheduleOverride documents) exactly once,
 * at weekly rollover — see flushPendingChanges() in routes/timetableroutes.js.
 *
 * Keyed by weekKey -> identityKey, so that repeated edits to the SAME class
 * within the same week (e.g. reschedule -> reschedule again, or
 * reschedule -> cancel) collapse into a single final change instead of
 * stacking up redundant/conflicting override records.
 */

let pendingByWeek = new Map(); // weekKey -> Map<identityKey, changeRecord>

function identityKey(action, slot) {
    if (action === 'ADD_EXTRA') {
        // Extras are brand new occurrences — always unique.
        return `EXTRA_${slot.facultyId}_${slot.sectionId}_${slot.subjectCode}_${slot.day}_${slot.starting}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }
    // CANCEL / RESCHEDULE key off the identity of the ORIGINAL occurrence,
    // so a second edit to the same class overwrites the first pending entry.
    return slot.sessionId || `${slot.facultyId}_${slot.sectionId}_${slot.subjectCode}_${slot.day}_${slot.starting}`;
}

/**
 * Record a change. For CANCEL, only originalSlot matters.
 * For RESCHEDULE / ADD_EXTRA, both originalSlot (may be null for ADD_EXTRA)
 * and targetSlot are recorded.
 */
function record({ weekKey, action, scope, originalSlot = null, targetSlot = null }) {
    if (!pendingByWeek.has(weekKey)) pendingByWeek.set(weekKey, new Map());
    const bucket = pendingByWeek.get(weekKey);
    const key = identityKey(action, originalSlot || targetSlot);
    bucket.set(key, { action, scope, originalSlot, targetSlot, updatedAt: Date.now() });
}

function getAll() {
    const out = [];
    for (const [weekKey, bucket] of pendingByWeek) {
        for (const [key, change] of bucket) {
            out.push({ weekKey, key, ...change });
        }
    }
    return out;
}

function clear() {
    pendingByWeek = new Map();
}

function count() {
    let n = 0;
    for (const bucket of pendingByWeek.values()) n += bucket.size;
    return n;
}

module.exports = { record, getAll, clear, count };
