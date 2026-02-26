/**
 * ErrorBoundary — React class component that catches render-time errors
 * in its subtree and displays a fallback UI.
 */
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Button } from './Button'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback UI. Receives the error and a reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called when an error is caught; useful for logging. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset(): void {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (!hasError || !error) {
      return children
    }

    if (fallback) {
      return fallback(error, this.reset)
    }

    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-base font-semibold text-[var(--color-error)]">Something went wrong</p>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-md">{error.message}</p>
        <Button variant="secondary" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    )
  }
}
