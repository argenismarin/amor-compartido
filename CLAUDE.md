# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Amor Compartido** - A couple's shared task management PWA for Jenifer and Argenis. Users can create, assign, and track tasks with custom themed interfaces.

## Commands

```bash
npm run dev      # Development server at http://localhost:3000
npm run build    # Production build
npm run start    # Production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16.1.4 with React 19
- **Styling**: Tailwind CSS 4 + custom CSS variables
- **Database**: PostgreSQL via pg with connection pooling
- **Deployment**: Vercel

## Architecture

### File Structure
```
src/
├── app/
│   ├── api/
│   │   ├── tasks/route.js         # GET/POST tasks
│   │   ├── tasks/[id]/route.js    # PUT/DELETE task by ID
│   │   └── users/route.js         # GET/PUT users
│   ├── layout.js                  # Root layout, PWA metadata
│   ├── page.js                    # Main SPA component (all UI logic)
│   └── globals.css                # All styling with CSS variables
└── lib/
    └── db.js                      # MySQL connection pool & schema init
```

### Database Schema

Tables prefixed with `AppChecklist_`:

- **AppChecklist_users**: id, name, avatar_emoji, created_at
- **AppChecklist_tasks**: id, title, description, assigned_to, assigned_by, is_completed, completed_at, due_date, priority (low/medium/high), timestamps

Default users auto-initialized: Jenifer (ID 1) and Argenis (ID 2).

### Frontend Architecture

Single-page app in `page.js` with all state management:
- User context persisted in localStorage (`currentUserId`)
- Tab system: "Mis Tareas" vs "Para [Partner]"
- Collapsible section for tasks assigned by partner
- Modal for task create/edit
- TaskCard component renders individual tasks

### Theming System

Dual themes via `data-user` attribute on root element:
- `[data-user="jenifer"]` - Pink/coral palette
- `[data-user="argenis"]` - Burgundy/wine palette

Task cards color-coded by assigner (`.from-jenifer`, `.from-argenis`).

### API Patterns

- `initDatabase()` called on API requests to ensure schema exists
- Tasks sorted: incomplete first → priority DESC → created_at DESC
- GET /api/tasks accepts `userId` and `filter` params: 'myTasks', 'assignedByOther', 'assignedToOther'

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

## Path Aliases

`@/*` maps to `./src/*` (configured in jsconfig.json)

## Key Conventions

- All text/UI in Spanish
- Mobile-first design (max-width: 500px)
- No authentication - simple user switching
- Date formatting uses 'es' locale
