const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Faculty = require('../models/Faculty');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const Time = require('../models/Time');
const TimetableSlot = require('../models/TimetableSlot');

const facultyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'faculty.json')));
const classSectionData = JSON.parse(fs.readFileSync(path.join(__dirname, 'classSections.json')));
const subjectData = JSON.parse(fs.readFileSync(path.join(__dirname, 'subjects.json')));
const roomData = JSON.parse(fs.readFileSync(path.join(__dirname, 'rooms.json')));
const timeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'times.json')));
const slotData = JSON.parse(fs.readFileSync(path.join(__dirname, 'timetableSlots.json')));

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Faculty
  const facultyIdMap = {}; // code -> ObjectId
  for (const f of facultyData) {
    const doc = await Faculty.findOneAndUpdate(
      { facultyId: f.facultyId },
      f,
      { upsert: true, new: true }
    );
    facultyIdMap[f.facultyId] = doc._id;
  }
  console.log(`Faculty upserted: ${facultyData.length}`);

  // 2. ClassSection
  const classSectionIdMap = {}; // "year-section" -> ObjectId
  for (const cs of classSectionData) {
    const doc = await ClassSection.findOneAndUpdate(
      { year: cs.year, section: cs.section, semester: cs.semester },
      cs,
      { upsert: true, new: true }
    );
    classSectionIdMap[`${cs.year}-${cs.section}`] = doc._id;
  }
  console.log(`ClassSections upserted: ${classSectionData.length}`);

  // 3. Subject
  const subjectIdMap = {}; // code -> ObjectId
  for (const s of subjectData) {
    const doc = await Subject.findOneAndUpdate(
      { subjectCode: s.subjectCode },
      s,
      { upsert: true, new: true }
    );
    subjectIdMap[s.subjectCode] = doc._id;
  }
  console.log(`Subjects upserted: ${subjectData.length}`);

  // 4. Room
  const roomIdMap = {}; // roomNo -> ObjectId
  for (const r of roomData) {
    const doc = await Room.findOneAndUpdate(
      { roomNo: r.roomNo },
      r,
      { upsert: true, new: true }
    );
    roomIdMap[r.roomNo] = doc._id;
  }
  console.log(`Rooms upserted: ${roomData.length}`);

  // 5. Time
  const timeIdMap = {}; // "day|starting|ending" -> ObjectId
  for (const t of timeData) {
    const doc = await Time.findOneAndUpdate(
      { day: t.day, starting: t.starting, ending: t.ending },
      t,
      { upsert: true, new: true }
    );
    timeIdMap[`${t.day}|${t.starting}|${t.ending}`] = doc._id;
  }
  console.log(`Times upserted: ${timeData.length}`);

  // 6. TimetableSlot — resolves every natural-key reference into an ObjectId
  let created = 0, skipped = 0;
  for (const s of slotData) {
    const faculty = facultyIdMap[s.facultyId];
    const classSection = classSectionIdMap[`${s.year}-${s.section}`];
    const subject = subjectIdMap[s.subjectCode];
    const room = roomIdMap[s.roomNo];
    const time = timeIdMap[`${s.day}|${s.starting}|${s.ending}`];

    if (!faculty || !classSection || !subject || !room || !time) {
      console.warn('Skipping unresolved slot:', s);
      skipped++;
      continue;
    }

    try {
      await TimetableSlot.findOneAndUpdate(
        { faculty, time, room },
        { faculty, classSection, subject, room, time, isFixed: s.isFixed, isOccupied: s.isOccupied },
        { upsert: true, new: true }
      );
      created++;
    } catch (err) {
      console.error('TimetableSlot upsert failed:', s, err.message);
      skipped++;
    }
  }
  console.log(`TimetableSlots upserted: ${created}, skipped: ${skipped}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
