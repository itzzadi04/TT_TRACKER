import React from 'react';

export default function ClassCard({
  classData,
  currentView,
  rescheduleMode,
  unlockedSlot,
  onClassClick,
}) {
  const isLab = !!classData.isLab || (classData.group && ['G1', 'G2'].includes(classData.group));
  const isCopyMode = unlockedSlot?.isExtraCopy && (unlockedSlot.originalSlotId === classData.slotId || unlockedSlot.sessionId === classData.sessionId);
  const isMoveUnlocked = !unlockedSlot?.isExtraCopy && unlockedSlot && (unlockedSlot.slotId === classData.slotId || unlockedSlot.sessionId === classData.sessionId);
  const isUnlocked = isMoveUnlocked || isCopyMode;
  const isExtra = classData.overrideAction === 'ADD_EXTRA' || classData.isExtra;
  const isOverride = classData.isOverride || classData.overrideAction === 'RESCHEDULE';

  const cardClasses = ['card-class'];
  if (isLab) cardClasses.push('is-lab');
  if (isExtra) cardClasses.push('is-extra');
  if (isOverride) cardClasses.push('is-override');
  if (isMoveUnlocked) cardClasses.push('unlocked-drag');
  if (isCopyMode) cardClasses.push('copy-source');

  const handleDragStart = (e) => {
    // When dragging in Extra Class copy mode, drag the cloned copy object so original is undisturbed
    const dragPayload = isCopyMode ? unlockedSlot : classData;
    e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
    if (isMoveUnlocked) {
      e.currentTarget.style.opacity = '0.4';
    }
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  return (
    <div
      className={cardClasses.join(' ')}
      draggable={isUnlocked ? 'true' : undefined}
      onDragStart={isUnlocked ? handleDragStart : undefined}
      onDragEnd={isUnlocked ? handleDragEnd : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (rescheduleMode && unlockedSlot) return; // In active drop mode, ignore clicks on cards
        onClassClick(classData);
      }}
    >
      <div className="card-tags">
        {isLab && <span className="tag-badge tag-lab">LAB</span>}
        {classData.group && <span className="tag-badge tag-group">{classData.group}</span>}
        {isExtra && <span className="tag-badge tag-extra">SCHEDULED</span>}
        {isOverride && <span className="tag-badge tag-override">RESCHEDULED</span>}
      </div>

      <div className="card-code">{classData.subjectCode || 'CLASS'}</div>

      <div className="card-meta">
        {currentView !== 'faculty' && (classData.facultyName || classData.facultyId) && (
          <div>👤 {classData.facultyName || classData.facultyId}</div>
        )}
        {currentView !== 'section' && classData.sectionId && (
          <div>👥 {classData.sectionId}</div>
        )}
        {currentView !== 'room' && classData.roomNo && (
          <div>📍 {classData.roomNo}</div>
        )}
      </div>
    </div>
  );
}
