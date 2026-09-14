/**
 * Centralized Academic Presentation Formatters for TT_TRACKER.
 * Ensures consistent, institutional, human-readable display of
 * faculty, sections, and rooms across all views, dropdowns, cards, and modals.
 */

/**
 * Format a Faculty record or name into a clean institutional full name.
 * Examples:
 *   "Dr Ajay Kumar Mallick" -> "Dr. Ajay Kumar Mallick"
 *   "Ms Akanksha Puri"      -> "Ms. Akanksha Puri"
 *   "Mr Keshav Kaundal"     -> "Mr. Keshav Kaundal"
 *   { facultyId: "AKM", name: "Dr Ajay Kumar Mallick" } -> "Dr. Ajay Kumar Mallick"
 *
 * @param {Object|string} faculty - Faculty object or name string
 * @returns {string} Formatted full name
 */
export function formatFacultyDisplay(faculty) {
  if (!faculty) return 'Unassigned';

  const rawName = typeof faculty === 'string'
    ? faculty.trim()
    : (faculty.name || faculty.facultyFullName || faculty.facultyId || '').trim();

  if (!rawName) return 'Unassigned';

  // Standardize common academic honorifics (add missing dot)
  if (rawName.startsWith('Dr ')) {
    return 'Dr. ' + rawName.slice(3).trim();
  }
  if (rawName.startsWith('Mr ')) {
    return 'Mr. ' + rawName.slice(3).trim();
  }
  if (rawName.startsWith('Ms ')) {
    return 'Ms. ' + rawName.slice(3).trim();
  }
  if (rawName.startsWith('Prof ')) {
    return 'Prof. ' + rawName.slice(5).trim();
  }

  return rawName;
}

/**
 * Format an academic ClassSection into a clear, descriptive label.
 * Derives exclusively from actual ClassSection metadata: year, semester, section, sectionId.
 *
 * Examples:
 *   "Y3_S5_CD" -> "3rd Year — Section CD (Semester 5)"
 *   "Y1_S1_MTECH-CSE" -> "M.Tech CSE — 1st Year (Semester 1)"
 *   "Y1_S1_MTECH-AI"  -> "M.Tech AI — 1st Year (Semester 1)"
 *   "Y5_S9_CD" -> "5th Year Dual Degree — Section CD (Semester 9)"
 *
 * @param {Object|string} section - Section object or sectionId string
 * @param {Object} [options]
 * @param {boolean} [options.compact] - For compact space-constrained cards (e.g. "3rd Year · Sec CD")
 * @returns {string} Human-readable section description
 */
export function formatSectionDisplay(section, options = {}) {
  if (!section) return 'N/A';

  let year = null;
  let semester = null;
  let sectionCode = null;
  let sectionId = '';

  if (typeof section === 'object') {
    year = section.year ? Number(section.year) : null;
    semester = section.semester ? Number(section.semester) : null;
    sectionCode = section.section || '';
    sectionId = section.sectionId || '';
  } else if (typeof section === 'string') {
    sectionId = section.trim();
  }

  // If fields missing, parse from canonical pattern: Y<year>_S<semester>_<section>
  if ((year === null || !sectionCode) && sectionId) {
    const match = sectionId.match(/^Y(\d+)_S(\d+)_(.+)$/);
    if (match) {
      year = Number(match[1]);
      semester = Number(match[2]);
      sectionCode = match[3];
    }
  }

  // Handle Postgraduate M.Tech Programs
  if (sectionCode === 'MTECH-CSE' || sectionCode === 'MTECH_CSE') {
    if (options.compact) return 'M.Tech CSE';
    return `M.Tech CSE — ${getYearOrdinal(year || 1)} Year${semester ? ` (Semester ${semester})` : ''}`;
  }
  if (sectionCode === 'MTECH-AI' || sectionCode === 'MTECH_AI') {
    if (options.compact) return 'M.Tech AI';
    return `M.Tech AI — ${getYearOrdinal(year || 1)} Year${semester ? ` (Semester ${semester})` : ''}`;
  }

  // Handle 5th Year Dual Degree
  if (year === 5) {
    if (options.compact) return `5th Year DD · Sec ${sectionCode}`;
    return `5th Year Dual Degree — Section ${sectionCode}${semester ? ` (Semester ${semester})` : ''}`;
  }

  // Handle Standard Undergraduate B.Tech (Years 1 to 4)
  if (year) {
    const yearLabel = `${getYearOrdinal(year)} Year`;
    if (options.compact) {
      return `${yearLabel} · Sec ${sectionCode}`;
    }
    return `${yearLabel} — Section ${sectionCode}${semester ? ` (Semester ${semester})` : ''}`;
  }

  // Fallback to sectionId or raw string if non-standard format
  return sectionId || String(section);
}

/**
 * Format a Room entity or room number.
 *
 * @param {Object|string} room - Room object or roomNo string
 * @param {Object} [options]
 * @param {boolean} [options.withType] - Include Lab/Class badge
 * @returns {string}
 */
export function formatRoomDisplay(room, options = {}) {
  if (!room) return 'TBD';

  if (typeof room === 'string') {
    return room.trim();
  }

  const roomNo = room.roomNo || room.name || 'TBD';
  if (options.withType && room.labOrClass) {
    return `${roomNo} (${room.labOrClass})`;
  }
  return roomNo;
}

/**
 * Helper to convert year number to ordinal string (1st, 2nd, 3rd, 4th, etc.)
 */
function getYearOrdinal(n) {
  const num = Number(n);
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  if (num === 4) return '4th';
  if (num === 5) return '5th';
  return `${num}th`;
}
