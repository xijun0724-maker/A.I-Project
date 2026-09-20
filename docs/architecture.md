# Journey A.I — Architecture

## Overview

Journey A.I is a single-page web application built with vanilla JavaScript (ES2022) and zero runtime dependencies. All data persists in `localStorage`. AI features connect to OpenAI-compatible APIs but have deterministic offline fallbacks.

## Module Layers

```
┌─────────────────────────────────────────────┐
│  index.html (SPA Shell + CDN Libraries)     │
├─────────────────────────────────────────────┤
│  src/main.js (Entry Point)                  │
├─────────────────────────────────────────────┤
│  src/app/bootstrap.js (Startup, Wiring)     │
├─────────────────────────────────────────────┤
│  src/core/ (Router, State, Store, Actions)  │
├─────────────────────────────────────────────┤
│  src/views/ (12 View Renderers)             │
├─────────────────────────────────────────────┤
│  src/domain/ (Business Logic)               │
│  ├── NLP (syllabus parsing)                 │
│  ├── RAG (BM25 document retrieval)          │
│  ├── Tasks (decomposition, priority)        │
│  ├── Planner (study scheduling)             │
│  ├── Coach (recommendations, analytics)     │
│  ├── Dashboard (KPIs, charts)               │
│  └── Pipeline (document import)             │
├─────────────────────────────────────────────┤
│  src/ai/ (OpenAI-compatible chat client)    │
├─────────────────────────────────────────────┤
│  src/utils/ (Helpers, Dates, DOM, MD, etc.) │
├─────────────────────────────────────────────┤
│  src/config/ (Constants, Schema)            │
├─────────────────────────────────────────────┤
│  localStorage (All Persistence)             │
│  sessionStorage (API Keys Only)             │
└─────────────────────────────────────────────┘
```

## Key Modules

### `src/core/router.js`

Hash-based SPA router. Maps view IDs to render functions. Handles `#/<view>` URL changes and renders the active view into `#viewRoot`.

### `src/core/store.js`

localStorage persistence layer. Manages the `Store.db` object, debounced saves, schema migrations, and data lookups. API keys are stripped before persistence.

### `src/core/actions.js`

Action dispatch layer. Maps `data-act` HTML attributes to handler functions via a dispatch table. All user interactions flow through this module.

### `src/domain/rag.js`

BM25 document retrieval index. Chunks uploaded documents, builds an inverted index, and provides extractive search for the AI tutor context.

### `src/ai/index.js`

Provider-agnostic AI client. Supports OpenAI, OpenRouter, Groq, Gemini, Ollama, and custom endpoints. Falls back to BM25 retrieval when no API key is configured.

## Data Model

All data lives in `localStorage` under the key `journeyai.db.v1`:

- `courses[]` — Academic courses
- `lessons[]` — Weekly lesson topics
- `events[]` — Assignments, exams, quizzes, projects (with subtasks)
- `readings[]` — Required/optional readings
- `documents[]` — Uploaded reference materials (full text stored)
- `chunks[]` — BM25-indexed text chunks (derived from documents)
- `chat[]` — AI tutor conversation history
- `activity[]` — Daily study activity log
- `plan[]` — Generated study plan items
- `settings` — Provider config, term dates, study hours

## Design Decisions

1. **Zero runtime dependencies** — All business logic is vanilla JS. CDN UMD libraries handle PDF, DOCX, and charts.
2. **Offline-first fallback** — The NLP engine is rule-based, the assistant falls back to BM25 extractive retrieval, and the planner uses greedy scheduling.
3. **Security** — API keys stored in `sessionStorage` (cleared on tab close), stripped before localStorage persistence, never logged.
4. **Action dispatch** — User interactions use `data-act` attributes on HTML elements, dispatched through a central table in `actions.js`.
