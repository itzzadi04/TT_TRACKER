import React from 'react';

export default function Footer() {
  return (
    <footer className="institutional-footer">
      <div className="footer-content">
        <div className="footer-grid">
          {/* Column 1: Institutional & Studio Info */}
          <div className="footer-col">
            <div className="footer-brand-title">National Institute of Technology Hamirpur</div>
            <p className="footer-subtext">
              Academic Timetable Studio — Real-time scheduling, conflict prevention, and dynamic lecture hall orchestrator.
            </p>
            <p className="footer-subtext" style={{ marginTop: '8px', color: '#94a3b8' }}>
              Hamirpur, Himachal Pradesh, India — 177005
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-col">
            <h4 className="footer-heading">Quick Links</h4>
            <div className="footer-link-list">
              <a href="#">Faculty Schedules</a>
              <a href="#">Section Matrices</a>
              <a href="#">Room Occupancy</a>
              <a href="#">Academic Guidelines</a>
            </div>
          </div>

          {/* Column 3: Developers Section (Matches Screenshot) */}
          <div className="footer-col footer-dev-col">
            <h3 className="footer-dev-heading">Developers</h3>
            <div className="developer-names-list">
              <div className="developer-name-item">Ankur Gupta</div>
              <div className="developer-name-item">Aditya Sharma</div>
              <div className="developer-name-item">Akarsh</div>
            </div>

            <div className="source-code-wrapper">
              <a
                href="https://github.com/itzzadi04/TT_TRACKER"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-source-code"
              >
                <svg
                  className="github-icon"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="currentColor"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Source Code</span>
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom-strip">
          <div>© {new Date().getFullYear()} National Institute of Technology Hamirpur. All Rights Reserved.</div>
          <div className="footer-bottom-legal">An Institute of National Importance · Ministry of Education</div>
        </div>
      </div>
    </footer>
  );
}
