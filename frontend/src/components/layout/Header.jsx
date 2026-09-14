import React, { useState } from 'react';

export default function Header({ activeNav = 'sections', onNavSelect }) {
  const [imgError, setImgError] = useState(false);

  const handleNav = (navKey) => {
    if (onNavSelect) {
      onNavSelect(navKey);
    }
  };

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
          <nav className="nav-links" aria-label="Primary Navigation">
            <button
              type="button"
              className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
              onClick={() => handleNav('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`nav-item ${activeNav === 'timetable' ? 'active' : ''}`}
              onClick={() => handleNav('timetable')}
            >
              Timetable
            </button>
            <button
              type="button"
              className={`nav-item ${activeNav === 'faculty' ? 'active' : ''}`}
              onClick={() => handleNav('faculty')}
            >
              Faculty
            </button>
            <button
              type="button"
              className={`nav-item ${activeNav === 'sections' ? 'active' : ''}`}
              onClick={() => handleNav('sections')}
            >
              Sections
            </button>
            <button
              type="button"
              className={`nav-item ${activeNav === 'rooms' ? 'active' : ''}`}
              onClick={() => handleNav('rooms')}
            >
              Rooms
            </button>
            <button
              type="button"
              className={`nav-item ${activeNav === 'guidelines' ? 'active' : ''}`}
              onClick={() => handleNav('guidelines')}
            >
              Guidelines
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
