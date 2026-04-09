# Claude Code - Project Guidelines

## Project Overview
**TeamTaatom** is a production-level travel & location-based social platform.
- **Tech Stack**: React Native (Expo), Express.js, MongoDB, Cloudinary
- **Status**: Existing production app - stability is priority
- **Branch**: `release/rootedAI`

---

## Core Rules for All Work

### ✅ ALLOWED
- Fix bugs (minimal change only)
- Add features listed in `/features.md`
- Reuse existing components and patterns
- Read code before modifying

### ❌ NEVER DO
- Refactor working code
- Rename variables/files
- Change architecture
- Optimize code unless required for bug fix
- Touch unrelated files
- Add features beyond what's requested

---

## Bug Fixing Process

1. **Understand first** - Read the relevant files completely
2. **Explain root cause** - Document why the bug exists
3. **Minimal fix** - Apply the smallest possible change
4. **Test context** - Verify it doesn't break related features


## Feature Development

**Features to implement**:
1. Travel History Page - Show past trips with images/description
2. Drag & Drop Page Builder - Add text + images with simple layout

**Constraints**:
- Must not affect existing features
- Must integrate with current structure
- Reuse existing UI patterns

---

## Project Structure at a Glance

```
frontend/                 # React Native (Expo)
├── app/                 # Expo Router pages
├── components/          # Reusable components
├── services/            # API clients
├── context/             # State management
└── .env                 # Config (keep secure)

backend/                 # Express.js API
├── src/
│   ├── controllers/     # Route handlers
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, validation
│   └── jobs/            # Background jobs
├── migrations/          # DB migrations
└── .env                 # Config (keep secure)

SuperAdmin/              # React admin dashboard
├── src/pages/           # Admin pages
├── src/components/      # UI components
└── src/services/        # API calls

.claude/
├── rules/               # Project rules
└── CLAUDE.md           # This file
```

---

## Before Starting Any Task

1. **Read the relevant rule files**:
   - `instructions.md` - Workflow steps
   - `context.md` - Architecture
   - `bugs.md` - Known issues
   - `features.md` - Planned work

2. **Acknowledge understanding**: "I have read the rules and context"

3. **Plan before coding**: Outline approach, show files affected

4. **Ask if unsure**: Risk is lower than guessing

---

## Environment Setup

**See `ENV_SETUP.md` for**:
- Required environment variables
- How to run each service
- Database migration commands
- Development workflow

---

## Key Git Info

- **Main branch**: `main`
- **Current branch**: `release/rootedAI`
- **User**: gokulkrishAstus
- **Important**: Always create NEW commits (never amend)

---

## What NOT to Search/Change

- Don't refactor unless explicitly asked
- Don't optimize code
- Don't change file structure
- Don't modify unrelated features
- Don't add speculative error handling

---

## When Things Break

1. **Read the error** - Don't skip it
2. **Check git status** - See what changed
3. **Investigate root cause** - Fix the problem, not the symptom
4. **Ask for help** - If genuinely stuck, ask the user

---

## Output Format for All Tasks

Always provide (in this order):
1. **Understanding** - What I read and learned
2. **Plan** - What I will do and why
3. **Changes** - Files affected and why
4. **Code** - The actual changes (minimal)

---

## Team & Contacts

- **Lead**: gokulkrishAstus (git user)
- **Stack**: React Native + Express.js + MongoDB
- **Deployment**: Managed via CI/CD (check `.github/workflows/`)

---

## Quick Commands Reference

```bash
# Backend
cd backend && npm install
npm run dev                 # Start dev server
npm run migrate:up         # Run migrations
npm test                   # Run tests

# Frontend
cd frontend && npm install
npm start                  # Start Expo
npm run update-config      # Sync .env to app.json

# SuperAdmin
cd SuperAdmin && npm install
npm run dev                # Start admin dashboard
```

---

## When Working on Agents

- Agents follow these same rules
- Each agent reads this file before starting
- Agents delegate understanding to you, not the other way around
- If an agent's approach differs from this file, ask the agent to re-read it

---

**Last updated**: 2026-04-09
**Branch**: release/rootedAI
**Status**: Production app - stability first
