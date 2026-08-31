import React from 'react';

export default function DragBanner({
  rescheduleMode,
  rescheduleActionType,
  unlockedSlot,
  onCancel,
}) {
  if (!rescheduleMode) return null;

  const code = unlockedSlot?.subjectCode || 'Class';
  const isScheduleNext = rescheduleActionType === 'SCHEDULE_NEXT';
  const isExtraClass = rescheduleActionType === 'ADD_EXTRA';

  let text = `Rescheduling ${code}: Drag or click target time slot.`;
  let cancelText = '✕ Cancel Reschedule';

  if (isScheduleNext) {
    text = `Schedule for Next Week: Drag ${code} or click any target time slot.`;
    cancelText = '✕ Cancel Reschedule';
  } else if (isExtraClass) {
    text = `Extra Class (${code}): Drag copy or click any target time slot.`;
    cancelText = '✕ Cancel Extra Class';
  }

  return (
    <div className="drag-banner">
      <span>{text}</span>
      <button
        className="btn-modal btn-danger"
        style={{ padding: '4px 10px', fontSize: '11px' }}
        onClick={onCancel}
      >
        {cancelText}
      </button>
    </div>
  );
}
