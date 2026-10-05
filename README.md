# Leather Pattern Studio

A parametric cutting-pattern generator for leather goods — built as a real
internal tool for [My Star Georgia](https://mystar.ge), a handmade leather
goods brand I founded, and open-sourced here as a full-stack demo.

Instead of hand-drafting a paper pattern for every new bag size or strap
width, this tool lets you describe a panel with a handful of parameters
(width, height, corner radius, seam allowance, strap count...) and get back
an accurate, print-ready SVG/PDF cutting template in seconds — served through
a versioned REST API, calculated identically on the client (for instant
feedback) and on the server (as the source of truth), and viewable from a
small Flutter companion app as well as the web.

It's deliberately built as **several small services that talk to each
other** rather than one monolith, because that's the kind of system this
project was written to practice and demonstrate:

```
┌─────────────────┐        ┌────────────────────┐        ┌───────────────┐
│   apps/web       │  REST  │     apps/api        │ enqueue│  apps/worker  │
│ React + TS       ├───────▶│ FastAPI              ├───────▶│ Redis / RQ    │
│ (packages/ui)    │  JSON  │ geometry + storage   │  job   │ async export  │
└─────────────────┘        └──────────┬──────────┘        └───────┬───────┘
                                       │ SQLAlchemy                │ writes
                                       ▼                           ▼
                                 ┌───────────┐              ┌─────────────┐
                                 │ Postgres/  │              │  exports/   │
                                 │ SQLite     │              │  *.svg,*.pdf│
                                 └───────────┘              └─────────────┘
        ┌───────────────────┐
        │ apps/mobile_flutter │   same REST API, read-only pattern viewer
        │ Flutter             │
        └───────────────────┘
```

## Why this project, for this application

This repo was built specifically to demonstrate the skills listed in
Canonical's Web Frontend Engineer (JS, CSS, React, Flutter) role: a
TypeScript/React frontend built on an accessible component layer (our own
small answer to Canonical's own [Vanilla Framework](https://vanillaframework.io/)
and [react-components](https://github.com/canonical/react-components)), a
REST API designed and documented deliberately, a Python backend service,
basic event processing between services, and a first, honest step into
Flutter. `ARCHITECTURE.md` goes through the reasoning behind each decision in
more depth, organised around the actual questions in Canonical's written
interview, so it doubles as my notes for that submission.

## What's here

| Path | What it is | Maps to |
|---|---|---|
| `packages/ui` | Accessible React + TS component primitives (`Slider`, `NumberField`, `ColorSwatch`, `Button`, `Field`) with full keyboard support, ARIA roles, and automated `axe-core` tests | CSS, accessibility, design-system thinking |
| `apps/web` | Vite + React + TypeScript pattern configurator, live SVG preview, calls the REST API | React, TypeScript, CSS |
| `apps/api` | FastAPI service: geometry engine (source of truth), SQLAlchemy models, Pydantic schemas, OpenAPI docs | Python, REST API design, data stores |
| `apps/worker` | RQ worker consuming a Redis queue to render SVG/PDF exports asynchronously after a pattern is saved | event processing, service integration |
| `apps/mobile_flutter` | Minimal Flutter screen that fetches a pattern from the same REST API and renders it | Flutter |
| `docs/API.md` | REST API design notes: versioning, error shape, idempotency | REST API governance |
| `ARCHITECTURE.md` | Architecture/maintainability/reliability/performance/quality reasoning, mapped to the written-interview questions | systems design, quality, performance |

## Running it

**Everything, with Docker:**

```bash
docker compose up --build
# web:     http://localhost:5173
# api:     http://localhost:8000/docs   (OpenAPI/Swagger UI)
# redis:   localhost:6379
# postgres: localhost:5432
```

**Piece by piece, for development:**

```bash
# API (Python 3.11+)
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Worker (needs Redis running — `docker run -p 6379:6379 redis` is enough)
cd apps/worker
pip install -r requirements.txt
python worker.py

# Web
cd apps/web
npm install
npm run dev

# UI library (used by apps/web via a local workspace link)
cd packages/ui
npm install && npm test

# Flutter companion app (needs the API running on localhost:8000)
cd apps/mobile_flutter
flutter pub get
flutter run
```

## Tests

```bash
cd apps/api && pytest
cd packages/ui && npm test
cd apps/web && npm test
cd apps/mobile_flutter && flutter test
```

## Status

This is an honest, working MVP, not a finished commercial product: panel
geometry currently covers rectangular and rounded-rectangle panels (the
shapes behind most strap, pocket, and gusset pieces) rather than every
possible leather component, and the Flutter app is intentionally a small,
real first step rather than a full mobile client. Both are called out
explicitly in `ARCHITECTURE.md` along with what a v2 would add — I'd rather
show a smaller thing working honestly than a bigger thing that's fake.

## License

MIT — see `LICENSE`.
