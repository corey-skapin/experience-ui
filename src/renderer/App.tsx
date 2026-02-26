import React from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAppStore } from './stores/app-store';

export function App(): React.JSX.Element {
  const theme = useAppStore((state) => state.theme);

  return (
    <ErrorBoundary>
      <div
        data-theme={theme}
        className="flex h-full w-full overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        data-testid="app-root"
      >
        {/* Placeholder layout — full implementation in T041 */}
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-[var(--color-text-secondary)]">Experience UI — Loading...</p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
