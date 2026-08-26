import React, { useState } from 'react';
import ClassCard from './ClassCard';

export default function TimetableGrid({
  gridData,
  currentView,
  rescheduleMode,
  unlockedSlot,
  onClassClick,
  onSlotDrop,
}) {
  const [dragOverCell, setDragOverCell] = useState(null);

  if (!gridData || !gridData.grid || !Array.isArray(gridData.grid) || gridData.grid.length === 0) {
    return (
      <section className="timetable-container">
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
          No timetable data available for this selection.
        </div>
      </section>
    );
  }

  const gridDays = gridData.grid;
  const firstDay = gridDays[0];
  const timeHeaders = firstDay.slots ? firstDay.slots.map((s) => `${s.start} - ${s.end}`) : [];

  return (
    <section className="timetable-container">
      <table className="timetable-grid">
        <thead>
          <tr>
            <th className="day-header-col">DAY / TIME</th>
            {timeHeaders.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridDays.map((dayRow) => (
            <tr key={dayRow.day}>
              <td className="day-header-col">{dayRow.day.toUpperCase()}</td>
              {(dayRow.slots || []).map((slotItem) => {
                const cellKey = `${dayRow.day}_${slotItem.start}`;
                const isOver = dragOverCell === cellKey;
                const isOccupied = !!slotItem.occupied;

                let classList = [];
                if (slotItem.multipleSlots && Array.isArray(slotItem.multipleSlots) && slotItem.multipleSlots.length > 0) {
                  classList = slotItem.multipleSlots;
                } else if (slotItem.data) {
                  classList = [slotItem.data];
                }

                const cellClasses = ['cell-slot'];
                if (rescheduleMode) cellClasses.push('target-active');
                if (isOver) cellClasses.push('drag-over');

                return (
                  <td
                    key={cellKey}
                    className={cellClasses.join(' ')}
                    onDragOver={(e) => {
                      if (rescheduleMode) {
                        e.preventDefault();
                        setDragOverCell(cellKey);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverCell === cellKey) setDragOverCell(null);
                    }}
                    onDrop={(e) => {
                      if (!rescheduleMode) return;
                      e.preventDefault();
                      setDragOverCell(null);
                      const raw = e.dataTransfer.getData('text/plain');
                      if (raw) {
                        try {
                          const slot = JSON.parse(raw);
                          onSlotDrop({
                            slot,
                            day: dayRow.day,
                            starting: slotItem.start,
                            ending: slotItem.end,
                            roomNo: slot.roomNo,
                          });
                        } catch (err) {
                          console.error('Failed to parse dropped slot', err);
                        }
                      }
                    }}
                    onClick={() => {
                      if (rescheduleMode && unlockedSlot) {
                        onSlotDrop({
                          slot: unlockedSlot,
                          day: dayRow.day,
                          starting: slotItem.start,
                          ending: slotItem.end,
                          roomNo: unlockedSlot.roomNo,
                        });
                      }
                    }}
                  >
                    <div className="cell-content-stack">
                      {isOccupied &&
                        classList.map((c, idx) => (
                          <ClassCard
                            key={c.slotId || c.originalSlotId || `${c.sessionId}_${idx}`}
                            classData={c}
                            currentView={currentView}
                            rescheduleMode={rescheduleMode}
                            unlockedSlot={unlockedSlot}
                            onClassClick={onClassClick}
                          />
                        ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
