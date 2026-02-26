// src/renderer/index.tsx
// React root mount — bootstraps the React 19 application with StrictMode.
//
// A global error boundary wraps the entire app to catch unhandled render
// errors and display a friendly fallback UI (implemented fully in T012).
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

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
    <App />
  </React.StrictMode>,
);
