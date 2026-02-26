/**
 * React application entry point.
 * Mounts the root App component with StrictMode for development safety checks.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found. Ensure index.html contains <div id="root"></div>')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
