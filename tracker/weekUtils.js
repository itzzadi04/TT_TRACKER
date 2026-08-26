/**
 * Academic Calendar & Week Utility for TT_TRACKER.
 * Institution Timezone: Asia/Kolkata (NIT Hamirpur).
 * 
 * Rules:
 * - Monday–Sunday definition for academic weeks.
 * - Monday–Friday: Current Week EDITABLE, Next Week READ-ONLY (can schedule extra from Current Week).
 * - Saturday–Sunday: Current Week READ-ONLY, Next Week EDITABLE.
 * - Next Monday: Rollover occurs automatically based on the real calendar.
 * - In Production (DEV_MODE=false), real system date in Asia/Kolkata is the authoritative source.
 */

const TIMEZONE = 'Asia/Kolkata';

// Get current date components in Asia/Kolkata timezone
function getKolkataDateParts(date = new Date()) {
    // Format to parts in Asia/Kolkata
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'long'
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });

    const year = parseInt(map.year, 10);
    const month = parseInt(map.month, 10); // 1-12
    const day = parseInt(map.day, 10);
    const weekday = map.weekday; // 'Monday', 'Tuesday', ...

    const weekdayMap = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    const dayOfWeek = weekdayMap[weekday] !== undefined ? weekdayMap[weekday] : 1;

    return {
        year,
        month,
        day,
        weekday,
        dayOfWeek,
        // Create pure local UTC representation for date math
        localMidnight: new Date(Date.UTC(year, month - 1, day))
    };
}

// Format Date object to "YYYY-MM-DD"
function formatYYYYMMDD(d) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format Date object to "DD Mon YYYY" (e.g. "24 Aug 2026")
function formatDisplayDate(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
}

// Calculate ISO 8601 Week Key (e.g. "2026-W35")
function calculateISOWeekKey(utcDate) {
    const target = new Date(utcDate.getTime());
    const dayNr = (target.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
    target.setUTCDate(target.getUTCDate() - dayNr + 3); // Nearest Thursday
    const firstThursday = target.getTime();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
    const year = new Date(firstThursday).getUTCFullYear();
    return {
        weekKey: `${year}-W${String(weekNumber).padStart(2, '0')}`,
        weekNumber,
        year
    };
}

/**
 * Centralized Academic Week State Calculator
 */
function getAcademicWeekState({ simulatedDay = null, devMode = false, baseDate = new Date() } = {}) {
    const isDev = devMode === true || process.env.DEV_MODE === 'true';
    const kolkata = getKolkataDateParts(baseDate);

    let effectiveDayOfWeek = kolkata.dayOfWeek;
    let effectiveWeekday = kolkata.weekday;

    // Simulated day is permitted ONLY when devMode is active
    if (isDev && simulatedDay) {
        const daysMap = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        };
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const normalized = simulatedDay.toLowerCase();
        if (daysMap[normalized] !== undefined) {
            effectiveDayOfWeek = daysMap[normalized];
            effectiveWeekday = dayNames[effectiveDayOfWeek];
        }
    }

    // Determine current week Monday and Sunday in Asia/Kolkata
    // If today is Sunday (dayOfWeek === 0), diff to Monday is -6 days. Otherwise diff is -(dayOfWeek - 1).
    const diffToMonday = kolkata.dayOfWeek === 0 ? -6 : 1 - kolkata.dayOfWeek;
    
    const currMonday = new Date(kolkata.localMidnight.getTime());
    currMonday.setUTCDate(currMonday.getUTCDate() + diffToMonday);

    const currSunday = new Date(currMonday.getTime());
    currSunday.setUTCDate(currSunday.getUTCDate() + 6);

    const nextMonday = new Date(currMonday.getTime());
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

    const nextSunday = new Date(nextMonday.getTime());
    nextSunday.setUTCDate(nextSunday.getUTCDate() + 6);

    const currISO = calculateISOWeekKey(currMonday);
    const nextISO = calculateISOWeekKey(nextMonday);

    const isWeekday = effectiveDayOfWeek >= 1 && effectiveDayOfWeek <= 5;
    const isWeekend = effectiveDayOfWeek === 0 || effectiveDayOfWeek === 6;

    // Full localized string e.g. "Wednesday, 26 August 2026"
    const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const todayFormatted = `${effectiveWeekday}, ${kolkata.day} ${monthsFull[kolkata.month - 1]} ${kolkata.year}`;

    return {
        timezone: TIMEZONE,
        devMode: isDev,
        today: formatYYYYMMDD(kolkata.localMidnight),
        todayFormatted,
        dayOfWeek: effectiveDayOfWeek,
        dayName: effectiveWeekday,
        isWeekday,
        isWeekend,
        
        // Current Week Range & Keys
        currentWeekStartDate: formatYYYYMMDD(currMonday),
        currentWeekEndDate: formatYYYYMMDD(currSunday),
        currentWeekFormatted: `${formatDisplayDate(currMonday)} – ${formatDisplayDate(currSunday)}`,
        currentWeekKey: currISO.weekKey,
        currentWeekNumber: currISO.weekNumber,

        // Next Week Range & Keys
        nextWeekStartDate: formatYYYYMMDD(nextMonday),
        nextWeekEndDate: formatYYYYMMDD(nextSunday),
        nextWeekFormatted: `${formatDisplayDate(nextMonday)} – ${formatDisplayDate(nextSunday)}`,
        nextWeekKey: nextISO.weekKey,
        nextWeekNumber: nextISO.weekNumber,

        // Operational Permissions
        currentWeekEditable: isWeekday,
        nextWeekEditable: isWeekend,
        currentWeekStatus: isWeekday ? 'EDITABLE' : 'READ-ONLY',
        nextWeekStatus: isWeekend ? 'EDITABLE' : 'READ-ONLY (SCHEDULE FROM CURRENT WEEK ALLOWED)'
    };
}

// Helpers for backward-compatible weekUtils exports
function getMondayDate(date = new Date()) {
    const state = getAcademicWeekState({ baseDate: date });
    return state.currentWeekStartDate;
}

function getWeekKey(date = new Date()) {
    const parts = getKolkataDateParts(date);
    return calculateISOWeekKey(parts.localMidnight).weekKey;
}

function getCurrentWeekKey() {
    return getAcademicWeekState().currentWeekKey;
}

function getNextWeekKey() {
    return getAcademicWeekState().nextWeekKey;
}

function getWeekKeyByOffset(offset = 0) {
    const now = new Date();
    const shifted = new Date(now.getTime() + offset * 7 * 86400000);
    return getWeekKey(shifted);
}

function resolveWeekKey(inputWeek) {
    const state = getAcademicWeekState();
    if (!inputWeek || inputWeek === 'current') {
        return { isBase: false, weekKey: state.currentWeekKey, label: 'current' };
    }
    if (inputWeek === 'next') {
        return { isBase: false, weekKey: state.nextWeekKey, label: 'next' };
    }
    if (inputWeek === 'base' || inputWeek === 'permanent') {
        return { isBase: true, weekKey: 'base', label: 'base' };
    }
    return { isBase: false, weekKey: inputWeek, label: inputWeek };
}

module.exports = {
    TIMEZONE,
    getAcademicWeekState,
    getMondayDate,
    getWeekKey,
    getCurrentWeekKey,
    getNextWeekKey,
    getWeekKeyByOffset,
    resolveWeekKey
};
