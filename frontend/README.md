# Academic Timetable Studio — React Frontend

This directory contains the single-page application (SPA) for the **Academic Timetable Studio (NIT Hamirpur)**, built using **React 19** and **Vite**, styled with the **Stitch Institutional Academic Framework Design System**.

---

## 🏛️ Structure

```text
frontend/
├── public/
│   └── favicon.svg                    # Institutional Favicon
├── src/
│   ├── components/
│   │   ├── controls/                  # TimetableToolbar (View & Mode Switchers)
│   │   ├── feedback/                  # DragBanner, Toast
│   │   ├── layout/                    # Header (Two-Tier Institutional), Footer
│   │   ├── modals/                    # Action, CancelConfirm, RoomConflict, DropConfirm
│   │   └── timetable/                 # TimetableGrid, ClassCard
│   ├── hooks/
│   │   └── useTimetable.js            # Central State & Mutation Hook
│   ├── services/
│   │   └── api.js                     # REST API Client
│   ├── styles/
│   │   └── index.css                  # Stitch Design System Stylesheet
│   ├── App.jsx                        # Root React Studio Component
│   └── main.jsx                       # Application Entrypoint
├── index.html                         # Vite HTML Shell
├── package.json                       # Dependencies & Scripts
└── vite.config.js                     # Vite Config & Proxy to Port 3000
```

---

## 🚀 Running & Building

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server (with API proxy to http://localhost:3000)
npm run dev

# 3. Build production bundle into frontend/dist/
npm run build
```
