# Contributing to Journey A.I

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/journey-ai.git
   cd journey-ai
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint on `src/` |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |

## Code Style

- **No runtime dependencies** — all business logic is vanilla JS. CDN UMD libraries handle PDF, DOCX, and charts.
- **ES modules** — use `import`/`export`, not CommonJS.
- **ESLint flat config** — the project uses ESLint 9+ with flat config. Run `npm run lint` before committing.
- **Prettier** — run `npm run format` to auto-format.
- **Two-space indentation**, LF line endings (see `.editorconfig`).
- **No comments** in source code unless explicitly requested.
- **JSDoc** is used on exported functions and module headers.

## Architecture

```
src/
├── main.js              # Entry point
├── app/bootstrap.js     # Startup wiring
├── config/              # Constants and settings
├── core/                # Router, state, store, actions
├── domain/              # Business logic (tasks, NLP, RAG, planner, coach, dashboard)
├── ai/                  # LLM provider layer (OpenAI-compatible)
├── utils/               # Helpers, dates, DOM, markdown
└── views/               # Screen renderers (HTML string generation)
```

- **Views** return HTML strings. They do not manipulate the DOM directly.
- **Actions** handle user interactions dispatched via `data-act` attributes.
- **Domain modules** contain pure business logic and do not import from views.
- **All data persists in localStorage** via `src/core/store.js`.

## Testing

Tests live in `tests/vitest/` and use Vitest. Run them with:

```bash
npm run test
```

- Tests exercise pure functions and in-memory stores.
- No browser, API keys, or network access required.
- Add tests for new domain logic or utility functions.

## Pull Request Process

1. **Create a feature branch** from `main`.
2. **Make your changes** following the code style above.
3. **Run lint and tests** before pushing:
   ```bash
   npm run lint
   npm run test
   ```
4. **Write a clear commit message** describing what changed and why.
5. **Open a pull request** with a description of the change.

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests.
- Include steps to reproduce, expected behavior, and actual behavior.
- Mention your browser and OS.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
