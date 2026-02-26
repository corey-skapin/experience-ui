---
applyTo: "**/*.{ts,tsx}"
---

# TypeScript Instructions for Experience UI

These instructions define how Copilot should assist with this Electron + React + TypeScript project.

## Context

- **Project Type**: Desktop application (Electron 34 + React 19)
- **Language**: TypeScript 5.x (strict mode)
- **Frameworks**: React 19, Electron 34, Zustand (state management), Tailwind CSS 4, Radix UI
- **Architecture**: Multi-process Electron app (main / renderer / sandbox) with clear security boundaries
- **Testing**: Vitest (unit/integration), React Testing Library (components), Playwright (E2E), axe-core (a11y)

## General Guidelines

- Use idiomatic TypeScript — always prefer type safety and inference.
- `strict: true` is mandatory. Never use `any` without explicit justification.
- Use `interface` for object shapes that may be extended; `type` for unions, intersections, and computed types.
- Use `async/await` over raw Promises. Avoid `.then().catch()` chains.
- Keep files under 300 lines (enforced by ESLint `max-lines` rule).
- Prefer named exports for testability and refactoring.

## Project Structure

```
src/
  main/          # Electron main process (Node.js APIs, IPC handlers, CLI management)
  renderer/      # React application (components, hooks, stores, services)
  sandbox/       # Isolated iframe runtime for generated UIs
  shared/        # Cross-process types and constants (no process-specific imports)
tests/
  unit/          # Vitest unit tests
  integration/   # React Testing Library integration tests
  e2e/           # Playwright end-to-end tests
  fixtures/      # Sample API specs for testing
```

## Patterns to Follow

- **Single Responsibility**: Each file, component, and hook should have one clear purpose.
- **Zustand stores**: One store per domain (tab, auth, cli, version, plugin). Use selectors to minimize re-renders.
- **Custom hooks**: Extract business logic into hooks (`useCli`, `useAuth`, `useTabs`, `useSandbox`, `useVersions`).
- **IPC communication**: Always use typed channel constants from `src/shared/ipc-channels.ts`. Never use string literals for IPC channels.
- **PostMessage**: Always verify nonce before processing sandbox messages. Use allowlisted message types only.
- **Error boundaries**: Every major component subtree should have an ErrorBoundary.
- **Loading/error/empty states**: All data-fetching components must handle all three states explicitly.

## Patterns to Avoid

- Never use `any` — use `unknown` with type guards if the type is truly dynamic.
- Never import Node.js modules in renderer or sandbox code.
- Never access `window.parent`, `document.cookie`, or `eval()` in sandbox code.
- Don't use `React.FC` — prefer explicit prop types on function declarations.
- Don't use global state outside of Zustand stores.
- Don't hardcode IPC channel names — always reference constants.
- Don't commit secrets, API keys, or tokens.

## React Component Conventions

- Functional components only. No class components.
- Props interface named `{ComponentName}Props`.
- Use `React.memo` only when profiling shows unnecessary re-renders.
- Use `useMemo`/`useCallback` sparingly — only for expensive computations or stable references passed to children.
- Accessibility: all interactive elements need ARIA labels, keyboard handlers, and focus management.

## Testing Guidelines

- Write tests first (Red-Green-Refactor) per constitution mandate.
- Use Vitest for unit tests, React Testing Library for component integration tests.
- Mock IPC and CLI subprocess interactions — never call real external services in tests.
- Use `axe-core` for accessibility assertions in component tests.
- Coverage target: ≥80% per feature branch.
- All tests must be deterministic — no network calls, no real timers.

## Electron-Specific

- Main process: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- All renderer ↔ main communication through the `ExperienceUIBridge` preload API.
- Sandbox iframes: strict CSP, nonce-based scripts, no `allow-same-origin`.
- Credential storage: keytar for OS keychain. Never expose raw credentials to the renderer.
