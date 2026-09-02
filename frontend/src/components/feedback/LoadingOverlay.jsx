import React from 'react';

export default function LoadingOverlay({ show, label = 'Updating timetable...' }) {
  if (!show) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-card">
        <div className="loading-spinner" />
        <span>{label}</span>
      </div>
    </div>
  );
}
