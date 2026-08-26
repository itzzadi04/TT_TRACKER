import React from 'react';

export default function Footer() {
  return (
    <footer className="institutional-footer">
      <div className="footer-content">
        <div className="footer-top">
          <div className="footer-brand">Academic Timetable Studio</div>
          <div className="footer-links">
            <a href="#">Quick Links</a>
            <a href="#">Contact Us</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} National Institute of Technology Hamirpur. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
