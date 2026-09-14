import React from 'react';

export default function GuidelinesView({ onBackToTimetable }) {
  return (
    <div className="guidelines-container">
      {/* Top Banner */}
      <div className="guidelines-header-card">
        <div className="guidelines-header-content">
          <div className="guidelines-badge">Official Operating Procedures</div>
          <h1>Academic Timetable Guidelines</h1>
          <p>
            Standard operating procedures and scheduling guidelines for faculty allocations,
            curriculum schedules, and lecture hall operations at NIT Hamirpur.
          </p>
        </div>
        {onBackToTimetable && (
          <button
            type="button"
            className="btn-back-timetable"
            onClick={onBackToTimetable}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Timetable
          </button>
        )}
      </div>

      {/* Structured Guidelines Content */}
      <div className="guidelines-sections-grid">
        {/* Section 1: Timetable Views */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">1</div>
            <h2>Timetable Views</h2>
          </div>
          <div className="guideline-card-body">
            <p>TT_TRACKER provides three distinct institutional perspectives for inspecting schedules:</p>
            <ul>
              <li>
                <strong>Faculty View:</strong> Displays the personalized weekly teaching schedule for a selected faculty member, detailing lecture times, assigned rooms, and sections.
              </li>
              <li>
                <strong>Section View:</strong> Displays the complete academic curriculum matrix for an undergraduate or postgraduate class section, including all theory lectures and laboratory sessions.
              </li>
              <li>
                <strong>Room View:</strong> Displays the complete occupancy matrix of any lecture hall or computer laboratory across all time slots, enabling rapid verification of room availability.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 2: Understanding the Timetable */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">2</div>
            <h2>Understanding the Timetable Contexts</h2>
          </div>
          <div className="guideline-card-body">
            <p>The system operates across three temporal schedules:</p>
            <ul>
              <li>
                <strong>Base Timetable:</strong> The foundational semester schedule generated and imported at the start of the semester. It represents the permanent academic blueprint.
              </li>
              <li>
                <strong>Current Week:</strong> The active, operational schedule for the ongoing calendar week. Reflects all approved cancellations, reschedules, and additional make-up sessions.
              </li>
              <li>
                <strong>Next Week:</strong> An advance preview and planning space for the upcoming calendar week, enabling proactive schedule adjustments before the week commences.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 3: Managing a Class */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">3</div>
            <h2>Managing a Class (Available Actions)</h2>
          </div>
          <div className="guideline-card-body">
            <p>Clicking any scheduled class card in the timetable grid presents four operational actions:</p>
            <ol>
              <li>
                <strong>Reschedule (Move Occurrence):</strong> Unlocks the class card for drag-and-drop relocation into an unoccupied time slot. The system verifies instructor and venue availability before committing the move.
              </li>
              <li>
                <strong>Cancel Class:</strong> Cancels the selected class for the active week. The assigned room and faculty are immediately released as available for other sessions.
              </li>
              <li>
                <strong>Schedule for Next Week:</strong> Forwards or duplicates an occurrence into the next calendar week's schedule during advance planning.
              </li>
              <li>
                <strong>Extra Class (Add Additional Occurrence):</strong> Creates a supplementary lecture or remedial session for the subject without modifying the regular weekly class.
              </li>
            </ol>
          </div>
        </div>

        {/* Section 4: Week & Schedule Rules */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">4</div>
            <h2>Week & Schedule Rules</h2>
          </div>
          <div className="guideline-card-body">
            <ul>
              <li>
                <strong>Academic Working Days:</strong> Regular academic operations run strictly Monday through Friday from 08:00 to 18:00.
              </li>
              <li>
                <strong>Current Week Window:</strong> Weekday adjustments apply to the active week. When editing a current week class, changes take effect immediately on the live schedule.
              </li>
              <li>
                <strong>Weekend Behavior:</strong> Over the weekend (Saturday and Sunday), the current week's operational record is preserved and archived. Schedule modifications automatically apply toward the upcoming week.
              </li>
              <li>
                <strong>Weekly Rollover:</strong> At the start of each new week, next week's configured adjustments transition into the active operating schedule, and the base timetable initializes subsequent weeks.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 5: Conflict Prevention */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">5</div>
            <h2>Conflict Prevention</h2>
          </div>
          <div className="guideline-card-body">
            <p>Every schedule modification is validated in real time before execution:</p>
            <ul>
              <li>
                <strong>Faculty Double-Booking:</strong> Prevents scheduling any instructor for two different sessions at the same day and time.
              </li>
              <li>
                <strong>Room Collision:</strong> Prevents assigning multiple classes to the same lecture hall or lab simultaneously. If a room conflict occurs, the system provides a list of vacant alternative rooms.
              </li>
              <li>
                <strong>Section Overlap:</strong> Prevents scheduling overlapping lectures or lab sessions for students enrolled in the same class section.
              </li>
              <li>
                <strong>Lab Venue Enforcement:</strong> Standard theory lectures cannot be scheduled in dedicated laboratory rooms, protecting laboratory equipment for practical coursework.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 6: Lab & Group Classes */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">6</div>
            <h2>Lab & Group Classes</h2>
          </div>
          <div className="guideline-card-body">
            <ul>
              <li>
                <strong>Sub-Group Division:</strong> Laboratory courses are divided into distinct student batches (Group G1 and Group G2).
              </li>
              <li>
                <strong>Concurrent Practical Sessions:</strong> Different groups from the same academic section can attend simultaneous lab sessions in separate laboratories without triggering section conflicts.
              </li>
              <li>
                <strong>Multi-Hour Lab Blocks:</strong> Practical sessions scheduled as continuous 2-hour or 3-hour blocks maintain their session continuity during schedule management.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 7: Base Timetable & Changes */}
        <div className="guideline-card">
          <div className="guideline-card-header">
            <div className="guideline-num">7</div>
            <h2>Base Timetable & Overrides</h2>
          </div>
          <div className="guideline-card-body">
            <ul>
              <li>
                <strong>Blueprint Protection:</strong> Daily operational changes (reschedules, cancellations, extra classes) apply as week-specific adjustments and never corrupt the semester Base Timetable.
              </li>
              <li>
                <strong>Temporary vs Permanent Modifications:</strong> Week-level modifications affect only the targeted week. The underlying academic timetable blueprint remains preserved for all subsequent weeks.
              </li>
              <li>
                <strong>Transparency & Tracking:</strong> Modified classes are visually highlighted on the timetable grid with distinct status badges (Rescheduled, Extra Session) for clear institutional record-keeping.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
