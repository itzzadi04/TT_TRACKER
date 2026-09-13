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
 * Parse year to number (supports "2nd Year", "2", 2, "Final Year" -> 4, etc.)
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
 */
function normalizeSectionName(rawSec) {
    if (!rawSec) return '';
    const str = String(rawSec).trim().toUpperCase();
    // Strip trailing digits for sections like CS2, CD3, CS4 while preserving MTECH-AI, MTECH-CSE
    if (/^[A-Z]{2,}\d+$/.test(str)) {
        return str.replace(/\d+$/, '');
    }
    return str;
}

/**
 * Resolves a ClassSection document from incoming slot representations
 */
function resolveClassSection(slot, sectionMaps) {
    const { bySectionId, byYearSemSec } = sectionMaps;

    // 1. Direct sectionId or section check
    const rawSectionId = slot.sectionId || slot.section;
    if (rawSectionId && bySectionId.has(String(rawSectionId).trim().toUpperCase())) {
        return bySectionId.get(String(rawSectionId).trim().toUpperCase());
    }

    // 2. Structured (year, semester, section) check
    const parsedYear = parseYear(slot.year);
    const parsedSem = parseSemester(slot.semester);
    const normSec = normalizeSectionName(slot.section);

    if (parsedYear !== null && parsedSem !== null && normSec) {
        const key = `${parsedYear}_${parsedSem}_${normSec}`;
        if (byYearSemSec.has(key)) {
            return byYearSemSec.get(key);
        }
        // Fallback: Check if synthesized sectionId exists e.g. Y2_S3_CS
        const synthId = `Y${parsedYear}_S${parsedSem}_${normSec}`;
        if (bySectionId.has(synthId)) {
            return bySectionId.get(synthId);
        }
    }

    // 3. Try to infer year and sem from section string like "CS2" (year 2, sem 3 for odd sem)
    if (normSec) {
        // Search if any single section matches normalized section
        for (const [key, secDoc] of byYearSemSec.entries()) {
            if (secDoc.section.toUpperCase() === normSec) {
                if (parsedYear && secDoc.year === parsedYear) return secDoc;
            }
        }
    }

    return null;
}

/**
 * Main Timetable Import Controller Handler
 */
