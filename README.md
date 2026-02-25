# Experience UI

**AI-powered API explorer that turns API specifications into interactive user interfaces.**

Experience UI wraps the [GitHub Copilot CLI](https://docs.github.com/en/copilot) and uses it to automatically generate human-friendly interfaces from API specs. Point it at an OpenAPI, Swagger, or GraphQL schema, and it builds a fully functional UI to browse and interact with that API — no manual coding required.

## What It Does

1. **Ingest an API spec** — Upload, paste, or provide a URL to an OpenAPI 3.x, Swagger 2.0, or GraphQL schema.
2. **Auto-generate a UI** — The Copilot CLI analyzes the spec and generates a React-based interface tailored to the API's endpoints and data models.
3. **Customize with natural language** — Ask for changes in plain English ("add a search bar", "show this as a card grid", "switch to dark mode") and the interface updates in real time.
4. **Connect to live APIs** — Authenticate with API keys, Bearer tokens, or OAuth 2.0 and see real data flowing through the generated interface.
5. **Version & rollback** — Every change is versioned. Revert to any previous state in under 3 seconds.
6. **Extend with plugins** — Install MCP servers and other tools that the generated UIs can leverage.

## Key Features

- 💬 **Chat panel** — Interact with the Copilot CLI on the left side to describe what you want
- 📑 **Multi-tab workspaces** — Work with multiple APIs simultaneously, each in its own tab
- 🔍 **Debug console** — Inspect raw API requests and responses for troubleshooting
- 🔒 **Sandboxed rendering** — Generated UIs run in secure iframes with strict Content Security Policy
- 🔄 **Full version history** — Browse, diff, and revert every change ever made to an interface
- 🔌 **Plugin system** — Install MCP servers and tools to extend generation capabilities

## Architecture

Experience UI is an **Electron 34** desktop application built with **React 19** and **TypeScript** (strict mode).

### Process Model

The application uses three distinct processes with clear security boundaries:

```
┌─────────────────────────────────────────────────────┐
│                   Electron Main                      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │ CLI Mgr  │ │API Proxy │ │Keychn  │ │ Plugins  │ │
│  │(subprocess│ │(HTTP fwd)│ │(keytar)│ │(MCP etc) │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └────┬─────┘ │
│       │ stdin/stdout│           │            │       │
│  ┌────▼─────┐      │           │            │       │
│  │Copilot   │      │      IPC (contextBridge)       │
│  │CLI       │      │           │            │       │
│  └──────────┘ ─────┼───────────┼────────────┼───────│
│               ┌────▼───────────▼────────────▼────┐  │
│               │         Electron Renderer         │  │
│               │  ┌─────────┐  ┌────────────────┐ │  │
│               │  │Chat     │  │Content Area    │ │  │
│               │  │Panel    │  │ ┌────────────┐ │ │  │
│               │  │         │  │ │ Sandboxed  │ │ │  │
│               │  │(Copilot │  │ │ iframe     │ │ │  │
│               │  │ input)  │  │ │(generated  │ │ │  │
│               │  │         │  │ │ UI)        │ │ │  │
│               │  └─────────┘  │ └──────┬─────┘ │ │  │
│               │               │  postMessage   │ │  │
│               │               └────────────────┘ │  │
│               │  ┌─────────────────────────────┐ │  │
│               │  │    Debug Console (toggle)    │ │  │
│               │  └─────────────────────────────┘ │  │
│               └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Security Boundaries

| Boundary | Mechanism | Purpose |
|----------|-----------|---------|
| Main ↔ Renderer | Electron IPC via `contextBridge` | Isolate Node.js APIs from the UI process |
| Renderer ↔ Sandbox | `postMessage` with nonce verification | Generated code cannot access the host app |
| Host ↔ CLI | stdin/stdout JSON-RPC 2.0 | Managed subprocess with crash recovery |

Generated UIs are rendered inside sandboxed iframes with:
- Strict CSP (`default-src 'none'`, nonce-based scripts)
- No access to `window.parent`, `localStorage`, or the host filesystem
- All network requests proxied through the main process

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 34 |
| UI framework | React 19 |
| Language | TypeScript 5.x (strict) |
| State management | Zustand (5 domain stores) |
| Styling | Tailwind CSS 4 + Radix UI primitives |
| API parsing | swagger-parser, graphql |
| Code bundling | esbuild (in-process compilation) |
| Version storage | SQLite (better-sqlite3) + filesystem |
| Credential storage | keytar (OS keychain) |
| Testing | Vitest, React Testing Library, Playwright, axe-core |

### Project Structure

```
src/
├── main/              # Electron main process
│   ├── cli/           # Copilot CLI subprocess management
│   ├── proxy/         # Network proxy for sandboxed iframes
│   ├── credentials/   # OS keychain integration
│   ├── versions/      # SQLite version database
│   └── plugins/       # Plugin installation & lifecycle
├── renderer/          # React application
│   ├── components/    # UI components (chat, tabs, sandbox, console, auth, etc.)
│   ├── hooks/         # Custom React hooks (useCli, useTabs, useAuth, etc.)
│   ├── stores/        # Zustand state stores
│   └── services/      # Business logic (spec parsing, code generation, validation)
├── sandbox/           # Isolated runtime for generated UIs
└── shared/            # Cross-process types and constants
```

## Getting Started

> ⚠️ This project is under active development. See the [implementation plan](specs/001-api-ui-generator/plan.md) and [task breakdown](specs/001-api-ui-generator/tasks.md) for current status.

### Prerequisites

- Node.js 20+
- Copilot CLI installed
- Git

### Development

```bash
npm install
npm run dev       # Start in development mode
npm run test      # Run tests
npm run lint      # Lint code
npm run build     # Production build
```

## Documentation

- [Feature Specification](specs/001-api-ui-generator/spec.md)
- [Implementation Plan](specs/001-api-ui-generator/plan.md)
- [Task Breakdown](specs/001-api-ui-generator/tasks.md)
- [Data Model](specs/001-api-ui-generator/data-model.md)
- [Developer Quickstart](specs/001-api-ui-generator/quickstart.md)

## License

TBD