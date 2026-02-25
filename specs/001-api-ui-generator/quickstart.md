# Quickstart: API-Driven UI Generator

**Feature Branch**: `001-api-ui-generator`
**Date**: 2025-07-24

---

## Prerequisites

- **Node.js**: ≥20.x LTS
- **npm**: ≥10.x (bundled with Node.js 20)
- **Git**: ≥2.x
- **GitHub Copilot CLI**: Installed and authenticated (`gh copilot` available in PATH)
- **OS**: Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+)

---

## Project Setup

```bash
# Clone and switch to feature branch
git clone <repo-url> experience-ui
cd experience-ui
git checkout 001-api-ui-generator

# Install dependencies
npm install

# Verify Copilot CLI is available
gh copilot --version
```

---

## Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Electron | 34.x | Desktop shell, IPC, window management |
| **Language** | TypeScript | 5.x (strict) | Type-safe development |
| **UI Framework** | React | 19.x | Component-based UI |
| **State Management** | Zustand | 5.x | Lightweight, hook-based stores |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS with design tokens |
| **UI Primitives** | Radix UI | latest | Accessible component primitives |
| **Icons** | lucide-react | latest | Consistent icon set |
| **Layout** | react-resizable-panels | latest | Accessible split panes |
| **Virtualization** | @tanstack/virtual | latest | Performant list rendering |
| **Bundler** | Vite + electron-vite | latest | Fast dev/build for Electron |
| **In-app Bundler** | esbuild | latest | Compile generated UI code |
| **API Parsing** | @apidevtools/swagger-parser | 10.x | OpenAPI/Swagger validation |
| **API Conversion** | swagger2openapi | 7.x | Swagger 2.0 → OpenAPI 3.x |
| **GraphQL** | graphql | 16.x | GraphQL schema parsing |
| **Database** | better-sqlite3 | latest | Version history metadata |
| **Credentials** | keytar | 7.x | OS keychain integration |
| **Diff** | diff-match-patch | latest | Version comparison |
| **Testing** | Vitest | latest | Unit and integration tests |
| **Component Testing** | React Testing Library | latest | Component behavior tests |
| **E2E Testing** | Playwright | latest | End-to-end tests |
| **Accessibility** | axe-core | latest | Automated a11y audits |
| **Linting** | ESLint | 9.x | Code quality enforcement |
| **Formatting** | Prettier | latest | Code formatting |
| **Pre-commit** | husky + lint-staged | latest | Local verification gate |

---

## Development Commands

```bash
# Start development (Electron with hot-reload)
npm run dev

# Run tests
npm run test              # Unit + integration tests (Vitest)
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:e2e          # End-to-end tests (Playwright)

# Code quality
npm run lint              # ESLint check
npm run lint:fix          # ESLint auto-fix
npm run format            # Prettier format
npm run type-check        # TypeScript strict type checking

# Build
npm run build             # Production build
npm run build:analyze     # Build with bundle analyzer
npm run package           # Package Electron app for distribution

# Pre-commit (runs automatically via husky)
npm run pre-commit        # lint-staged: lint + type-check + test on staged files
```

---

## Project Structure

```text
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window management
│   ├── preload.ts           # Preload script (contextBridge)
│   ├── cli/                 # Copilot CLI subprocess management
│   ├── proxy/               # Network proxy for sandboxed iframes
│   ├── credentials/         # OS keychain integration
│   └── plugins/             # Plugin installation & lifecycle
│
├── renderer/                # React application
│   ├── index.tsx            # React root mount
│   ├── App.tsx              # Top-level layout
│   ├── components/          # UI components (by domain)
│   │   ├── chat/            # Chat panel
│   │   ├── tabs/            # Tab management
│   │   ├── sandbox/         # Iframe sandbox host
│   │   ├── console/         # Debug console
│   │   ├── auth/            # Auth setup flow
│   │   ├── version-history/ # Version timeline
│   │   ├── plugins/         # Plugin management
│   │   └── common/          # Shared primitives
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand state stores
│   ├── services/            # Business logic
│   │   ├── spec-parser/     # API spec parsing
│   │   ├── code-generator/  # Generation orchestration
│   │   ├── code-validator/  # Sanitization
│   │   └── version-manager/ # Version CRUD
│   ├── types/               # Type definitions
│   └── styles/              # Design tokens, CSS
│
├── sandbox/                 # Sandbox iframe runtime
│   ├── index.html           # Minimal shell
│   ├── bridge.ts            # postMessage handler
│   └── runtime.ts           # Minimal React runtime
│
└── shared/                  # Cross-process shared code
    ├── constants.ts
    ├── ipc-channels.ts
    └── types/

tests/
├── unit/
├── integration/
├── e2e/
└── fixtures/                # Sample API specs
```