async function handleTimetableImport(req, res) {
    // ── 1. Authentication Check ──
    const expectedSecret = process.env.TT_TRACKER_IMPORT_SECRET;
    if (!expectedSecret) {
        console.error('[Import Error] TT_TRACKER_IMPORT_SECRET is not configured in server environment.');
        return res.status(500).json({
            success: false,
            error: 'Server configuration error: Import authentication secret is not configured.'
        });
    }

    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-import-secret'];
    let providedSecret = customHeader;

    if (!providedSecret && authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            providedSecret = authHeader.slice(7).trim();
        } else {
            providedSecret = authHeader.trim();
        }
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        console.warn('[Import Auth] Unauthorized import attempt rejected.');
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing import secret.'
        });
    }

    // ── 2. Payload Extraction & Structural Validation ──
    let rawSlots = null;
    let academicYear = null;
    let semesterType = null;
    let packageId = null;

    if (Array.isArray(req.body)) {
        rawSlots = req.body;
    } else if (req.body && typeof req.body === 'object') {
        if (Array.isArray(req.body.slots)) {
            rawSlots = req.body.slots;
            academicYear = req.body.academicYear || null;
            semesterType = req.body.semesterType || null;
            packageId = req.body.packageId || null;
        }
    }

    if (!rawSlots) {
        return res.status(400).json({
            success: false,
            error: 'Malformed payload: Expected array of timetable slots or object containing a "slots" array.'
        });
    }

    if (rawSlots.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Payload is empty: A complete semester timetable package with slots is required.'
        });
    }

    console.log(`[Import] Received import package with ${rawSlots.length} slots. Starting complete validation...`);

    // ── 3. Reference Lookup Maps Preparation ──
    try {
        const [faculties, rooms, subjects, classSections, existingTimes] = await Promise.all([
            Faculty.find().lean(),
            Room.find().lean(),
            Subject.find().lean(),
            ClassSection.find().lean(),
            Time.find().lean()
        ]);

        const facultyMap = new Map();
        for (const f of faculties) {
            facultyMap.set(f.facultyId.toUpperCase(), f);
            facultyMap.set(f.name.toLowerCase().trim(), f);
        }

        const roomMap = new Map();
        for (const r of rooms) {
            roomMap.set(r.roomNo.toUpperCase().trim(), r);
        }

        const subjectMap = new Map();
        for (const s of subjects) {
            subjectMap.set(s.subjectCode.toUpperCase().trim(), s);
        }

        const sectionMaps = {
            bySectionId: new Map(),
            byYearSemSec: new Map()
        };
        for (const cs of classSections) {
            sectionMaps.bySectionId.set(cs.sectionId.toUpperCase().trim(), cs);
            sectionMaps.byYearSemSec.set(`${cs.year}_${cs.semester}_${cs.section.toUpperCase().trim()}`, cs);
        }

        const timeMap = new Map();
        for (const t of existingTimes) {
            timeMap.set(`${t.day}|${t.starting}|${t.ending}`, t);
        }

        const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

        // ── 4. Item-by-Item Validation & Resolution ──
        const validatedSlots = [];
        const timesToEnsure = [];

        for (let i = 0; i < rawSlots.length; i++) {
            const slot = rawSlots[i];
            const slotNum = i + 1;

            if (!slot || typeof slot !== 'object') {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum} is invalid or malformed.`
                });
            }

            // Day validation
            const day = slot.day ? slot.day.trim() : null;
            if (!day || !validDays.has(day)) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Invalid or missing day "${day}". Must be Monday through Saturday.`
                });
            }

            // Time validation
            const starting = padTime(slot.start || slot.starting);
            const ending = padTime(slot.end || slot.ending);
            if (!starting || !ending) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Missing or invalid start/end time. Received start: "${slot.start || slot.starting}", end: "${slot.end || slot.ending}".`
                });
            }
            if (timeToMinutes(starting) >= timeToMinutes(ending)) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Starting time (${starting}) must be before ending time (${ending}).`
                });
            }

            // Subject resolution
            const rawSubjectCode = (slot.subjectCode || slot.subject || '').toString().trim().toUpperCase();
            if (!rawSubjectCode) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Missing subject code.`
                });
            }
            const subjectDoc = subjectMap.get(rawSubjectCode);
            if (!subjectDoc) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Unknown subject code "${rawSubjectCode}". Subject must exist in TT_TRACKER subject registry.`
                });
            }

            // Faculty resolution
            const rawFaculty = (slot.facultyId || slot.facultyCode || slot.faculty || '').toString().trim();
            if (!rawFaculty) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Missing faculty identifier for subject ${rawSubjectCode}.`
                });
            }
            const facultyDoc = facultyMap.get(rawFaculty.toUpperCase()) || facultyMap.get(rawFaculty.toLowerCase());
            if (!facultyDoc) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Unknown faculty "${rawFaculty}". Faculty must exist in TT_TRACKER faculty registry.`
                });
            }

            // Room resolution
            const rawRoom = (slot.roomNo || slot.room || '').toString().trim().toUpperCase();
            if (!rawRoom) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Missing room identifier.`
                });
            }
            const roomDoc = roomMap.get(rawRoom);
            if (!roomDoc) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Unknown room "${rawRoom}". Room must exist in TT_TRACKER room registry.`
                });
            }

            // Section resolution
            const sectionDoc = resolveClassSection(slot, sectionMaps);
            if (!sectionDoc) {
                return res.status(422).json({
                    success: false,
                    error: `Slot #${slotNum}: Unknown or unresolvable class section "${slot.sectionId || slot.section}". Section must exist in TT_TRACKER section registry.`
                });
            }

            // Duration & Lab resolution
            const duration = Number(slot.duration) || (timeToMinutes(ending) - timeToMinutes(starting)) / 60;
            const isLab = Boolean(slot.isLab);
            const group = slot.group ? String(slot.group).trim() : null;

            // Session ID preservation / generation
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

        // ── 5. Internal Duplicate & Conflict Validation Across Incoming Package ──
        const slotDedupeKeys = new Set();
        const facultyBookings = [];
        const roomBookings = [];
        const sectionBookings = [];

        for (const vs of validatedSlots) {
            // Check exact duplicate slot
            const dedupeKey = `${vs.faculty.facultyId}|${vs.classSection.sectionId}|${vs.subject.subjectCode}|${vs.day}|${vs.starting}|${vs.ending}|${vs.group || ''}`;
            if (slotDedupeKeys.has(dedupeKey)) {
                return res.status(422).json({
                    success: false,
                    error: `Duplicate timetable record in package for section ${vs.classSection.sectionId}, subject ${vs.subject.subjectCode} at ${vs.day} ${vs.starting}-${vs.ending}.`
                });
            }
            slotDedupeKeys.add(dedupeKey);

            // Faculty double-booking check
            for (const prev of facultyBookings) {
                if (prev.facultyId === vs.faculty.facultyId && prev.day === vs.day) {
                    if (isOverlapping(prev.starting, prev.ending, vs.starting, vs.ending)) {
                        // Allow identical sessionId (shared session / multi-group / team-taught)
                        if (prev.sessionId !== vs.sessionId) {
                            return res.status(422).json({
                                success: false,
                                error: `Faculty conflict in import package: Faculty ${vs.faculty.facultyId} is scheduled concurrently for section ${prev.sectionId} and ${vs.classSection.sectionId} on ${vs.day} (${vs.starting}-${vs.ending}).`
                            });
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
                        // Allow same sessionId (combined section elective in same hall)
                        if (prev.sessionId !== vs.sessionId) {
                            return res.status(422).json({
                                success: false,
                                error: `Room conflict in import package: Room ${vs.room.roomNo} is booked concurrently for ${prev.sectionId} and ${vs.classSection.sectionId} on ${vs.day} (${vs.starting}-${vs.ending}).`
                            });
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
                            return res.status(422).json({
                                success: false,
                                error: `Section conflict in import package: Section ${vs.classSection.sectionId} has overlapping classes on ${vs.day} (${vs.starting}-${vs.ending}).`
                            });
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

        console.log(`[Import] All ${validatedSlots.length} slots successfully validated without conflicts.`);

        // ── 6. Ensure Time Documents Exist in MongoDB ──
        for (const t of timesToEnsure) {
            const key = `${t.day}|${t.starting}|${t.ending}`;
            if (!timeMap.has(key)) {
                let timeDoc = await Time.findOne({ day: t.day, starting: t.starting, ending: t.ending });
                if (!timeDoc) {
                    timeDoc = await Time.create({ day: t.day, starting: t.starting, ending: t.ending });
                }
                timeMap.set(key, timeDoc);
            }
        }

        // Build ready-to-insert TimetableSlot documents
        const newDbSlots = validatedSlots.map(vs => {
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

        // ── 7. Atomic Replacement Execution ──
        let session = null;
        let useTransaction = false;

        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (txnInitErr) {
            console.warn('[Import] MongoDB transaction not available in this environment. Falling back to sequential execution:', txnInitErr.message);
            if (session) {
                try { await session.endSession(); } catch (_) { }
                session = null;
            }
            useTransaction = false;
        }

        const opt = useTransaction && session ? { session } : {};

        try {
            // Step 7A: Delete old base timetable slots
            await TimetableSlot.deleteMany({ week: 'base' }, opt);

            // Step 7B: Insert new base timetable slots
            await TimetableSlot.insertMany(newDbSlots, opt);

            // Step 7C: Clear stale timetable-specific overrides
            // Removes any overrides associated with replaced base slots or active overrides from old timetable
            await ScheduleOverride.deleteMany({
                $or: [
                    { originalSlot: { $ne: null } },
                    { status: 'ACTIVE' }
                ]
            }, opt);

            if (useTransaction && session) {
                await session.commitTransaction();
                await session.endSession();
                session = null;
            }

            console.log(`[Import] Database base replacement complete: Inserted ${newDbSlots.length} new base slots.`);
        } catch (dbErr) {
            if (useTransaction && session) {
                try {
                    await session.abortTransaction();
                    await session.endSession();
                } catch (_) { }
            }
            console.error('[Import Error] Database replacement failed, transaction aborted:', dbErr.message);
            return res.status(500).json({
                success: false,
                error: 'Database replacement failed: ' + dbErr.message
            });
        }

        // ── 8. Rehydrate In-Memory State Immediately ──
        try {
            await hydrate();
            console.log('[Import] Runtime registry and effective schedules rehydrated successfully.');
        } catch (hydrateErr) {
            console.error('[Import Warning] Rehydration error after DB replacement:', hydrateErr.message);
            // Note: DB contains the new timetable, so next request or restart will load it.
        }

        // ── 9. Return Clear Success Response ──
        return res.status(200).json({
            success: true,
            message: 'Timetable imported and activated successfully as current and base.',
            count: newDbSlots.length,
            packageId: packageId || null,
            academicYear: academicYear || null,
            semesterType: semesterType || null
        });

    } catch (err) {
        console.error('[Import Error] Unexpected error during import processing:', err);
        return res.status(500).json({
            success: false,
            error: 'Import failed due to server error: ' + err.message
        });
    }
}

module.exports = {
    handleTimetableImport,
    padTime,
    parseYear,
    parseSemester,
    normalizeSectionName,
    resolveClassSection,
    isOverlapping
};
