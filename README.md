# Journey A.I

**AI-powered academic planning and study assistance system.**

Journey A.I helps students manage coursework, deadlines, and study schedules with intelligent syllabus analysis, task decomposition, and an AI study tutor — all running in your browser with zero server dependencies.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML](https://img.shields.io/badge/html-5-orange.svg)
![CSS](https://img.shields.io/badge/css-3-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-ES2022-yellow.svg)

## Features

- **Syllabus Import** — Upload PDF, DOCX, or text syllabi. Journey parses deadlines, lessons, readings, and assessment weights automatically.
- **Task Management** — Track assignments, exams, projects, and quizzes with automatic effort estimation and priority scoring.
- **Study Planner** — Generates a weekly study schedule based on your available hours, deadlines, and priorities.
- **AI Study Tutor** — Ask questions about your courses, get summaries, and receive personalised study guidance (supports OpenAI, Groq, Ollama, and custom OpenAI-compatible endpoints).
- **Library & RAG** — Upload lecture notes, textbooks, and references. Built-in BM25 retrieval surfaces relevant passages for the AI tutor — no API key required.
- **Dashboard** — Visualise workload by week, track completion rates, view grades, and monitor study trends.
- **Calendar Export** — Export deadlines to Google Calendar, Outlook, or Apple Calendar as `.ics` files.
- **Accessible Design** — Keyboard navigation, screen reader support, reduced motion, and print-optimised styles.

## Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/journey-ai.git
   cd journey-ai
   ```

   > Replace `YOUR_USERNAME` with your GitHub username.

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

A demo dataset is seeded automatically on first visit.

## Usage

### Importing a Syllabus

1. Click **Import syllabus** in the sidebar or top bar.
2. Drag-and-drop or select a PDF, DOCX, TXT, or CSV file.
3. Review the extracted lessons, deadlines, and readings.
4. Confirm to add them to your courses.

### Using the AI Tutor

1. Navigate to **AI tutor** in the sidebar.
2. Connect a provider in **Settings** (OpenAI, Groq, Ollama, or a custom endpoint).
3. Ask questions about your uploaded documents and courses.

### Building a Study Plan

1. Go to **Planner** and set your available study hours.
2. Click **Generate plan** to create a weekly schedule.
3. Export to CSV or follow the plan directly in the app.

## Architecture

Journey A.I is a single-page web application with:

- **Zero runtime dependencies** — runs on vanilla JavaScript and browser APIs.
- **UMD libraries** loaded via CDN for PDF parsing (`pdf.js`), DOCX extraction (`mammoth`), and charts (`Chart.js`).
- **localStorage** for all persistence — no backend required.
- **BM25 retrieval** for document search — runs entirely in the browser.
- **Provider-agnostic AI** — supports any OpenAI-compatible API.
- **Service Worker** caches CDN libraries and Google Fonts for faster repeat loads.

### Security

- API keys are stored in `sessionStorage` (not `localStorage`) and are never written to disk.
- Keys are stripped before any data is persisted to `localStorage`.
- Documents never leave your browser unless you ask the AI tutor a question with a connected provider.

### Project Structure

```
journey-ai/
├── index.html              # Entry HTML (loads the ES module bundle)
├── style.css               # All styles (paper/ink aesthetic)
├── sw.js                   # Service Worker (caches CDN libs + fonts)
├── vite.config.js          # Vite dev server + test config
├── src/                    # Application source
│   ├── main.js             # ES module entry point — wires views, router, actions, boot
│   ├── config/             # Constants, provider definitions
│   ├── core/               # Router, state, localStorage store
│   │   ├── actions/        # Action dispatch + domain modules (courses, tasks, exports, settings, import, planner)
│   │   └── ...
│   ├── utils/              # Helpers, dates, DOM, markdown
│   ├── domain/             # Business logic — tasks, NLP, RAG, planner, coach, dashboard, pipeline
│   ├── ai/                 # LLM provider layer (OpenAI-compatible, provider-agnostic)
│   └── views/              # Screen renderers
│       ├── modals/         # Entity modals (course, event, lesson, doc, reading, help)
│       └── ...
├── tests/                  # Vitest unit + integration tests
│   └── vitest/             # Unit and integration tests
├── docs/                   # Documentation assets
├── LICENSE                 # MIT License
└── CONTRIBUTING.md         # Contribution guide
```

The entry point is `src/main.js`, loaded as an ES module in `index.html`.

## Development

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start Vite dev server with hot reload |
| `npm run build`        | Production build to `dist/`           |
| `npm run preview`      | Preview the production build          |
| `npm run lint`         | Run ESLint on `src/`                  |
| `npm run lint:fix`     | Auto-fix lint issues                  |
| `npm run test`         | Run Vitest unit tests                 |
| `npm run test:watch`   | Run tests in watch mode               |
| `npm run format`       | Format code with Prettier             |
| `npm run format:check` | Check formatting without writing      |

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration testing.

```bash
npm run test          # Run all tests once
npm run test:watch    # Run tests in watch mode
```

Test coverage spans:

| Test suite            | Tests   |
| --------------------- | ------- |
| Action dispatch       | 16      |
| AI client             | 22      |
| Coach recommendations | 15      |
| Dashboard & KPIs      | 16      |
| Date utilities        | 37      |
| Helper utilities      | 34      |
| Markdown rendering    | 15      |
| NLP / text extraction | 33      |
| Planner scheduling    | 13      |
| RAG retrieval         | 23      |
| Router & navigation   | 19      |
| Secure storage        | 19      |
| Settings              | 6       |
| Store                 | 16      |
| Task extensions       | 17      |
| Task progress         | 6       |
| Tasks                 | 15      |
| **Total**             | **322** |

All tests run without a browser, API keys, or network access — they exercise pure functions and in-memory stores.

## AI Provider Setup

Journey A.I works without any AI provider — the syllabus analyser, deadline extraction, task decomposition, retrieval, and planner are all built in. Connecting a provider adds conversational explanations, smarter parsing, and a written study plan.

See [`.env.example`](.env.example) for a guide to obtaining API keys for each supported provider.

**Supported providers:**

| Provider        | Key Required | Default Model             |
| --------------- | ------------ | ------------------------- |
| OpenAI          | Yes          | `gpt-4o-mini`             |
| OpenRouter      | Yes          | `openai/gpt-4o-mini`      |
| Groq            | Yes          | `llama-3.3-70b-versatile` |
| Google Gemini   | Yes          | `gemini-2.5-flash`        |
| Ollama (local)  | No           | `llama3.1`                |
| Custom endpoint | Depends      | Configurable              |

For local Ollama, start it with:

```bash
OLLAMA_ORIGINS=* ollama serve
```

## Service Worker

The service worker (`sw.js`) caches CDN libraries (pdf.js, mammoth, Chart.js) and Google Fonts using a cache-first strategy. This provides:

- Faster repeat page loads
- Offline access to cached assets
- Automatic cache invalidation on version bump (`journeyai-v1`)

The service worker is registered automatically in `bootstrap.js` when the page is served over HTTPS or localhost.

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). For best results use a local server — `npm run dev` starts one with hot reload.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style guidelines, and the pull request workflow.

## License

[MIT](LICENSE) — © 2024–2026 Journey A.I Contributors
