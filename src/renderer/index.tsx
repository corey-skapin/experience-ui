/**
 * React application entry point.
 * Mounts the root App component with StrictMode and a global error boundary.
 */
import { StrictMode, Component } from 'react'
import type { ReactNode, ReactElement, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// ─── Global Error Boundary ─────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/** Top-level error boundary — catches unhandled render errors in the tree. */
class GlobalErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this would forward to a crash reporter.
    console.error('[GlobalErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '1rem',
            fontFamily: 'system-ui, sans-serif',
            color: '#ef4444',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: '#6b7280', maxWidth: '480px' }}>
            An unexpected error occurred. Please restart the application.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: '0.75rem',
                background: '#f3f4f6',
                padding: '1rem',
                borderRadius: '0.375rem',
                maxWidth: '640px',
                overflow: 'auto',
                color: '#374151',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Mount ─────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found. Ensure index.html contains <div id="root"></div>')
}

function Root(): ReactElement {
  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
