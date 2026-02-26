# Implementation Plan: API-Driven UI Generator

**Branch**: `001-api-ui-generator` | **Date**: 2025-07-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-api-ui-generator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a desktop application that wraps the Copilot CLI as an embedded subprocess and serves as a container for AI-generated user interfaces. Users provide API specifications (OpenAPI 3.x, Swagger 2.0, or GraphQL) via a chat panel, and the system generates navigable React-based UIs rendered inside sandboxed iframes. The application supports natural language customization, version history with rollback, multi-API tab management, live API authentication/connection, a debug console, and tool/plugin extensibility (including MCP servers). The host communicates with sandboxed generated UIs exclusively via a controlled postMessage API. All API requests from generated UIs are proxied through the host.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 19, Electron 34 (desktop shell), Zustand (state management), react-resizable-panels (split panes), swagger-parser + graphql (spec parsing/validation), esbuild (in-browser bundling of generated UI code)
**Storage**: Local filesystem via Electron APIs for version history persistence; in-memory credential store with opt-in OS keychain (via keytar) for persistent credentials
**Testing**: Vitest (unit/integration), React Testing Library (component tests), Playwright (E2E/integration), axe-core (accessibility)
**Target Platform**: Desktop — Windows, macOS, Linux via Electron
**Project Type**: Desktop application (Electron + React)
**Performance Goals**: LCP < 2.5s, UI generation < 30s, customization application < 15s, version rollback < 3s, tab switch < 200ms
**Constraints**: Support ≥10 concurrent tabs without degradation; sandboxed iframe strict CSP; all generated-UI network requests proxied through host; no `any` types without justification; bundle size budget enforced in CI
**Scale/Scope**: Single-user desktop app, ~15–20 screens/views, ~50–80 components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Code Quality — ✅ PASS

| Requirement                              | Plan Compliance                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Naming, file org, code style conventions | Enforced via ESLint + Prettier; project conventions documented in quickstart.md |
| Automated lint/format enforcement        | ESLint strict config + Prettier + husky pre-commit hooks                        |
| Single responsibility (≤300 LOC)         | Enforced by ESLint max-lines rule; component decomposition in data model        |
| Shared logic extraction                  | Custom hooks for CLI communication, auth flow, sandbox messaging, tab state     |
| TypeScript strict — no `any`             | `strict: true` in tsconfig; ESLint `@typescript-eslint/no-explicit-any` = error |
| No dead code                             | ESLint `no-unused-vars`, `no-unused-imports`; enforced in CI                    |

### II. Testing Standards — ✅ PASS

| Requirement                                 | Plan Compliance                                                       |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Unit tests for logic/hooks/utils            | Vitest for all business logic, hooks, utilities                       |
| Integration tests for composition           | React Testing Library for component trees; Playwright for E2E flows   |
| Test-first development (Red-Green-Refactor) | Mandated in task execution workflow                                   |
| Coverage ≥80% per feature branch            | Vitest coverage with c8/v8 provider; CI gate at 80%                   |
| Deterministic tests (no network/timers)     | All external deps mocked; MSW for API mocking; fake timers            |
| Accessibility tests (axe-core)              | axe-core integration in component tests; CI gate for critical/serious |
| Local pre-commit verification               | husky + lint-staged running lint + type-check + test on staged files  |

### III. User Experience Consistency — ✅ PASS

| Requirement                | Plan Compliance                                                            |
| -------------------------- | -------------------------------------------------------------------------- |
| Design-system primitives   | Radix UI primitives + custom design tokens (spacing, typography, color)    |
| Custom styling documented  | Tailwind CSS with CSS custom properties; rationale in component docstrings |
| WCAG 2.1 AA                | Semantic HTML, ARIA, keyboard nav, color contrast; axe-core CI gate        |
| Established UX patterns    | Documented interaction patterns for modals, forms, tabs, feedback          |
| Responsive breakpoints     | Electron window resize handling; minimum 1024×768 viewport                 |
| Error/loading/empty states | Explicit states designed per FR-026, FR-027, FR-028                        |

### IV. Performance Requirements — ✅ PASS

| Requirement                  | Plan Compliance                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------- |
| LCP < 2.5s                   | Electron preload optimization; code splitting; lazy loading of heavy deps         |
| Bundle size budget           | Tracked in CI; esbuild tree-shaking; dynamic imports for spec parsers             |
| Avoid unnecessary re-renders | React.memo, useMemo, useCallback where profiling shows benefit; Zustand selectors |
| Lazy loading media           | Not heavily applicable (desktop app); lazy-load spec parser modules               |
| Third-party dep evaluation   | Bundle analyzer in CI; prefer smaller alternatives                                |
| Performance regression CI    | Electron-specific performance benchmarks; bundle size tracking                    |

**Gate Result: ✅ ALL PRINCIPLES SATISFIED — proceeding to Phase 0**

### Post-Design Re-Check (after Phase 1)

