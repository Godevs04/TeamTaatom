# Antigravity Static Knowledge Graph

## 1. System Architecture
- **Primary Tech Stack:** Frontend (Expo React Native, Recoil, TanStack React Query, Axios), Backend (Node.js Express, MongoDB Mongoose, Socket.io, Cloudinary, AWS S3), Web App (Next.js, TailwindCSS, TypeScript), SuperAdmin Portal (Vite React, React Router, TailwindCSS, Recharts).
- **Core Objective:** Taatom is a mobile-first journey tracking, trip planning, and social location-sharing application enabling real-time navigation, trip score evaluation, media sharing, and comprehensive administrative controls.

## 2. Directory Map (DO NOT SCAN FOLDERS - RELY ON THIS MAP)
- `/backend`: Node.js Express API.
  - `src/models`: Mongoose schemas (User, Journey, TripVisit, Post, Chat, Song).
  - `src/routes/v1`: Express endpoint definitions mapped under versioned router routes.
  - `src/services`: Core backend business logic (location processing, trip scoring).
  - `src/middleware`: JWT authentication, CSRF, rate-limiting, and Sentry logging.
- `/frontend`: Mobile application using Expo React Native.
  - `app`: Expo Router file-based routing/navigation screens (auth, tabs, chat, journeys).
  - `components`: Reusable design-system UI components.
  - `context`: Recoil state definitions.
  - `services`: Axios REST clients and WebSocket messaging.
- `/web`: Next.js web client.
  - `app`: Pages router layout, public portal routes, and dashboard layouts.
- `/SuperAdmin`: Admin console using Vite + React.
  - `src`: React Router dashboard views for user, activity, and settings management.
- `/Tool`: Script utility directory (e.g., simulateJourney.js, LAN IP configuring helpers).

## 3. Core Dependency Graph
- **Frontend App** / **Next.js Web** / **SuperAdmin Dashboard** -> communicate via Axios/WebSockets -> **Backend (Express)**.
- **Backend Router/Controllers** -> read/write data using -> **Mongoose Models** (User, Journey, Post, TripVisit).
- **Mongoose Models** -> are serialized & persist to -> **MongoDB** / Media uploads -> **AWS S3 / Cloudinary**.
- **Backend Services** -> consume Location/Trip updates -> recalculate **Trip Visits & Trip Scores** dynamically.

## 4. STRICT CONTEXT RULES FOR ALL FUTURE PROMPTS
- **DO NOT** read files outside the directory of the immediate task unless explicitly instructed.
- **ASSUME** the architecture defined in this document is accurate and up-to-date.
- **DO NOT** run exploratory filesystem searches (`grep`, `ls`, etc.) unless the requested file is completely missing from this map.
- **DEFAULT TO:** Assuming the existence of standard library functions and previously established components. Do not verify them unless an error occurs.

---
# IMMUTABLE OVERRIDE: EDIT MODE
Whenever a user prompt contains the phrase "Edit mode", "Edit mode:", or "Enter edit mode", you must immediately shift into STRICT EXECUTION MODE.

**Rules of STRICT EXECUTION MODE:**
1. **Zero Planning:** Skip all outlining, architectural debate, and step-by-step explanations.
2. **Zero Chatter:** Provide no conversational filler, pleasantries, or summaries of what you have done. 
3. **Direct Action:** Output ONLY the exact code modifications, `diffs`, or direct MCP edit commands required.
4. **Laser Focus:** Target only the specific files directly mentioned or inherently required by the user's prompt. Do not attempt to refactor adjacent files unless explicitly ordered.
