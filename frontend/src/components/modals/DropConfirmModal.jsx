import React from 'react';

export default function DropConfirmModal({ pendingPlacement, currentMode, onCancel, onConfirm }) {
  if (!pendingPlacement) return null;

  const targetSlot = pendingPlacement.targetSlot;
  const isExtraClass = pendingPlacement.workflowAction === 'EXTRA_CLASS' || pendingPlacement.originalSlot?.isExtraCopy;
  const isScheduleNext = pendingPlacement.workflowAction === 'SCHEDULE_NEXT' || (pendingPlacement.week === 'next' && !isExtraClass);
  const targetWeek = pendingPlacement.week || currentMode;
  const targetWeekLabel = isScheduleNext ? 'NEXT WEEK TIMETABLE' : `${targetWeek.toUpperCase()} TIMETABLE`;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ borderTop: '4px solid var(--institutional-navy)' }}>
        <div className="modal-header">
          <h3>{isExtraClass ? 'Confirm Extra Class Placement' : 'Confirm Timetable Placement'}</h3>
        </div>

        <div className="modal-body">
          <div className="details-box">
            <strong>Subject:</strong> {targetSlot.subjectCode}
            <br />
            <strong>New Slot:</strong> {targetSlot.day} {targetSlot.starting} - {targetSlot.ending}
            <br />
            <strong>Room:</strong> {targetSlot.roomNo || 'TBD'}
            <br />
            <strong>Target Timetable:</strong> {targetWeekLabel}
            {isExtraClass && (
              <>
                <br />
                <span style={{ color: '#059669', fontWeight: 600 }}>
                  ✦ Original class remains active in its original slot.
                </span>
              </>
            )}
          </div>

          <p style={{ marginTop: '8px', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
            {targetWeek === 'base'
              ? 'This change will modify the Base Blueprint and apply permanently to all future weeks.'
              : isExtraClass
              ? `This extra class occurrence will be added strictly to ${targetWeekLabel}.`
              : `This modification applies strictly to ${targetWeekLabel}.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button
            className="btn-modal btn-secondary"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            onClick={onCancel}
          >
            CANCEL
          </button>
          <button
            className="btn-modal btn-primary"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            onClick={() => onConfirm(pendingPlacement)}
          >
            CONFIRM & COMMIT
          </button>
        </div>
      </div>
    </div>
  );
}