| Principle             | Status  | Notes                                                                                                                                                                                                                                                                  |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Code Quality       | ✅ PASS | Project structure enforces single-responsibility (domain-organized components, separate hooks/stores/services). ESLint + Prettier + husky configured. All public types defined in `types/` directories.                                                                |
| II. Testing Standards | ✅ PASS | Vitest for unit, RTL for integration, Playwright for E2E, axe-core for a11y. Deterministic tests via mocked IPC and CLI. Coverage ≥80% enforced. Local pre-commit hooks configured.                                                                                    |
| III. UX Consistency   | ✅ PASS | Radix UI primitives used for all interactive elements. Tailwind + CSS variables for design tokens. WCAG 2.1 AA: semantic HTML, ARIA, keyboard nav. All data components require loading/error/empty states per data model.                                              |
| IV. Performance       | ✅ PASS | esbuild compilation in main process (off renderer thread). Lazy-loaded spec parsers. @tanstack/virtual for chat/console virtualization. SQLite + filesystem for O(1) version rollback. Bundle size tracked in CI. LCP target < 2.5s via Electron preload optimization. |

**Post-Design Gate Result: ✅ ALL PRINCIPLES SATISFIED — plan ready for task generation**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window management
│   ├── preload.ts           # Preload script for renderer bridge
│   ├── cli/                 # Copilot CLI subprocess management
│   │   ├── cli-manager.ts   # Spawn, monitor, restart CLI process
│   │   └── cli-protocol.ts  # stdin/stdout message encoding/decoding
│   ├── proxy/               # Network proxy for sandboxed iframes
│   │   └── api-proxy.ts     # Intercept & forward iframe API requests
│   ├── credentials/         # OS keychain integration
│   │   └── credential-store.ts
│   └── plugins/             # Plugin installation & lifecycle
│       └── plugin-manager.ts
│
├── renderer/                # Electron renderer process (React app)
│   ├── index.tsx            # React root mount
│   ├── App.tsx              # Top-level layout (split pane)
│   ├── components/          # Shared UI components
│   │   ├── chat/            # Chat panel components
│   │   ├── tabs/            # Tab bar and tab management
│   │   ├── sandbox/         # Iframe sandbox host & postMessage bridge
│   │   ├── console/         # Debug console panel
│   │   ├── auth/            # Auth setup flow components
│   │   ├── version-history/ # Version timeline & diff viewer
│   │   ├── plugins/         # Plugin management UI
│   │   └── common/          # Buttons, icons, modals, status indicators
│   ├── hooks/               # Custom React hooks
│   │   ├── use-cli.ts       # Copilot CLI communication hook
│   │   ├── use-tabs.ts      # Tab state management
│   │   ├── use-auth.ts      # Auth flow hook
│   │   ├── use-sandbox.ts   # Sandbox postMessage bridge hook
│   │   └── use-versions.ts  # Version history hook
│   ├── stores/              # Zustand state stores
│   │   ├── tab-store.ts     # Multi-tab state
│   │   ├── auth-store.ts    # Credential & connection state
│   │   ├── cli-store.ts     # CLI subprocess status
│   │   ├── version-store.ts # Version history state
│   │   └── plugin-store.ts  # Installed plugins state
│   ├── services/            # Business logic (non-React)
│   │   ├── spec-parser/     # OpenAPI, Swagger, GraphQL parsing
│   │   ├── code-generator/  # React/HTML/CSS generation orchestration
│   │   ├── code-validator/  # Sanitization & validation before sandbox
│   │   └── version-manager/ # Version snapshot CRUD
│   ├── types/               # Shared TypeScript type definitions
│   └── styles/              # Design tokens, global styles, CSS modules
│
├── sandbox/                 # Standalone bundle served inside iframes
│   ├── index.html           # Minimal sandbox HTML shell
│   ├── bridge.ts            # postMessage listener (sandbox side)
│   └── runtime.ts           # Minimal React runtime for generated code
│
└── shared/                  # Code shared between main & renderer
    ├── constants.ts
    ├── ipc-channels.ts      # Electron IPC channel name constants
    └── types/               # Cross-process type definitions

tests/
├── unit/                    # Vitest unit tests
├── integration/             # React Testing Library integration tests
├── e2e/                     # Playwright end-to-end tests
└── fixtures/                # Sample API specs (OpenAPI, Swagger, GraphQL)
```

**Structure Decision**: Single Electron application with clear main/renderer/sandbox process separation. The `src/main/` directory holds Electron main-process code (CLI management, network proxy, credential storage, plugin lifecycle). The `src/renderer/` directory holds the React UI with components, hooks, stores, and services. The `src/sandbox/` directory provides the isolated runtime injected into generated-UI iframes. Shared types and constants live in `src/shared/`. This structure keeps security boundaries explicit (main ↔ renderer via IPC, renderer ↔ sandbox via postMessage) while maintaining a single deployable artifact.

## Complexity Tracking

> No constitution violations identified. All four principles are satisfied by the planned architecture and tooling.
