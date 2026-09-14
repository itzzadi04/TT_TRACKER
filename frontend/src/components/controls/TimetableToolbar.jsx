import React from 'react';
import { formatFacultyDisplay, formatSectionDisplay, formatRoomDisplay } from '../../utils/formatters';

export default function TimetableToolbar({
  currentView,
  currentMode,
  onModeChange,
  entities,
  selectedEntityId,
  onEntityChange,
  workflowContext,
  simulatedDay,
  onSimulatedDayChange,
}) {
  // Determine Entity Options & Labels
  let entityLabel = 'Select Faculty:';
  let entityOptions = [];

  if (currentView === 'faculty') {
    entityLabel = 'Select Faculty:';
    entityOptions = (entities.faculties || [])
      .map((f) => {
        const id = typeof f === 'string' ? f : f.facultyId;
        const label = formatFacultyDisplay(f);
        return { id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  } else if (currentView === 'section') {
    entityLabel = 'Select Section:';
    entityOptions = (entities.sections || []).map((s) => {
      const id = typeof s === 'string' ? s : s.sectionId;
      const label = formatSectionDisplay(s);
      return { id, label };
    });
  } else if (currentView === 'room') {
    entityLabel = 'Select Room:';
    entityOptions = (entities.rooms || []).map((r) => {
      const id = typeof r === 'string' ? r : r.roomNo;
      const label = formatRoomDisplay(r, { withType: true });
      return { id, label };
    });
  }

  const currentWeekFormatted = workflowContext?.currentWeekFormatted || '';
  const nextWeekFormatted = workflowContext?.nextWeekFormatted || '';
  const todayFormatted = workflowContext?.todayFormatted || workflowContext?.today || 'Loading...';
  const isDevMode = !!workflowContext?.devMode;

  const viewMeta = {
    faculty: {
      title: 'FACULTY TIMETABLE',
      desc: 'Official teaching schedules, faculty workload, and individual lecture allocations',
    },
    section: {
      title: 'SECTION TIMETABLE',
      desc: 'Class curriculum matrix, theory lectures, and laboratory sessions',
    },
    room: {
      title: 'ROOM OCCUPANCY MATRIX',
      desc: 'Lecture hall and computer laboratory utilization schedule',
    },
  }[currentView] || {
    title: 'ACADEMIC TIMETABLE',
    desc: 'Official schedule orchestrator for faculty, sections, and lecture halls',
  };

  return (
    <section className="toolbar-card">
      {/* Row 1: Academic Page Heading */}
      <div className="toolbar-row-top">
        <div className="page-heading">
          <h1>{viewMeta.title}</h1>
          <p>{viewMeta.desc}</p>
        </div>
      </div>

      {/* Row 2: Entity Filter, Schedule Mode, Real Date, Dev Simulation */}
      <div className="toolbar-row-bottom">
        <div className="toolbar-controls-left">
          {/* Entity Dropdown */}
          <div className="control-field">
            <label className="control-label" htmlFor="entitySelect">
              {entityLabel}
            </label>
            <select
              id="entitySelect"
              className="form-control"
              value={selectedEntityId || ''}
              onChange={(e) => onEntityChange(e.target.value)}
            >
              {entityOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Mode Toggle */}
          <div className="schedule-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${currentMode === 'current' ? 'active' : ''}`}
              onClick={() => onModeChange('current')}
            >
              Current Week {currentWeekFormatted ? `(${currentWeekFormatted})` : ''}
            </button>
            <button
              type="button"
              className={`mode-btn ${currentMode === 'next' ? 'active' : ''}`}
              onClick={() => onModeChange('next')}
            >
              Next Week {nextWeekFormatted ? `(${nextWeekFormatted})` : ''}
            </button>
            <button
              type="button"
              className={`mode-btn ${currentMode === 'base' ? 'active-base' : ''}`}
              onClick={() => onModeChange('base')}
            >
              Base Timetable
            </button>
          </div>
        </div>

        <div className="toolbar-controls-right">
          {/* Real Date Badge */}
          <div className="real-date-chip">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              calendar_month
            </span>
            <span>
              Today: <strong>{todayFormatted}</strong>
            </span>
          </div>

          {/* Dev Mode Simulation Dropdown (Hidden in Production) */}
          {isDevMode && (
            <div
              className="control-field dev-sim-field"
              style={{
                background: '#fffbeb',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px dashed #f59e0b',
              }}
            >
              <label
                className="control-label"
                htmlFor="simulatedDaySelect"
                style={{ color: '#b45309', fontSize: '11px' }}
              >
                [DEV] Simulate:
              </label>
              <select
                id="simulatedDaySelect"
                className="form-control"
                style={{ fontSize: '11px', padding: '3px 6px', minWidth: '110px' }}
                value={simulatedDay || ''}
                onChange={(e) => onSimulatedDayChange(e.target.value || null)}
              >
                <option value="">Real Date</option>
                <option value="Monday">Monday (Weekday)</option>
                <option value="Wednesday">Wednesday (Weekday)</option>
                <option value="Friday">Friday (Weekday)</option>
                <option value="Saturday">Saturday (Weekend)</option>
                <option value="Sunday">Sunday (Weekend)</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
