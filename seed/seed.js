const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Faculty = require('../models/Faculty');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Time = require('../models/Time');
const TimetableSlot = require('../models/TimetableSlot');
const ScheduleOverride = require('../models/ScheduleOverride');

const facultyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'faculty.json')));
const classSectionData = JSON.parse(fs.readFileSync(path.join(__dirname, 'classSections.json')));
const subjectData = JSON.parse(fs.readFileSync(path.join(__dirname, 'subjects.json')));
const roomData = JSON.parse(fs.readFileSync(path.join(__dirname, 'rooms.json')));
const timeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'times.json')));
const slotData = JSON.parse(fs.readFileSync(path.join(__dirname, 'timetableSlots.json')));

function padTime(t) {
    if (!t) return t;
    const [h, m] = t.split(':');
    return h.padStart(2, '0') + ':' + m;
}

async function seed() {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected.\n');

    // ── 1. Upsert Faculty ──
    const facultyIdMap = {};
    for (const f of facultyData) {
        let doc = await Faculty.findOne({ facultyId: f.facultyId });
        if (doc) {
            await Faculty.updateOne({ _id: doc._id }, f);
        } else {
            doc = await Faculty.create(f);
        }
        facultyIdMap[f.facultyId] = doc._id;
    }
    console.log(`[Faculty] Processed ${facultyData.length} faculties.`);

    // ── 2. Upsert ClassSection ──
    const classSectionIdMap = {};
    for (const cs of classSectionData) {
        const sectionId = cs.sectionId || `Y${cs.year}_S${cs.semester}_${cs.section}`;
        const payload = { ...cs, sectionId };
        let doc = await ClassSection.findOne({ year: cs.year, section: cs.section, semester: cs.semester });
        if (doc) {
            await ClassSection.updateOne({ _id: doc._id }, payload);
        } else {
            doc = await ClassSection.create(payload);
        }
        classSectionIdMap[sectionId] = doc._id;
    }
    console.log(`[ClassSection] Processed ${classSectionData.length} sections.`);

    // ── 3. Upsert Subject ──
    const subjectIdMap = {};
    for (const s of subjectData) {
        let doc = await Subject.findOne({ subjectCode: s.subjectCode });
        if (doc) {
            await Subject.updateOne({ _id: doc._id }, s);
        } else {
            doc = await Subject.create(s);
        }
        subjectIdMap[s.subjectCode] = doc._id;
    }
    console.log(`[Subject] Processed ${subjectData.length} subjects.`);

    // ── 4. Upsert Room ──
    const roomIdMap = {};
    for (const r of roomData) {
        let doc = await Room.findOne({ roomNo: r.roomNo });
        if (doc) {
            await Room.updateOne({ _id: doc._id }, r);
        } else {
            doc = await Room.create(r);
        }
        roomIdMap[r.roomNo] = doc._id;
    }
    console.log(`[Room] Processed ${roomData.length} rooms.`);

    // ── 5. Upsert Time ──
    const timeIdMap = {};
    for (const t of timeData) {
        const starting = padTime(t.starting);
        const ending = padTime(t.ending);
        const key = `${t.day}|${starting}|${ending}`;
        let doc = await Time.findOne({ day: t.day, starting, ending });
        if (!doc) {
            doc = await Time.create({ day: t.day, starting, ending });
        }
        timeIdMap[key] = doc._id;
    }
    console.log(`[Time] Processed ${timeData.length} time intervals.`);

    // ── 6. Clean and Batch Insert Base TimetableSlots ──
    await ScheduleOverride.deleteMany({});
    await TimetableSlot.deleteMany({});

    const slotPayloads = [];
    for (const s of slotData) {
        const starting = padTime(s.starting);
        const ending = padTime(s.ending);
        const sectionId = `Y${s.year}_S${s.semester}_${s.section}`;
        const timeKey = `${s.day}|${starting}|${ending}`;

        const faculty = facultyIdMap[s.facultyId];
        const classSection = classSectionIdMap[sectionId];
        const subject = subjectIdMap[s.subjectCode];
        const room = roomIdMap[s.roomNo];
        const time = timeIdMap[timeKey];

        if (!faculty || !classSection || !subject || !room || !time) {
            console.warn(`[REJECTED] Reference missing for slot: ${s.facultyId} ${sectionId} ${s.subjectCode}`);
            continue;
        }

        const duration = s.duration || (parseInt(ending) - parseInt(starting));
        const sessionId = s.sessionId || `${s.facultyId}_${sectionId}_${s.subjectCode}_${s.day}_${starting}`;
        const group = s.group || null;
        const isLab = s.isLab || false;

        slotPayloads.push({
            faculty,
            classSection,
            subject,
            room,
            time,
            sessionId,
            isLab,
            duration,
            group,
            isFixed: s.isFixed !== undefined ? s.isFixed : false,
            isOccupied: s.isOccupied !== undefined ? s.isOccupied : true,
            week: 'base',
            isCancelled: false
        });
    }

    const insertedSlots = await TimetableSlot.insertMany(slotPayloads);
    console.log(`[TimetableSlot] Inserted ${insertedSlots.length} base timetable slots.`);

    const totalSlots = await TimetableSlot.countDocuments({ isCancelled: false });
    console.log(`\n[Verify] Total TimetableSlots in DB: ${totalSlots} (Expected: ${slotData.length})`);
    if (totalSlots === slotData.length) {
        console.log('✔ All slots seeded successfully!');
    }

    await mongoose.disconnect();
    console.log('\n[Seed] Disconnected. Done.');
}

seed().catch(err => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
});
