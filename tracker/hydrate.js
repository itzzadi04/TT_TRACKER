const registry = require('./Registry');
const { computeEffectiveSchedule } = require('./effectiveSchedule');
const { getCurrentWeekKey, getNextWeekKey } = require('./weekUtils');

/**
 * Hydrate Registry from MongoDB.
 * Computes:
 * 1. Base / Permanent Timetable Blueprint ('base')
 * 2. Current Week Effective Schedule ('current')
 * 3. Next Week Effective Schedule ('next')
 */
async function hydrate() {
    console.log('[Hydration] Clearing in-memory registry...');
    registry.clear();

    const currentWeekKey = getCurrentWeekKey();
    const nextWeekKey = getNextWeekKey();

    console.log(`[Hydration] Loading Base timetable and effective schedules for Current (${currentWeekKey}) & Next (${nextWeekKey})...`);

    // 1. Base Blueprint
    const baseList = await computeEffectiveSchedule('base');
    for (const slot of baseList) {
        registry.addSlot('base', slot);
    }

    // 2. Current Week Effective
    const currentList = await computeEffectiveSchedule(currentWeekKey);
    for (const slot of currentList) {
        registry.addSlot('current', slot);
    }

    // 3. Next Week Effective
    const nextList = await computeEffectiveSchedule(nextWeekKey);
    for (const slot of nextList) {
        registry.addSlot('next', slot);
    }

    console.log(`[Hydration] Hydration complete: Base (${baseList.length}), Current (${currentList.length}), Next (${nextList.length})`);
}

module.exports = { hydrate };