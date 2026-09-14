const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Time = require('../models/Time');
const TimetableSlot = require('../models/TimetableSlot');
const ScheduleOverride = require('../models/ScheduleOverride');
const { hydrate } = require('../tracker/hydrate');

/**
 * Centralized Authoritative M.Tech Section Compatibility Map
 * Explicitly maps FATGS M.Tech identifiers (MT1, MA1, MT, MA) to canonical TT_TRACKER section documents.
 */
const MTECH_SECTION_COMPATIBILITY = {
    'MT1': { section: 'MTECH-CSE', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-CSE' },
    'MA1': { section: 'MTECH-AI', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-AI' },
    'MT': { section: 'MTECH-CSE', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-CSE' },
    'MA': { section: 'MTECH-AI', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-AI' },
    'MTECH-CSE': { section: 'MTECH-CSE', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-CSE' },
    'MTECH-AI': { section: 'MTECH-AI', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-AI' },
    'MTECH_CSE': { section: 'MTECH-CSE', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-CSE' },
    'MTECH_AI': { section: 'MTECH-AI', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-AI' },
    'MTECH_CSE_AI': { section: 'MTECH-AI', year: 1, semester: 1, sectionId: 'Y1_S1_MTECH-AI' }
};

/**
 * Standardize time string into HH:MM (e.g. "9:00" -> "09:00")
 */
function padTime(t) {
    if (!t || typeof t !== 'string') return null;
    const parts = t.trim().split(':');
    if (parts.length < 2) return null;
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Convert time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Check if two time intervals overlap on the same day
 */
function isOverlapping(startA, endA, startB, endB) {
    const a1 = timeToMinutes(startA);
    const a2 = timeToMinutes(endA);
    const b1 = timeToMinutes(startB);
    const b2 = timeToMinutes(endB);
    return Math.max(a1, b1) < Math.min(a2, b2);
}

/**
 * Parse year to number (supports "2nd Year", "2", 2, "Final Year" -> 4, "M.Tech" -> 1, etc.)
 */
function parseYear(rawYear) {
    if (rawYear === undefined || rawYear === null) return null;
    if (typeof rawYear === 'number') return rawYear;
    const str = String(rawYear).trim().toLowerCase();
    if (str.includes('1st') || str.includes('first') || str.includes('1')) return 1;
    if (str.includes('2nd') || str.includes('second') || str.includes('2')) return 2;
    if (str.includes('3rd') || str.includes('third') || str.includes('3')) return 3;
    if (str.includes('4th') || str.includes('fourth') || str.includes('final') || str.includes('4')) return 4;
    if (str.includes('5th') || str.includes('fifth') || str.includes('5')) return 5;
    return null;
}

/**
 * Parse semester to number (supports "3rd Semester", "3", 3, etc.)
 */
function parseSemester(rawSem) {
    if (rawSem === undefined || rawSem === null) return null;
    if (typeof rawSem === 'number') return rawSem;
    const str = String(rawSem).trim().toLowerCase();
    const match = str.match(/\d+/);
    if (match) return parseInt(match[0], 10);
    return null;
}

/**
 * Normalize section name (e.g. "CS2" -> "CS", "CD3" -> "CD")
 * IMPORTANT: Protects M.Tech identifiers (MT1, MA1, MT, MA) from trailing digit stripping.
 */
function normalizeSectionName(rawSec) {
    if (!rawSec) return '';
    const str = String(rawSec).trim().toUpperCase();

    // 1. Explicit M.Tech check
    if (MTECH_SECTION_COMPATIBILITY[str]) {
        return MTECH_SECTION_COMPATIBILITY[str].section;
    }

    // 2. Protect M.Tech prefixes
    if (str.startsWith('MT') || str.startsWith('MA') || str.startsWith('MTECH')) {
        return str;
    }

    // 3. Strip trailing digits for B.Tech sections (CS2 -> CS, CD3 -> CD, CS4 -> CS)
    if (/^[A-Z]{2,}\d+$/.test(str)) {
        return str.replace(/\d+$/, '');
    }
    return str;
}

/**
 * Resolves a ClassSection document from incoming slot representations
 * Enforces strict Odd / Even semester isolation:
 * - Odd packages reject Even semester sections/slots
 * - Even packages reject Odd semester sections/slots
 * - Never crosses semester boundaries
 */
function resolveClassSection(slot, sectionMaps, normalizedSemesterType) {
    const { bySectionId, byYearSemSec } = sectionMaps;
    const isExpectedOdd = (normalizedSemesterType === 'odd');

    // 1. Check centralized M.Tech mapping first (e.g. MT1, MA1)
    const rawId = (slot.sectionId || slot.section || '').toString().trim().toUpperCase();
    if (MTECH_SECTION_COMPATIBILITY[rawId]) {
        const mapped = MTECH_SECTION_COMPATIBILITY[rawId];
        const isMappedOdd = (mapped.semester % 2 === 1);
        if (isMappedOdd !== isExpectedOdd) {
            return {
                error: `M.Tech section "${rawId}" belongs to Semester ${mapped.semester}, which does not match package semesterType "${isExpectedOdd ? 'Odd' : 'Even'}".`
            };
        }
        const secDoc = bySectionId.get(mapped.sectionId) || byYearSemSec.get(`${mapped.year}_${mapped.semester}_${mapped.section}`);
        if (secDoc) return { sectionDoc: secDoc };
        return {
            error: `Class section "${mapped.sectionId}" for M.Tech does not exist in TT_TRACKER registry.`
        };
    }

    // 2. Direct sectionId check in TT_TRACKER database
    if (rawId && bySectionId.has(rawId)) {
        const secDoc = bySectionId.get(rawId);
        const isSecOdd = (secDoc.semester % 2 === 1);
        if (isSecOdd !== isExpectedOdd) {
            return {
                error: `ClassSection "${secDoc.sectionId}" has semester ${secDoc.semester}, which violates package semesterType "${isExpectedOdd ? 'Odd' : 'Even'}".`
            };
        }
        return { sectionDoc: secDoc };
    }

    // 3. Structured resolution with year, semester, and normalized section
    const parsedYear = parseYear(slot.year);
    let parsedSem = parseSemester(slot.semester);
    const normSec = normalizeSectionName(slot.section || slot.sectionId);

    // If semester was not explicitly specified on the slot, infer based on academic year and semesterType
    if (parsedSem === null && parsedYear !== null) {
        if (isExpectedOdd) {
            parsedSem = parsedYear === 1 ? 1 : (parsedYear * 2 - 1);
        } else {
            parsedSem = parsedYear * 2;
        }
    }

    // Enforce semester parity against package semesterType
    if (parsedSem !== null) {
        const isSlotSemOdd = (parsedSem % 2 === 1);
        if (isSlotSemOdd !== isExpectedOdd) {
            return {
                error: `Slot specifies Semester ${parsedSem}, which does not match package semesterType "${isExpectedOdd ? 'Odd' : 'Even'}".`
            };
        }
    }

    if (parsedYear !== null && parsedSem !== null && normSec) {
        const key = `${parsedYear}_${parsedSem}_${normSec}`;
        if (byYearSemSec.has(key)) {
            return { sectionDoc: byYearSemSec.get(key) };
        }
        const synthId = `Y${parsedYear}_S${parsedSem}_${normSec}`;
        if (bySectionId.has(synthId)) {
            return { sectionDoc: bySectionId.get(synthId) };
        }
    }

    return {
        error: `Unknown or unresolvable class section "${slot.sectionId || slot.section}" for ${isExpectedOdd ? 'Odd' : 'Even'} semester. Section must exist in TT_TRACKER section registry.`
    };
}

/**
 * Extracts academic master entities from incoming FATGS package
 * Normalizes entity definitions so TT_TRACKER can synchronize them into MongoDB.
 */
function extractMasterData(body, rawSlots, canonicalSemesterType) {
    const roomsMap = new Map();
    const facultyMap = new Map();
    const subjectMap = new Map();
    const sectionMap = new Map();
    const timeMap = new Map();

    // 1. Authoritative Rooms extraction
    const rawRooms = Array.isArray(body.rooms) ? body.rooms : [];
    for (const r of rawRooms) {
        if (!r || typeof r !== 'object') continue;
        const roomNo = String(r.roomNo || r.room || '').trim().toUpperCase();
        if (!roomNo) continue;

        let labOrClass = 'Class';
        if (r.labOrClass && (r.labOrClass.toLowerCase() === 'lab' || r.labOrClass.toLowerCase() === 'class')) {
            labOrClass = r.labOrClass.toLowerCase() === 'lab' ? 'Lab' : 'Class';
        } else if (r.isLab === true) {
            labOrClass = 'Lab';
        } else if (roomNo.startsWith('P')) {
            labOrClass = 'Lab';
        }

        let building = (r.building || '').trim();
        if (!building) {
            if (roomNo.startsWith('P')) {
                building = 'DoCSE Block A Top Floor';
            } else {
                building = 'Vivekanand Lecture Hall';
            }
        }

        roomsMap.set(roomNo, {
            roomNo,
            labOrClass,
            building
        });
    }

    // 2. Authoritative Faculty extraction
    const rawFaculties = Array.isArray(body.faculties) ? body.faculties : (Array.isArray(body.faculty) ? body.faculty : []);
    for (const f of rawFaculties) {
        if (!f || typeof f !== 'object') continue;
        const facultyId = String(f.facultyId || f.facultyCode || f.code || '').trim().toUpperCase();
        if (!facultyId) continue;
        const name = String(f.name || f.facultyFullName || f.fullName || facultyId).trim();
        facultyMap.set(facultyId, {
            facultyId,
            name
        });
    }

    // 3. Authoritative Subjects extraction
    const rawSubjects = Array.isArray(body.subjects) ? body.subjects : (Array.isArray(body.subject) ? body.subject : []);
    for (const s of rawSubjects) {
        if (!s || typeof s !== 'object') continue;
        const subjectCode = String(s.subjectCode || s.code || '').trim().toUpperCase();
        if (!subjectCode) continue;
        const name = String(s.name || s.subjectName || subjectCode).trim();
        subjectMap.set(subjectCode, {
            subjectCode,
            name
        });
    }

    // 4. Authoritative Sections extraction
    const rawSections = Array.isArray(body.sections) ? body.sections : (Array.isArray(body.classSections) ? body.classSections : []);
    for (const sec of rawSections) {
        if (!sec) continue;
        if (typeof sec === 'string') {
            const str = sec.trim().toUpperCase();
            if (MTECH_SECTION_COMPATIBILITY[str]) {
                const mapped = MTECH_SECTION_COMPATIBILITY[str];
                const sem = (canonicalSemesterType === 'Odd') ? 1 : 2;
                const secId = (canonicalSemesterType === 'Odd') ? mapped.sectionId : `Y1_S2_${mapped.section}`;
                sectionMap.set(secId, {
                    year: mapped.year,
                    semester: sem,
                    section: mapped.section,
                    sectionId: secId
                });
            } else {
                const normSec = normalizeSectionName(str);
                const match = str.match(/\d+$/);
                const yr = match ? parseInt(match[0], 10) : 2;
                const sem = (canonicalSemesterType === 'Odd') ? (yr === 1 ? 1 : (yr * 2 - 1)) : (yr * 2);
                const secId = `Y${yr}_S${sem}_${normSec}`;
                sectionMap.set(secId, {
                    year: yr,
                    semester: sem,
                    section: normSec,
                    sectionId: secId
                });
            }
        } else if (typeof sec === 'object') {
            const rawId = (sec.section || sec.originalSection || sec.sectionId || '').toString().trim().toUpperCase();
            if (MTECH_SECTION_COMPATIBILITY[rawId]) {
                const mapped = MTECH_SECTION_COMPATIBILITY[rawId];
                const sem = (canonicalSemesterType === 'Odd') ? 1 : 2;
                const secId = (canonicalSemesterType === 'Odd') ? mapped.sectionId : `Y1_S2_${mapped.section}`;
                sectionMap.set(secId, {
                    year: mapped.year,
                    semester: sem,
                    section: mapped.section,
                    sectionId: secId
                });
            } else {
                const yr = parseYear(sec.year);
                let sem = parseSemester(sec.semester);
                const normSec = normalizeSectionName(sec.section || sec.originalSection || rawId);
                if (sem === null && yr !== null) {
                    sem = (canonicalSemesterType === 'Odd') ? (yr === 1 ? 1 : (yr * 2 - 1)) : (yr * 2);
                }
                if (yr !== null && sem !== null && normSec) {
                    const secId = sec.sectionId && !sec.sectionId.includes('Year') && !sec.sectionId.includes('Semester')
                        ? sec.sectionId
                        : `Y${yr}_S${sem}_${normSec}`;
                    sectionMap.set(secId, {
                        year: yr,
                        semester: sem,
                        section: normSec,
                        sectionId: secId
                    });
                }
            }
        }
    }

    // 5. Authoritative Times extraction
    const rawTimes = Array.isArray(body.times) ? body.times : [];
    for (const t of rawTimes) {
        if (!t || typeof t !== 'object') continue;
        const day = t.day ? t.day.trim() : null;
        const starting = padTime(t.start || t.starting);
        const ending = padTime(t.end || t.ending);
        if (day && starting && ending) {
            timeMap.set(`${day}|${starting}|${ending}`, { day, starting, ending });
        }
    }

    return {
        rooms: Array.from(roomsMap.values()),
        faculties: Array.from(facultyMap.values()),
        subjects: Array.from(subjectMap.values()),
        sections: Array.from(sectionMap.values()),
        times: Array.from(timeMap.values())
    };
}

/**
 * Synchronizes academic master entities into MongoDB collections
 * Uses safe upsert semantics ensuring idempotency and preventing duplicate documents.
 */
async function synchronizeMasterData(masterData, session) {
    const opt = session ? { session } : {};

    // 1. Rooms
    if (Array.isArray(masterData.rooms) && masterData.rooms.length > 0) {
        for (const r of masterData.rooms) {
            await Room.findOneAndUpdate(
                { roomNo: r.roomNo },
                {
                    $setOnInsert: { roomNo: r.roomNo },
                    $set: {
                        labOrClass: r.labOrClass,
                        building: r.building
                    }
                },
                { upsert: true, returnDocument: 'after', runValidators: true, ...opt }
            );
        }
    }

    // 2. Faculties
    if (Array.isArray(masterData.faculties) && masterData.faculties.length > 0) {
        for (const f of masterData.faculties) {
            await Faculty.findOneAndUpdate(
                { facultyId: f.facultyId },
                {
                    $setOnInsert: { facultyId: f.facultyId },
                    $set: { name: f.name }
                },
                { upsert: true, returnDocument: 'after', runValidators: true, ...opt }
            );
        }
    }

    // 3. Subjects
    if (Array.isArray(masterData.subjects) && masterData.subjects.length > 0) {
        for (const s of masterData.subjects) {
            await Subject.findOneAndUpdate(
                { subjectCode: s.subjectCode },
                {
                    $setOnInsert: { subjectCode: s.subjectCode },
                    $set: { name: s.name }
                },
                { upsert: true, returnDocument: 'after', runValidators: true, ...opt }
            );
        }
    }

    // 4. ClassSections
    if (Array.isArray(masterData.sections) && masterData.sections.length > 0) {
        for (const cs of masterData.sections) {
            const existingSec = await ClassSection.findOne({
                $or: [
                    { sectionId: cs.sectionId },
                    { year: cs.year, section: cs.section, semester: cs.semester }
                ]
            }, null, opt);

            if (existingSec) {
                await ClassSection.updateOne(
                    { _id: existingSec._id },
                    {
                        $set: {
                            sectionId: cs.sectionId,
                            section: cs.section,
                            year: cs.year,
                            semester: cs.semester
                        }
                    },
                    opt
                );
            } else {
                await ClassSection.create([{
                    year: cs.year,
                    section: cs.section,
                    semester: cs.semester,
                    sectionId: cs.sectionId
                }], opt);
            }
        }
    }

    // 5. Times
    if (Array.isArray(masterData.times) && masterData.times.length > 0) {
        for (const t of masterData.times) {
            const existingTime = await Time.findOne({ day: t.day, starting: t.starting, ending: t.ending }, null, opt);
            if (!existingTime) {
                await Time.create([{ day: t.day, starting: t.starting, ending: t.ending }], opt);
            }
        }
    }
}

/**
 * Main Timetable Import Controller Handler
 * Handles both POST /api/timetable/import (canonical) and POST /api/timetable/import-base (alias).
 */
async function handleTimetableImport(req, res) {
    const errorResponse = (status, msg) => {
        console.error(`[IMPORT FAILURE] ${msg}`);
        return res.status(status).json({
            success: false,
            message: msg,
            error: msg,
            errors: [msg]
        });
    };

    // ── 1. Authentication Check ──
    const expectedSecret = process.env.TT_TRACKER_IMPORT_SECRET;
    if (!expectedSecret) {
        console.error('[IMPORT FAILURE] TT_TRACKER_IMPORT_SECRET is not configured in server environment.');
        return res.status(500).json({
            success: false,
            message: 'Server configuration error: Import authentication secret is not configured.',
            error: 'Server configuration error: Import authentication secret is not configured.',
            errors: ['Server configuration error: Import authentication secret is not configured.']
        });
    }

    // Support canonical x-import-secret, authorization Bearer, and compatibility x-api-key / x-tt-tracker-import-secret
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-import-secret'] || req.headers['x-api-key'] || req.headers['x-tt-tracker-import-secret'];
    let providedSecret = customHeader;

    if (!providedSecret && authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            providedSecret = authHeader.slice(7).trim();
        } else {
            providedSecret = authHeader.trim();
        }
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        return errorResponse(401, 'Unauthorized: Invalid or missing import secret.');
    }

    // ── 2. Payload Extraction & Normalization ──
    let rawSlots = null;
    let academicYear = null;
    let semesterType = null;
    let packageId = null;

    if (Array.isArray(req.body)) {
        // Direct array payload
        rawSlots = req.body;
        packageId = `PKG_${Date.now()}`;
        academicYear = '2026-2027';
        semesterType = 'Odd';
    } else if (req.body && typeof req.body === 'object') {
        // Canonical 'slots' array or compatibility 'timetable' array
        rawSlots = req.body.slots || req.body.timetable || null;
        packageId = req.body.packageId || req.body.id || null;
        academicYear = req.body.academicYear || req.body.year || null;
        semesterType = req.body.semesterType || req.body.semester || null;
    }

    // Package-level validation
    if (!rawSlots) {
        return errorResponse(400, 'Malformed payload: Expected array of timetable slots or object containing a "slots" or "timetable" array.');
    }

    if (!packageId || typeof packageId !== 'string' || !packageId.trim()) {
        return errorResponse(400, 'Missing or invalid required field: "packageId" is required.');
    }

    if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
        return errorResponse(400, 'Missing or invalid required field: "academicYear" is required.');
    }

    if (!semesterType || typeof semesterType !== 'string') {
        return errorResponse(400, 'Missing or invalid required field: "semesterType" is required (must be "Odd" or "Even").');
    }

    const normSemesterType = semesterType.trim().toLowerCase();
    if (normSemesterType !== 'odd' && normSemesterType !== 'even') {
        return errorResponse(400, `Invalid semesterType "${semesterType}": Must be "Odd" or "Even".`);
    }

    // Standardize casing for responses
    const canonicalSemesterType = normSemesterType === 'odd' ? 'Odd' : 'Even';

    if (rawSlots.length === 0) {
        return errorResponse(400, 'Payload is empty: A complete semester timetable package with slots is required.');
    }

    console.log(`[IMPORT START] packageId: ${packageId}, academicYear: ${academicYear}, semesterType: ${canonicalSemesterType}, slots: ${rawSlots.length}`);

    // ── 3. Extract Master Data from Package ──
    const masterData = extractMasterData(req.body, rawSlots, canonicalSemesterType);
    console.log(`[IMPORT MASTER DATA] Extracted ${masterData.rooms.length} rooms, ${masterData.faculties.length} faculties, ${masterData.subjects.length} subjects, ${masterData.sections.length} sections from package.`);

    // ── 4. Transactional Master Data Synchronization & Timetable Replacement ──
    let session = null;
    let useTransaction = false;

    try {
        session = await mongoose.startSession();
        useTransaction = true;
    } catch (txnInitErr) {
        console.warn('[IMPORT DATABASE] MongoDB session not available, falling back to sequential execution:', txnInitErr.message);
        session = null;
        useTransaction = false;
    }

    try {
        let newDbSlots = [];

        const executeImportPipeline = async (sess) => {
            const opt = sess ? { session: sess } : {};

            // Step 4A: Synchronize Academic Master Data into MongoDB
            await synchronizeMasterData(masterData, sess);

            // Step 4B: Load freshly synchronized Reference Collections from MongoDB sequentially (sessions do not permit concurrent operations)
            const faculties = await Faculty.find({}, null, opt).lean();
            const rooms = await Room.find({}, null, opt).lean();
            const subjects = await Subject.find({}, null, opt).lean();
            const classSections = await ClassSection.find({}, null, opt).lean();
            const existingTimes = await Time.find({}, null, opt).lean();

            const facultyMap = new Map();
            for (const f of faculties) {
                if (f.facultyId) facultyMap.set(f.facultyId.toUpperCase(), f);
                if (f.name) facultyMap.set(f.name.toLowerCase().trim(), f);
            }

            const roomMap = new Map();
            for (const r of rooms) {
                if (r.roomNo) roomMap.set(r.roomNo.toUpperCase().trim(), r);
            }

            const subjectMap = new Map();
            for (const s of subjects) {
                if (s.subjectCode) subjectMap.set(s.subjectCode.toUpperCase().trim(), s);
            }

            const sectionMaps = {
                bySectionId: new Map(),
                byYearSemSec: new Map()
            };
            for (const cs of classSections) {
                if (cs.sectionId) sectionMaps.bySectionId.set(cs.sectionId.toUpperCase().trim(), cs);
                if (cs.year && cs.semester && cs.section) {
                    sectionMaps.byYearSemSec.set(`${cs.year}_${cs.semester}_${cs.section.toUpperCase().trim()}`, cs);
                }
            }

            const timeMap = new Map();
            for (const t of existingTimes) {
                timeMap.set(`${t.day}|${t.starting}|${t.ending}`, t);
            }

            const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

            // Step 4C: Item-by-Item Reference & Semantic Validation
            const validatedSlots = [];
            const timesToEnsure = [];

            for (let i = 0; i < rawSlots.length; i++) {
                const slot = rawSlots[i];
                const slotNum = i + 1;

                if (!slot || typeof slot !== 'object') {
                    const err = new Error(`Slot #${slotNum} is invalid or malformed.`);
                    err.status = 422;
                    throw err;
                }

                // Day validation
                const day = slot.day ? slot.day.trim() : null;
                if (!day || !validDays.has(day)) {
                    const err = new Error(`Slot #${slotNum}: Invalid or missing day "${day}". Must be Monday through Saturday.`);
                    err.status = 422;
                    throw err;
                }

                // Time validation
                const starting = padTime(slot.start || slot.starting);
                const ending = padTime(slot.end || slot.ending);
                if (!starting || !ending) {
                    const err = new Error(`Slot #${slotNum}: Missing or invalid start/end time. Received start: "${slot.start || slot.starting}", end: "${slot.end || slot.ending}".`);
                    err.status = 422;
                    throw err;
                }
                if (timeToMinutes(starting) >= timeToMinutes(ending)) {
                    const err = new Error(`Slot #${slotNum}: Starting time (${starting}) must be before ending time (${ending}).`);
                    err.status = 422;
                    throw err;
                }

                // Subject resolution
                const rawSubjectCode = (slot.subjectCode || slot.subject || '').toString().trim().toUpperCase();
                if (!rawSubjectCode) {
                    const err = new Error(`Slot #${slotNum}: Missing subject code.`);
                    err.status = 422;
                    throw err;
                }
                const subjectDoc = subjectMap.get(rawSubjectCode);
                if (!subjectDoc) {
                    const err = new Error(`Slot #${slotNum}: Unknown subject code "${rawSubjectCode}". Subject must exist in TT_TRACKER subject registry or package master data.`);
                    err.status = 422;
                    throw err;
                }

                // Faculty resolution
                const rawFaculty = (slot.facultyId || slot.facultyCode || slot.faculty || '').toString().trim();
                if (!rawFaculty) {
                    const err = new Error(`Slot #${slotNum}: Missing faculty identifier for subject ${rawSubjectCode}.`);
                    err.status = 422;
                    throw err;
                }
                const facultyDoc = facultyMap.get(rawFaculty.toUpperCase()) || facultyMap.get(rawFaculty.toLowerCase());
                if (!facultyDoc) {
                    const err = new Error(`Slot #${slotNum}: Unknown faculty "${rawFaculty}". Faculty must exist in TT_TRACKER faculty registry or package master data.`);
                    err.status = 422;
                    throw err;
                }

                // Room resolution
                const rawRoom = (slot.roomNo || slot.room || '').toString().trim().toUpperCase();
                if (!rawRoom) {
                    const err = new Error(`Slot #${slotNum}: Missing room identifier.`);
                    err.status = 422;
                    throw err;
                }
                const roomDoc = roomMap.get(rawRoom);
                if (!roomDoc) {
                    const err = new Error(`Slot #${slotNum}: Unknown room "${rawRoom}". Room must exist in TT_TRACKER room registry or package master data.`);
                    err.status = 422;
                    throw err;
                }

                // Section resolution with strict Odd / Even semester isolation & M.Tech mapping
                const secResult = resolveClassSection(slot, sectionMaps, normSemesterType);
                if (secResult.error) {
                    const err = new Error(`Slot #${slotNum}: ${secResult.error}`);
                    err.status = 422;
                    throw err;
                }
                const sectionDoc = secResult.sectionDoc;

                // Duration & Lab resolution
                const duration = Number(slot.duration) || (timeToMinutes(ending) - timeToMinutes(starting)) / 60;
                const isLab = Boolean(slot.isLab);
                const group = slot.group ? String(slot.group).trim() : null;

                // Session ID preservation
                const sessionId = slot.sessionId
                    ? String(slot.sessionId).trim()
                    : `${facultyDoc.facultyId}_${sectionDoc.sectionId}_${subjectDoc.subjectCode}_${day}_${starting}${group ? '_' + group : ''}`;

                const timeKey = `${day}|${starting}|${ending}`;
                if (!timeMap.has(timeKey)) {
                    timesToEnsure.push({ day, starting, ending });
                }

                validatedSlots.push({
                    index: i,
                    faculty: facultyDoc,
                    classSection: sectionDoc,
                    subject: subjectDoc,
                    room: roomDoc,
                    day,
                    starting,
                    ending,
                    timeKey,
                    duration: Math.max(1, duration),
                    isLab,
                    group,
                    sessionId,
                    isFixed: slot.isFixed !== undefined ? Boolean(slot.isFixed) : true,
                    isOccupied: slot.isOccupied !== undefined ? Boolean(slot.isOccupied) : true
                });
            }

            // Step 4D: Pre-flight Duplicate & Conflict Validation
            const slotDedupeKeys = new Set();
            const facultyBookings = [];
            const roomBookings = [];
            const sectionBookings = [];

            for (const vs of validatedSlots) {
                // Check exact duplicate slot
                const dedupeKey = `${vs.faculty.facultyId}|${vs.classSection.sectionId}|${vs.subject.subjectCode}|${vs.day}|${vs.starting}|${vs.ending}|${vs.group || ''}`;
                if (slotDedupeKeys.has(dedupeKey)) {
                    const err = new Error(`Duplicate timetable record in package for section ${vs.classSection.sectionId}, subject ${vs.subject.subjectCode} at ${vs.day} ${vs.starting}-${vs.ending}.`);
                    err.status = 422;
                    throw err;
                }
                slotDedupeKeys.add(dedupeKey);

                // Faculty double-booking check
                for (const prev of facultyBookings) {
                    if (prev.facultyId === vs.faculty.facultyId && prev.day === vs.day) {
                        if (isOverlapping(prev.starting, prev.ending, vs.starting, vs.ending)) {
                            if (prev.sessionId !== vs.sessionId) {
                                const err = new Error(`Faculty conflict in import package: Faculty ${vs.faculty.facultyId} is scheduled concurrently for section ${prev.sectionId} and ${vs.classSection.sectionId} on ${vs.day} (${vs.starting}-${vs.ending}).`);
                                err.status = 422;
                                throw err;
                            }
                        }
                    }
                }
                facultyBookings.push({
                    facultyId: vs.faculty.facultyId,
                    sectionId: vs.classSection.sectionId,
                    day: vs.day,
                    starting: vs.starting,
                    ending: vs.ending,
                    sessionId: vs.sessionId
                });

                // Room double-booking check
                for (const prev of roomBookings) {
                    if (prev.roomNo === vs.room.roomNo && prev.day === vs.day) {
                        if (isOverlapping(prev.starting, prev.ending, vs.starting, vs.ending)) {
                            if (prev.sessionId !== vs.sessionId) {
                                const err = new Error(`Room conflict in import package: Room ${vs.room.roomNo} is booked concurrently for ${prev.sectionId} and ${vs.classSection.sectionId} on ${vs.day} (${vs.starting}-${vs.ending}).`);
                                err.status = 422;
                                throw err;
                            }
                        }
                    }
                }
                roomBookings.push({
                    roomNo: vs.room.roomNo,
                    sectionId: vs.classSection.sectionId,
                    day: vs.day,
                    starting: vs.starting,
                    ending: vs.ending,
                    sessionId: vs.sessionId
                });

                // Section concurrency check
                for (const prev of sectionBookings) {
                    if (prev.sectionId === vs.classSection.sectionId && prev.day === vs.day) {
                        if (isOverlapping(prev.starting, prev.ending, vs.starting, vs.ending)) {
                            // Allow parallel group labs (e.g. G1 in Lab A and G2 in Lab B)
                            const isParallelGroups = prev.group && vs.group && prev.group !== vs.group;
                            const isSameSession = prev.sessionId === vs.sessionId;
                            if (!isParallelGroups && !isSameSession) {
                                const err = new Error(`Section conflict in import package: Section ${vs.classSection.sectionId} has overlapping classes on ${vs.day} (${vs.starting}-${vs.ending}).`);
                                err.status = 422;
                                throw err;
                            }
                        }
                    }
                }
                sectionBookings.push({
                    sectionId: vs.classSection.sectionId,
                    day: vs.day,
                    starting: vs.starting,
                    ending: vs.ending,
                    group: vs.group,
                    sessionId: vs.sessionId
                });
            }

            console.log(`[IMPORT VALIDATION] All ${validatedSlots.length} slots successfully validated without conflicts.`);

            // Step 4E: Ensure Time Documents Exist in MongoDB
            for (const t of timesToEnsure) {
                const key = `${t.day}|${t.starting}|${t.ending}`;
                if (!timeMap.has(key)) {
                    let timeDoc = await Time.findOne({ day: t.day, starting: t.starting, ending: t.ending }, null, opt);
                    if (!timeDoc) {
                        timeDoc = (await Time.create([{ day: t.day, starting: t.starting, ending: t.ending }], opt))[0];
                    }
                    timeMap.set(key, timeDoc);
                }
            }

            // Build ready-to-insert TimetableSlot documents
            newDbSlots = validatedSlots.map(vs => {
                const timeDoc = timeMap.get(vs.timeKey);
                return {
                    faculty: vs.faculty._id,
                    classSection: vs.classSection._id,
                    subject: vs.subject._id,
                    room: vs.room._id,
                    time: timeDoc._id,
                    sessionId: vs.sessionId,
                    isLab: vs.isLab,
                    duration: vs.duration,
                    group: vs.group,
                    isFixed: vs.isFixed,
                    isOccupied: vs.isOccupied,
                    week: 'base',
                    isCancelled: false
                };
            });

            // Step 4F: Delete old base timetable slots
            await TimetableSlot.deleteMany({ week: 'base' }, opt);

            // Step 4G: Insert new base timetable slots
            await TimetableSlot.insertMany(newDbSlots, opt);

            // Step 4H: Clear stale timetable-specific overrides
            await ScheduleOverride.deleteMany({
                $or: [
                    { originalSlot: { $ne: null } },
                    { status: 'ACTIVE' }
                ]
            }, opt);
        };

        if (useTransaction && session) {
            try {
                await session.withTransaction(async () => {
                    await executeImportPipeline(session);
                });
            } finally {
                await session.endSession();
                session = null;
            }
        } else {
            await executeImportPipeline(null);
        }

        console.log(`[IMPORT DATABASE] Atomic base replacement complete: Inserted ${newDbSlots.length} new base slots, cleared stale overrides.`);
    } catch (dbErr) {
        const statusCode = dbErr.status || 500;
        const msg = dbErr.status ? dbErr.message : `Database replacement failed: ${dbErr.message}`;
        return errorResponse(statusCode, msg);
    }

    // ── 5. Rehydrate In-Memory State Immediately ──
    try {
        await hydrate();
        console.log('[IMPORT HYDRATION] Runtime registry and effective schedules rehydrated successfully.');
    } catch (hydrateErr) {
        console.error('[IMPORT HYDRATION WARNING] Rehydration error after DB replacement:', hydrateErr.message);
    }

    // ── 6. Return Canonical Response ──
    console.log(`[IMPORT SUCCESS] Base timetable imported successfully. ${rawSlots.length} slots activated as base and current.`);
    return res.status(200).json({
        success: true,
        packageId: packageId,
        academicYear: academicYear,
        semesterType: canonicalSemesterType,
        importedSlots: rawSlots.length,
        count: rawSlots.length,
        message: 'Base timetable imported successfully'
    });
}

module.exports = {
    handleTimetableImport,
    extractMasterData,
    synchronizeMasterData,
    padTime,
    parseYear,
    parseSemester,
    normalizeSectionName,
    resolveClassSection,
    isOverlapping,
    MTECH_SECTION_COMPATIBILITY
};
