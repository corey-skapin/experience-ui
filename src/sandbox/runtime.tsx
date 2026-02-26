/**
 * Sandbox runtime — minimal React 19 mount for generated UI code.
 * Executed inside the sandboxed iframe after the postMessage bridge is ready.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

interface RenderPayload {
  compiledCode: string
  cssCode?: string
}

function mountGeneratedUI(payload: RenderPayload): void {
  const rootEl = document.getElementById('sandbox-root')
  if (!rootEl) {
    console.error('[sandbox] #sandbox-root element not found')
    return
  }

  // Inject CSS if provided
  if (payload.cssCode) {
    const style = document.createElement('style')
    style.textContent = payload.cssCode
    document.head.appendChild(style)
  }

  try {
    // Execute the compiled IIFE bundle — it exposes a `GeneratedComponent` global
    const factory = new Function(payload.compiledCode)
    factory()

    // The generated IIFE should set window.__GeneratedComponent
    const GeneratedComponent = (window as unknown as { __GeneratedComponent?: React.ComponentType })
      .__GeneratedComponent

    if (!GeneratedComponent) {
      throw new Error('Generated code did not export __GeneratedComponent')
    }

    createRoot(rootEl).render(
      <StrictMode>
        <GeneratedComponent />
      </StrictMode>,
    )

    window.dispatchEvent(new CustomEvent('sandbox:render-complete'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    window.dispatchEvent(new CustomEvent('sandbox:error', { detail: { message } }))
  }
}

window.addEventListener('sandbox:render', (event) => {
  mountGeneratedUI((event as CustomEvent<RenderPayload>).detail)
})
