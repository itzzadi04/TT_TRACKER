import React, { useState } from 'react';

export default function Header({ workflowContext, currentMode }) {
  const [imgError, setImgError] = useState(false);

  // Status Badge Rendering
  let badgeClass = 'badge-status badge-editable';
  let badgeText = 'CURRENT WEEK: EDITABLE';

  if (currentMode === 'base') {
    badgeClass = 'badge-status badge-base';
    badgeText = 'BASE BLUEPRINT';
  } else if (currentMode === 'current') {
    const isEditable = workflowContext?.currentWeekEditable;
    badgeClass = `badge-status ${isEditable ? 'badge-editable' : 'badge-readonly'}`;
    badgeText = isEditable ? 'CURRENT WEEK: EDITABLE' : 'CURRENT WEEK: READ-ONLY';
  } else if (currentMode === 'next') {
    const isEditable = workflowContext?.nextWeekEditable;
    badgeClass = `badge-status ${isEditable ? 'badge-editable' : 'badge-readonly'}`;
    badgeText = isEditable ? 'NEXT WEEK: EDITABLE' : 'NEXT WEEK: LOCKED';
  }

  return (
    <header className="institutional-header">
      {/* Top Tier: Official NIT Hamirpur Identity (Clean White) */}
      <div className="header-top-tier">
        <div className="header-top-content">
          <div className="nith-brand-container">
            <div className="nith-logo-wrapper">
              {!imgError ? (
                <img
                  src="/assets/nith-logo.png"
                  alt="National Institute of Technology Hamirpur"
                  className="nith-logo-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="nith-logo-fallback">NITH</div>
              )}
            </div>
            <div className="nith-titles-stack">
              <span className="nith-hindi-title">राष्ट्रीय प्रौद्योगिकी संस्थान हमीरपुर</span>
              <h1 className="nith-english-title">National Institute of Technology Hamirpur</h1>
              <span className="nith-tagline">
                An Institute of National Importance · Ministry of Education, Govt. of India
              </span>
            </div>
          </div>

          <div className="header-right-meta">
            <span className="app-title-badge">Academic Timetable Studio</span>
          </div>
        </div>
      </div>

      {/* Bottom Tier: Institutional Navy Navigation Bar */}
      <div className="header-nav-tier">
        <div className="header-nav-content">
          <nav className="nav-links">
            <a href="#" className="nav-item">Home</a>
            <a href="#" className="nav-item active">Timetable</a>
            <a href="#" className="nav-item">Faculty</a>
            <a href="#" className="nav-item">Sections</a>
            <a href="#" className="nav-item">Rooms</a>
            <a href="#" className="nav-item">Guidelines</a>
          </nav>
          <div className="nav-user-actions">
            <span className={badgeClass}>{badgeText}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
