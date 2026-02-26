/**
 * Top-level App shell component.
 * Manages theme application and provides the root layout container.
 * Phase 3 will add the full split-pane workspace layout.
 */
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { useAppStore } from './stores/app-store'

export default function App(): ReactElement {
  const theme = useAppStore((state) => state.theme)

  // Apply theme class to the document root so CSS custom properties pick it up
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="app-root" data-theme={theme}>
      {/* Phase 3: workspace layout (tab bar, split pane, chat panel, console) */}
    </div>
  )
}
