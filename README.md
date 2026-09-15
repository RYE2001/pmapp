# Waypoint — Project Management Starter

A working full-stack scaffold for a company-wide project management tool: accounts, projects,
teammates, a drag-and-drop Kanban board, time tracking, and a basic report view.

This is a **starting point**, not a finished product — see "What's next" at the bottom for what's
deliberately left out.

## Architecture

```
Browser (React + Vite)  ──HTTP──>  Backend API (Express + TypeScript)  ──>  PostgreSQL (via Prisma)
```

Every employee opens the same web app in their browser — no installer, works on any OS. The
backend is the single shared source of truth, so everyone sees the same boards update live.

- **backend/** — Express + TypeScript REST API, Prisma ORM, JWT auth, PostgreSQL
- **frontend/** — React + TypeScript + Vite + Tailwind, Kanban board with native drag-and-drop
- **docker-compose.yml** — spins up Postgres for local development

## Prerequisites

- Node.js 18 or newer
- Docker (for the easiest way to run Postgres) — or a Postgres instance you already have

## 1. Start the database

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user/password/db all set to `pmapp` (see
`docker-compose.yml`). If you'd rather use an existing Postgres instance, skip this and just
point `DATABASE_URL` (next step) at it.

## 2. Backend setup

```bash
cd backend
cp .env.example .env    # edit JWT_SECRET to a long random string before real use
npm install
npx prisma migrate dev --name init   # creates the tables
npm run db:seed                       # optional: reset local data and load the demo workspace
npm run dev              # starts the API on http://localhost:4000
```

The demo seed clears all local application data before creating a realistic workspace with three
projects, four users, tasks, skills, blockers, comments, decisions, assignments, availability,
planned time, work allocations, and logged time. All demo users use the password `demo1234`:
`amina@demo.waypoint.local`, `ali@demo.waypoint.local`, `sarah@demo.waypoint.local`, and
`karim@demo.waypoint.local`.
Open **Team capacity** after seeding to see Karim intentionally overloaded at about 139% and
Sarah flagged for context switching across three projects. Open **My timeline** to inspect the
planned work, meetings, support block, and unavailable time behind those signals.

The resource engine also exposes the canonical weekly allocation read model at
`GET /api/resources/me/allocations`. `WorkAllocation` unifies planned task work, meetings,
support, administration, training, unplanned work, and unavailable time. `TimeEntry` remains
the source of truth for actual work; synchronizing actual minutes into allocations is the next
resource-engine step.

`npx prisma migrate dev` needs internet access the first time (it downloads Prisma's local query
engine). If you're on a locked-down corporate network and it fails, try again from an
unrestricted connection — it only needs to happen once.

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env    # only needed if your API isn't on localhost:4000
npm install
npm run dev              # starts the app on http://localhost:5173
```

Open `http://localhost:5173`, create an account, and you're in.

## Using it

1. **Register** — the first account you create is just a normal user; there's no separate "admin
   signup." Whoever creates a project becomes its admin.
2. **Create a project** — from the Projects page.
3. **Add teammates** — inside a project, "Add teammate" adds anyone who already has an account,
   by email. (Multi-team companies: everyone registers once, then gets added to whichever
   projects apply to them.)
4. **Kanban board** — drag cards between To do / In progress / Done, or click a card to edit it,
   reassign it, set a due date/priority, or delete it.
5. **Time tracking** — open any task and log minutes with an optional note.
6. **Report** — "View report" on a project shows task counts by status, time logged per person,
   and overdue tasks.
7. **Blocked tasks** — drag a task into the Blocked column (or set its status to Blocked in the
   task modal) and you'll be asked what's blocking it. Any teammate can reply with a suggested
   fix directly on the task. If nobody on the team can solve it, whoever's blocked can flag it
   as "needs admin" — project admins then see a banner at the top of the board listing every
   externally-blocked task, so it surfaces even if no one goes looking for it. Moving a task out
   of Blocked (or hitting "Mark resolved" in the panel) closes it out automatically.
8. **My tasks** — use the My tasks link in the sidebar to see your assigned work across every
  project, with active blockers first and the remaining tasks sorted by due date.
9. **Project memory** — open Project memory from a project board to record decisions with their
   rationale, alternatives, evidence links, people involved, and impacted tasks. Decisions can be
   marked active, superseded, or reversed as the project evolves.
9. **Collaborate on a task** — open a task and use its Conversation panel to leave comments.
   Type `@` to select and mention a project teammate. The Activity panel keeps a recent history
   of task changes, comments, blocker changes, and logged time.
10. **Live boards** — teammates who have the same project board open see changes refresh
   automatically when tasks, comments, blockers, or time entries change.

## Project structure

```
pm-app/
├── docker-compose.yml
├── backend/
│   ├── prisma/schema.prisma      # data model: User, Project, ProjectMember, Task, TimeEntry
│   └── src/
│       ├── index.ts              # Express app + route mounting
│       ├── routes/               # auth, projects, tasks, timeEntries, reports
│       ├── middleware/auth.ts    # JWT verification
│       └── utils/jwt.ts
└── frontend/
    └── src/
      ├── api/client.ts         # typed fetch wrapper for the API
        ├── context/AuthContext.tsx
      ├── pages/                # Login, Projects, Board, MyTasks, ProjectMemory
        └── components/           # Layout, TaskCard, TaskModal, TimelineView
```

## What's next

This covers the core loop (projects → tasks → status → time → timeline → blockers → a basic report) but a few things
were deliberately left out of the starter so it stays a starting point rather than a 10,000-line
first response:

- **Notifications outside the app** — the admin blocker alert is in-app only (a banner on the
  board). Piping it to email or Slack when a task gets flagged "needs admin" would be the natural
  next step.
- **Finer-grained permissions** — currently just ADMIN/MEMBER per project.
- **Tests** — none yet; worth adding before this goes near production.
- **Deployment** — this runs locally; deploying means picking hosts for the API, Postgres, and
  the static frontend build (Railway, Render, Fly.io, or your own infra all work fine with this
  stack).

Happy to build out any of these next — just say which one.
