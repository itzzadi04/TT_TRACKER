const express = require('express');
const path = require('path');
const timetableRoutes = require('./routes/timetableroutes');
const registry = require('./tracker/Registry');

const app = express();
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname)));

// Mount API routes
app.use('/api/timetable', timetableRoutes);

// Dataset for local hydration
const rawTimetableSlots = [
    { facultyId: "AKM", year: 3, section: "CS", semester: 5, subjectCode: "CS-311", roomNo: "F4", day: "Monday", starting: "11:00", ending: "12:00" },
    { facultyId: "AKM", year: 3, section: "CD", semester: 5, subjectCode: "CS-311", roomNo: "F4", day: "Monday", starting: "14:00", ending: "15:00" },
    { facultyId: "AKM", year: 3, section: "CS", semester: 5, subjectCode: "CS-311", roomNo: "G5", day: "Tuesday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKM", year: 4, section: "CS", semester: 7, subjectCode: "CS-414", roomNo: "P4", day: "Wednesday", starting: "09:00", ending: "11:00" },
    { facultyId: "AKM", year: 3, section: "CD", semester: 5, subjectCode: "CS-311", roomNo: "G5", day: "Thursday", starting: "09:00", ending: "10:00" },
    { facultyId: "AKM", year: 3, section: "CS", semester: 5, subjectCode: "CS-311", roomNo: "B4", day: "Thursday", starting: "15:00", ending: "16:00" },
    { facultyId: "AKM", year: 3, section: "CD", semester: 5, subjectCode: "CS-311", roomNo: "G5", day: "Friday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKM", year: 4, section: "CS", semester: 7, subjectCode: "CS-414", roomNo: "P4", day: "Friday", starting: "11:00", ending: "13:00" },
    { facultyId: "AMK", year: 2, section: "CS", semester: 3, subjectCode: "EC-219", roomNo: "F4", day: "Monday", starting: "10:00", ending: "11:00" },
    { facultyId: "AMK", year: 2, section: "CS", semester: 3, subjectCode: "EC-219", roomNo: "F4", day: "Tuesday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKY", year: 3, section: "CS", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Monday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKY", year: 3, section: "CD", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Monday", starting: "11:00", ending: "12:00" },
    { facultyId: "AKY", year: 3, section: "CS", semester: 5, subjectCode: "CS-315", roomNo: "P1", day: "Monday", starting: "14:00", ending: "16:00" },
    { facultyId: "AKY", year: 3, section: "CS", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Tuesday", starting: "11:00", ending: "12:00" },
    { facultyId: "AKY", year: 3, section: "CS", semester: 5, subjectCode: "CS-315", roomNo: "P1", day: "Tuesday", starting: "14:00", ending: "16:00" },
    { facultyId: "AKY", year: 3, section: "CS", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Wednesday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKY", year: 3, section: "CD", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Thursday", starting: "10:00", ending: "11:00" },
    { facultyId: "AKY", year: 3, section: "CD", semester: 5, subjectCode: "CS-312", roomNo: "G5", day: "Friday", starting: "11:00", ending: "12:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-631", roomNo: "Conference Hall", day: "Monday", starting: "11:00", ending: "12:00" },
    { facultyId: "DPM", year: 3, section: "CS", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Monday", starting: "16:00", ending: "17:00" },
    { facultyId: "DPM", year: 3, section: "CD", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Monday", starting: "16:00", ending: "17:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-634", roomNo: "Conference Hall", day: "Tuesday", starting: "14:00", ending: "15:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-634", roomNo: "LAB B2", day: "Tuesday", starting: "15:00", ending: "17:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-631", roomNo: "Conference Hall", day: "Wednesday", starting: "10:00", ending: "11:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-631", roomNo: "Conference Hall", day: "Thursday", starting: "11:00", ending: "12:00" },
    { facultyId: "DPM", year: 3, section: "CS", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Thursday", starting: "14:00", ending: "15:00" },
    { facultyId: "DPM", year: 3, section: "CD", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Thursday", starting: "14:00", ending: "15:00" },
    { facultyId: "DPM", year: 1, section: "MTECH-AI", semester: 1, subjectCode: "CS-631", roomNo: "Conference Hall", day: "Friday", starting: "12:00", ending: "13:00" },
    { facultyId: "DPM", year: 3, section: "CS", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Friday", starting: "14:00", ending: "15:00" },
    { facultyId: "DPM", year: 3, section: "CD", semester: 5, subjectCode: "CS-351", roomNo: "F4", day: "Friday", starting: "14:00", ending: "15:00" }
];

const PORT = 3000;
app.listen(PORT, () => {
    // Hydrate RAM
    rawTimetableSlots.forEach((slot, i) => {
        const sectionId = `Y${slot.year}_S${slot.semester}_${slot.section}`;
        const payload = {
            slotId: `mock_${i}`,
            ...slot,
            sectionId
        };
        registry.addSlot('current', payload);
        registry.addSlot('next', payload);
    });

    console.log(`[Hydration] Hydrated ${rawTimetableSlots.length} slots into RAM.`);
    console.log(`Server running at http://localhost:${PORT}`);
});