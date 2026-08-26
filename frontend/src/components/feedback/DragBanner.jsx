import React from 'react';

export default function DragBanner({
  rescheduleMode,
  rescheduleActionType,
  unlockedSlot,
  onCancel,
}) {
  if (!rescheduleMode) return null;

  const code = unlockedSlot?.subjectCode || 'Class';
  const text =
    rescheduleActionType === 'ADD_EXTRA'
      ? `Schedule for Next Week: Drag ${code} or click any target time slot.`
      : `Rescheduling ${code}: Drag or click target time slot.`;

  return (
    <div className="drag-banner">
      <span>{text}</span>
      <button
        className="btn-modal btn-danger"
        style={{ padding: '4px 10px', fontSize: '11px' }}
        onClick={onCancel}
      >
        ✕ Cancel Reschedule
      </button>
    </div>
  );
}
