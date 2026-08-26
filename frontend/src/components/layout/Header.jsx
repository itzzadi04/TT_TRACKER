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
      {/* Top Tier: Official Identity (White) */}
      <div className="header-top-tier">
        <div className="header-top-content">
          <div className="institutional-identity">
            <div className="seal-wrapper">
              {!imgError ? (
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkUixFRNe-zKRoVyhpOGLA_d-Xqyt-6rD3Dt2LjtGn1g68IJavZUpwSposJly4Avi6vbsWxZmyGeEcNeTYuzIGKGWRn_9aWiW9FQoo7S9OP3600uhpJhZgQg3gUQGbFjhxkKfzFDYlgU80TrE3Mf4t-HWeWeB-UJrdD0vtl4uGwICxWilLI81vFdUHHGQXN7SELxLd79MVvu5twARZ9daDCqp4HzbIXVRwClEXLdQCg8XYdcJklwAV"
                  alt="NIT Hamirpur Seal"
                  className="seal-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="seal-fallback">NITH</div>
              )}
            </div>
            <div className="identity-titles">
              <span className="title-hindi">राष्ट्रीय प्रौद्योगिकी संस्थान हमीरपुर</span>
              <span className="title-english">National Institute of Technology Hamirpur</span>
            </div>
          </div>
          <div className="header-right-meta">
            <span className="app-title-badge">Academic Timetable Studio</span>
          </div>
        </div>
      </div>

      {/* Bottom Tier: Dark Navy Navigation */}
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
