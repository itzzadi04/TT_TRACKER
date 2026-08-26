import React from 'react';

export default function CancelConfirmModal({ slot, currentMode, onKeep, onConfirm }) {
  if (!slot) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ borderTop: '4px solid var(--error-red)' }}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--error-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined">warning</span>
            Cancel Class?
          </h3>
        </div>

        <div className="modal-body">
          <p style={{ fontWeight: 600, marginBottom: '6px' }}>
            Are you sure you want to cancel this class?
          </p>
          <div className="details-box">
            <strong>{slot.subjectCode}</strong> — {slot.subjectName || ''}
            <br />
            <span>
              {slot.sectionId || ''} {slot.group ? `(Group ${slot.group})` : ''}
            </span>
            <br />
            <span>
              <strong>Time:</strong> {slot.day} {slot.starting} - {slot.ending}
            </span>
            <br />
            <span>
              <strong>Room:</strong> {slot.roomNo || 'TBD'}
            </span>
          </div>
          <p style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
            This will cancel the class from the <strong>{currentMode.toUpperCase()}</strong> timetable context.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button
            className="btn-modal btn-secondary"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            onClick={onKeep}
          >
            NO, KEEP CLASS
          </button>
          <button
            className="btn-modal btn-danger-solid"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            onClick={() => onConfirm(slot)}
          >
            YES, CANCEL CLASS
          </button>
        </div>
      </div>
    </div>
  );
}
