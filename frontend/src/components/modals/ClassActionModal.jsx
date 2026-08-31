import React from 'react';

export default function ClassActionModal({
  slot,
  currentMode,
  workflowContext,
  onClose,
  onActionSelect,
}) {
  if (!slot) return null;

  const isCurrentEditable = !!workflowContext?.currentWeekEditable;
  const isNextEditable = !!workflowContext?.nextWeekEditable;

  let isEditable = false;
  if (currentMode === 'current') isEditable = isCurrentEditable;
  else if (currentMode === 'next') isEditable = isNextEditable;
  else if (currentMode === 'base') isEditable = true;

  const showScheduleNext = currentMode === 'current' && !isNextEditable;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Class Options</h3>
          <span
            className="material-symbols-outlined"
            style={{ cursor: 'pointer' }}
            onClick={onClose}
          >
            close
          </span>
        </div>

        <div className="details-box">
          <strong style={{ fontSize: '14px', color: '#002147' }}>
            {slot.subjectCode} — {slot.subjectName || 'Class'}
          </strong>
          <br />
          <strong>Day & Time:</strong> {slot.day} {slot.starting} - {slot.ending}
          <br />
          <strong>Room:</strong> {slot.roomNo || 'TBD'}
          <br />
          <strong>Section:</strong> {slot.sectionId || 'N/A'}{' '}
          {slot.group ? `(Group ${slot.group})` : ''}
          <br />
          <strong>Faculty:</strong> {slot.facultyName || slot.facultyId || 'Unassigned'}
          <br />
          <strong>Active Timetable:</strong> {currentMode.toUpperCase()} TIMETABLE
        </div>

        <div className="btn-grid-actions">
          {isEditable && (
            <button
              className="btn-modal btn-primary"
              onClick={() => onActionSelect('RESCHEDULE', slot)}
            >
              <span className="material-symbols-outlined">schedule</span>
              1. RESCHEDULE (Move Occurrence)
            </button>
          )}

          {isEditable && (
            <button
              className="btn-modal btn-danger"
              onClick={() => onActionSelect('CANCEL', slot)}
            >
              <span className="material-symbols-outlined">cancel</span>
              2. CANCEL CLASS
            </button>
          )}

          {showScheduleNext && (
            <button
              className="btn-modal btn-emerald"
              onClick={() => onActionSelect('SCHEDULE_NEXT', slot)}
            >
              <span className="material-symbols-outlined">add_circle</span>
              3. SCHEDULE FOR NEXT WEEK
            </button>
          )}

          {isEditable && (
            <button
              className="btn-modal btn-emerald"
              onClick={() => onActionSelect('EXTRA_CLASS', slot)}
            >
              <span className="material-symbols-outlined">add_circle</span>
              4. EXTRA CLASS (Add Additional Occurrence)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
