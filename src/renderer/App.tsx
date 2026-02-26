// src/renderer/App.tsx
// Top-level application shell component (T015).
// Renders a minimal placeholder layout with theme support.
// Full split-pane layout (ChatPanel + SandboxHost) is implemented in T041.
import type { JSX } from 'react';

import { TooltipProvider } from './components/common/Tooltip';
import { useAppStore } from './stores/app-store';

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme);

  return (
    <div
      data-theme={theme}
      className={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TooltipProvider>
        <AppShellPlaceholder />
      </TooltipProvider>
    </div>
  );
}

/** Placeholder shell — replaced by full layout in T041. */
function AppShellPlaceholder(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-semibold)',
            marginBottom: 'var(--spacing-2)',
          }}
        >
          Experience UI
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          API-Driven UI Generator — initializing…
        </p>
      </div>
    </div>
  );
}
