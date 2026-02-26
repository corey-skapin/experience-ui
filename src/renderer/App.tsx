// src/renderer/App.tsx
// Top-level application shell component.
//
// Renders a minimal placeholder layout during Phase 1 setup.
// Full split-pane layout (ChatPanel + SandboxHost via react-resizable-panels)
// is implemented in T041 after the core infrastructure is in place.
//
// This component is intentionally minimal — it only provides the root
// mounting point and will be expanded in subsequent phases.
import type { JSX } from 'react';

/** Placeholder App shell — full implementation in T041 (US1). */
export default function App(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f0f0f',
        color: '#e0e0e0',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Experience UI
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#888' }}>
          API-Driven UI Generator — initializing…
        </p>
      </div>
    </div>
  );
}