---

## Key Conventions

### Code Style
- **TypeScript strict mode**: No `any` without justification comment
- **File size**: Max 300 lines per file; refactor if exceeded
- **Naming**: PascalCase for components/types, camelCase for functions/variables, kebab-case for files
- **Imports**: Absolute paths via `@/` alias (e.g., `@/components/chat/ChatPanel`)
- **Exports**: Named exports only (no default exports except page-level components)

### Component Patterns
- Use Radix UI primitives for all interactive elements
- Use CSS Modules or Tailwind utilities (no inline styles)
- Every component must handle: loading, error, empty states
- All form inputs must have associated labels (WCAG 2.1 AA)
- Use `React.memo` only when profiling shows measurable re-render cost

### State Management
- **Zustand stores** for cross-component state (tabs, auth, CLI status, versions, plugins)
- **Local state** (`useState`) for component-internal UI state
- **Store selectors** for granular subscriptions (avoid full-store subscriptions)
- No Redux, no Context for global state

### Testing
- **Test-first** (Red-Green-Refactor) is the preferred workflow
- Tests must be deterministic: mock all external deps, use fake timers
- File naming: `*.test.ts` or `*.test.tsx` co-located with source
- Coverage target: ≥80% per feature branch

### Commit Messages
```text
feat: add chat panel component with message history
fix: resolve tab close confirmation not appearing
refactor: extract CLI communication into custom hook
test: add unit tests for spec parser format detection
docs: update quickstart with new dev commands
perf: lazy-load swagger-parser to reduce initial bundle
chore: configure husky pre-commit hooks
```

---

## Architecture Decisions

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Desktop platform | Electron 34 | Full filesystem + OS keychain access; subprocess management |
| UI isolation | Sandboxed iframe | Security boundary for generated code; no parent window access |
| CLI communication | stdin/stdout JSON-RPC 2.0 | Industry standard (LSP/MCP); streaming support |
| State management | Zustand | Minimal boilerplate; built-in selectors; no provider wrapping |
| Spec parsing | swagger-parser + graphql | Best-in-class for each format; unified NormalizedSpec output |
| Version storage | SQLite + filesystem | Fast metadata queries; no DB bloat from large code snapshots |
| Credential storage | keytar (OS keychain) | Native OS security (DPAPI, Keychain, libsecret) |
| Code compilation | esbuild (main process) | Fast; runs off renderer thread; no WASM overhead |
| Component library | Radix UI | WCAG 2.1 AA out of the box; 24+ primitives |

---

## Design Contracts Reference

| Contract | File | Boundary |
|----------|------|----------|
| Sandbox PostMessage API | `contracts/sandbox-postmessage-api.md` | Host renderer ↔ Sandbox iframe |
| Electron IPC Channels | `contracts/electron-ipc-channels.md` | Main process ↔ Renderer |
| CLI Protocol | `contracts/cli-protocol.md` | Main process ↔ Copilot CLI subprocess |

---

## Getting Help

- **Feature Spec**: `specs/001-api-ui-generator/spec.md`
- **Implementation Plan**: `specs/001-api-ui-generator/plan.md`
- **Research Decisions**: `specs/001-api-ui-generator/research.md`
- **Data Model**: `specs/001-api-ui-generator/data-model.md`
- **Constitution**: `.specify/memory/constitution.md`
