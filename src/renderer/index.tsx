// src/renderer/index.tsx
// React root mount (T012) — bootstraps the React 19 application with StrictMode
// and a global error boundary to catch unhandled render errors.
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { GlobalErrorBoundary } from './components/common/ErrorBoundary';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    '[Experience UI] Root element #root not found. ' +
      'Ensure index.html contains <div id="root"></div>.',
  );
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
