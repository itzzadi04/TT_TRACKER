const registry = require('./tracker/Registry');

// 1. Dataset
const rawTimetableSlots = [
    { "facultyId": "AKM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-311", "roomNo": "F4", "day": "Monday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "AKM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-311", "roomNo": "F4", "day": "Monday", "starting": "14:00", "ending": "15:00" },
    { "facultyId": "AKM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-311", "roomNo": "G5", "day": "Tuesday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKM", "year": 4, "section": "CS", "semester": 7, "subjectCode": "CS-414", "roomNo": "P4", "day": "Wednesday", "starting": "9:00", "ending": "11:00" },
    { "facultyId": "AKM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-311", "roomNo": "G5", "day": "Thursday", "starting": "9:00", "ending": "10:00" },
    { "facultyId": "AKM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-311", "roomNo": "B4", "day": "Thursday", "starting": "15:00", "ending": "16:00" },
    { "facultyId": "AKM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-311", "roomNo": "G5", "day": "Friday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKM", "year": 4, "section": "CS", "semester": 7, "subjectCode": "CS-414", "roomNo": "P4", "day": "Friday", "starting": "11:00", "ending": "13:00" },
    { "facultyId": "AMK", "year": 2, "section": "CS", "semester": 3, "subjectCode": "EC-219", "roomNo": "F4", "day": "Monday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AMK", "year": 2, "section": "CS", "semester": 3, "subjectCode": "EC-219", "roomNo": "F4", "day": "Tuesday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKY", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Monday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKY", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Monday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "AKY", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-315", "roomNo": "P1", "day": "Monday", "starting": "14:00", "ending": "16:00" },
    { "facultyId": "AKY", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Tuesday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "AKY", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-315", "roomNo": "P1", "day": "Tuesday", "starting": "14:00", "ending": "16:00" },
    { "facultyId": "AKY", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Wednesday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKY", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Thursday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "AKY", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-312", "roomNo": "G5", "day": "Friday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-631", "roomNo": "Conference Hall - Block B", "day": "Monday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "DPM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Monday", "starting": "16:00", "ending": "17:00" },
    { "facultyId": "DPM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Monday", "starting": "16:00", "ending": "17:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-634", "roomNo": "Conference Hall - Block B", "day": "Tuesday", "starting": "14:00", "ending": "15:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-634", "roomNo": "LAB B2", "day": "Tuesday", "starting": "15:00", "ending": "17:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-631", "roomNo": "Conference Hall - Block B", "day": "Wednesday", "starting": "10:00", "ending": "11:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-631", "roomNo": "Conference Hall - Block B", "day": "Thursday", "starting": "11:00", "ending": "12:00" },
    { "facultyId": "DPM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Thursday", "starting": "14:00", "ending": "15:00" },
    { "facultyId": "DPM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Thursday", "starting": "14:00", "ending": "15:00" },
    { "facultyId": "DPM", "year": 1, "section": "MTECH-AI", "semester": 1, "subjectCode": "CS-631", "roomNo": "Conference Hall - Block B", "day": "Friday", "starting": "12:00", "ending": "13:00" },
    { "facultyId": "DPM", "year": 3, "section": "CS", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Friday", "starting": "14:00", "ending": "15:00" },
    { "facultyId": "DPM", "year": 3, "section": "CD", "semester": 5, "subjectCode": "CS-351", "roomNo": "F4", "day": "Friday", "starting": "14:00", "ending": "15:00" }
];

// Helper: Formatter for Compact Grid Output
function printTimetable(reg, type, id, label = '') {
    const grid = reg.getRepresentation(type, id, 'current');
    const tableData = {};

    grid.forEach(row => {
        const dayKey = row.day.slice(0, 3);
        tableData[dayKey] = {};

        row.slots.forEach(slot => {
            const col = `${slot.start.split(':')[0]}-${slot.end.split(':')[0]}`;

            if (slot.start === '13:00') {
                tableData[dayKey][col] = ' LUNCH ';
            } else if (!slot.occupied || !slot.data) {
                tableData[dayKey][col] = '   -   ';
            } else {
                const d = slot.data;
                const labTag = d.isLab ? `_L${d.labBlockIndex}` : '';
                const target = type === 'FACULTY' ? d.sectionId.replace('Y', '').replace('_S', 's') : type === 'SECTION' ? d.facultyId : `${d.facultyId}/${d.sectionId.replace('Y', '').replace('_S', 's')}`;
                tableData[dayKey][col] = `${d.subjectCode}(${target})${labTag}`;
            }
        });
    });

    console.log(`\n================== ${type}: ${id} ${label} ==================`);
    console.table(tableData);
}

// Helper: Print Triad Views (Faculty + Section + Room)
function printAllThreeViews(facId, secId, roomId, actionLabel) {
    console.log(`\n********************************************************************************`);
    console.log(`>>> SYNCHRONIZED VIEWS AFTER: [${actionLabel}]`);
    console.log(`********************************************************************************`);
    printTimetable(registry, 'FACULTY', facId, `(${actionLabel})`);
    printTimetable(registry, 'SECTION', secId, `(${actionLabel})`);
    printTimetable(registry, 'ROOM', roomId, `(${actionLabel})`);
}

// 2. Hydration
console.log('>>> [0] HYDRATING RAM TRACKERS FROM DATASET...');
rawTimetableSlots.forEach(slot => {
    const sectionId = `Y${slot.year}_S${slot.semester}_${slot.section}`;
    registry.addSlot('current', { ...slot, sectionId });
});
console.log(`✔ Hydrated ${rawTimetableSlots.length} records into RAM.`);

// Baseline Initial State
printAllThreeViews('AKM', 'Y3_S5_CS', 'F4', 'INITIAL BASELINE');

// ==========================================
// SCENARIO 1: CANCEL A CLASS
// ==========================================
console.log('\n================================================================================');
console.log('>>> SCENARIO 1: CANCEL CLASS (AKM, Y3_S5_CS, Room F4 on Monday 11:00-12:00)');
console.log('================================================================================');

registry.removeSlot('current', {
    facultyId: 'AKM',
    roomNo: 'F4',
    sectionId: 'Y3_S5_CS',
    day: 'Monday',
    start: '11:00',
    end: '12:00'
});

printAllThreeViews('AKM', 'Y3_S5_CS', 'F4', '1. CANCELLED MON 11-12');

// ==========================================
// SCENARIO 2: RESCHEDULE A 1-HOUR CLASS
// ==========================================
console.log('\n================================================================================');
console.log('>>> SCENARIO 2: RESCHEDULE CLASS (AKM, Y3_S5_CS: Move Thursday 15:00-16:00 in Room B4 -> Tuesday 14:00-15:00 in Room F4)');
console.log('================================================================================');

// 1. Conflict validation before move
const moveCheck = registry.checkConflict('current', {
    facultyId: 'AKM',
    roomNo: 'F4',
    sectionId: 'Y3_S5_CS',
    day: 'Tuesday',
    start: '14:00',
    end: '15:00'
});

if (moveCheck.isAvailable) {
    // Evict old slot
    registry.removeSlot('current', {
        facultyId: 'AKM',
        roomNo: 'B4',
        sectionId: 'Y3_S5_CS',
        day: 'Thursday',
        start: '15:00',
        end: '16:00'
    });

    // Assign new slot
    registry.addSlot('current', {
        facultyId: 'AKM',
        roomNo: 'F4',
        sectionId: 'Y3_S5_CS',
        subjectCode: 'CS-311',
        day: 'Tuesday',
        starting: '14:00',
        ending: '15:00'
    });
    console.log('✔ Reschedule validated and applied!');
} else {
    console.log('✖ Reschedule blocked:', moveCheck.errors);
}

printAllThreeViews('AKM', 'Y3_S5_CS', 'F4', '2. RESCHEDULED THU 15-16 TO TUE 14-15');

// ==========================================
// SCENARIO 3: BOOK AN EXTRA CLASS
// ==========================================
console.log('\n================================================================================');
console.log('>>> SCENARIO 3: BOOK EXTRA CLASS (AKM, Y3_S5_CS, Room F4 on Wednesday 15:00-16:00)');
console.log('================================================================================');

const extraCheck = registry.checkConflict('current', {
    facultyId: 'AKM',
    roomNo: 'F4',
    sectionId: 'Y3_S5_CS',
    day: 'Wednesday',
    start: '15:00',
    end: '16:00'
});

if (extraCheck.isAvailable) {
    registry.addSlot('current', {
        facultyId: 'AKM',
        roomNo: 'F4',
        sectionId: 'Y3_S5_CS',
        subjectCode: 'CS-311X',
        day: 'Wednesday',
        starting: '15:00',
        ending: '16:00'
    });
    console.log('✔ Extra class booked!');
} else {
    console.log('✖ Extra class blocked:', extraCheck.errors);
}

printAllThreeViews('AKM', 'Y3_S5_CS', 'F4', '3. ADDED EXTRA CLASS WED 15-16');

// ==========================================
// SCENARIO 4: RESCHEDULE A 2-HOUR LAB
// ==========================================
console.log('\n================================================================================');
console.log('>>> SCENARIO 4: RESCHEDULE 2-HR LAB (AKM, Y4_S7_CS, Room P4: Wednesday 09:00-11:00 -> Wednesday 14:00-16:00)');
console.log('================================================================================');

const labCheck = registry.checkConflict('current', {
    facultyId: 'AKM',
    roomNo: 'P4',
    sectionId: 'Y4_S7_CS',
    day: 'Wednesday',
    start: '14:00',
    end: '16:00'
});

if (labCheck.isAvailable) {
    // Evict both hours of old lab
    registry.removeSlot('current', {
        facultyId: 'AKM',
        roomNo: 'P4',
        sectionId: 'Y4_S7_CS',
        day: 'Wednesday',
        start: '09:00',
        end: '11:00'
    });

    // Re-book both hours at new position
    registry.addSlot('current', {
        facultyId: 'AKM',
        roomNo: 'P4',
        sectionId: 'Y4_S7_CS',
        subjectCode: 'CS-414',
        day: 'Wednesday',
        starting: '14:00',
        ending: '16:00'
    });
    console.log('✔ 2-Hour Lab rescheduled successfully across all blocks!');
} else {
    console.log('✖ Lab reschedule blocked:', labCheck.errors);
}

printAllThreeViews('AKM', 'Y4_S7_CS', 'P4', '4. RESCHEDULED 2-HR LAB WED 09-11 TO 14-16');