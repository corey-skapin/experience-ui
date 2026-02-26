/**
 * AuthSetupFlow — guided step-by-step authentication setup.
 * Steps: select method → enter credentials → test connection → show result
 */
import { useState, type ReactElement } from 'react'
import { Button } from '../common/Button'
import { StatusBadge } from '../common/StatusBadge'
import { useAuth } from '../../hooks/use-auth'

// ─── Types ─────────────────────────────────────────────────────────────────

type AuthMethodType = 'apiKey' | 'bearer' | 'oauth2'
type Step = 'select-method' | 'enter-credentials' | 'test-connection' | 'result'

// ─── Props ─────────────────────────────────────────────────────────────────

export interface AuthSetupFlowProps {
  baseUrl: string
  onComplete?: (success: boolean) => void
  onCancel?: () => void
  className?: string
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AuthSetupFlow({
  baseUrl,
  onComplete,
  onCancel,
  className = '',
}: AuthSetupFlowProps): ReactElement {
  const [step, setStep] = useState<Step>('select-method')
  const [method, setMethod] = useState<AuthMethodType>('apiKey')
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key')
  const [apiKeyValue, setApiKeyValue] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [persist, setPersist] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const { configure, testConnection, isLoading, error } = useAuth(baseUrl)

  const handleConfigure = async () => {
    let methodPayload: Parameters<typeof configure>[1]

    if (method === 'apiKey') {
      methodPayload = { type: 'apiKey', headerName: apiKeyHeader, key: apiKeyValue }
    } else if (method === 'bearer') {
      methodPayload = { type: 'bearer', token: bearerToken }
    } else {
      setStep('result')
      setTestResult({ success: false, message: 'Use the OAuth button to authenticate' })
      return
    }

    const result = await configure(baseUrl, methodPayload, persist)
    if (result.success) {
      setStep('test-connection')
    }
  }

  const handleTestConnection = async () => {
    const result = await testConnection(baseUrl)
    const success = result.status === 'connected'
    setTestResult({
      success,
      message: success
        ? `Connected! Response time: ${result.responseTimeMs}ms`
        : `Connection ${result.status}: ${result.error ?? 'Unknown error'}`,
    })
    setStep('result')
    onComplete?.(success)
  }

  return (
    <div
      className={`flex flex-col gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg ${className}`}
      data-testid="auth-setup-flow"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span
          className={step === 'select-method' ? 'font-semibold text-[var(--color-accent)]' : ''}
        >
          1. Method
        </span>
        <span>→</span>
        <span
          className={step === 'enter-credentials' ? 'font-semibold text-[var(--color-accent)]' : ''}
        >
          2. Credentials
        </span>
        <span>→</span>
        <span
          className={step === 'test-connection' ? 'font-semibold text-[var(--color-accent)]' : ''}
        >
          3. Test
        </span>
        <span>→</span>
        <span className={step === 'result' ? 'font-semibold text-[var(--color-accent)]' : ''}>
          4. Done
        </span>
      </div>

      {/* Step 1: Select method */}
      {step === 'select-method' && (
        <div className="flex flex-col gap-3" data-testid="step-select-method">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Select Authentication Method
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">for {baseUrl}</p>
          <div className="flex flex-col gap-2">
            {(['apiKey', 'bearer', 'oauth2'] as AuthMethodType[]).map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-[var(--color-bg-tertiary)]"
              >
                <input
                  type="radio"
                  name="auth-method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  {m === 'apiKey' ? 'API Key' : m === 'bearer' ? 'Bearer Token' : 'OAuth 2.0'}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setStep('enter-credentials')}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Enter credentials */}
      {step === 'enter-credentials' && (
        <div className="flex flex-col gap-3" data-testid="step-enter-credentials">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Enter Credentials
          </h3>

          {method === 'apiKey' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Header Name</label>
                <input
                  type="text"
                  value={apiKeyHeader}
                  onChange={(e) => setApiKeyHeader(e.target.value)}
                  placeholder="X-API-Key"
                  className="text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  data-testid="api-key-header-input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">API Key</label>
                <input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder="Enter your API key"
                  className="text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  data-testid="api-key-value-input"
                />
              </div>
            </>
          )}

          {method === 'bearer' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-secondary)]">Bearer Token</label>
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Enter your bearer token"
                className="text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                data-testid="bearer-token-input"
              />
            </div>
          )}

          {method === 'oauth2' && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              OAuth 2.0 will open a browser window for authentication.
            </p>
          )}

          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="accent-[var(--color-accent)]"
              data-testid="persist-checkbox"
            />
            Remember credentials in OS keychain
          </label>

          {error && (
            <p className="text-xs text-[var(--color-error)]" data-testid="auth-error">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setStep('select-method')}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfigure}
              disabled={isLoading}
              loading={isLoading}
              data-testid="configure-button"
            >
              Configure
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Test connection */}
      {step === 'test-connection' && (
        <div className="flex flex-col gap-3" data-testid="step-test-connection">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Test Connection
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Verify the credentials work by testing the connection to {baseUrl}.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setStep('enter-credentials')}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTestConnection}
              disabled={isLoading}
              loading={isLoading}
              data-testid="test-connection-button"
            >
              Test Connection
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && testResult && (
        <div className="flex flex-col gap-3" data-testid="step-result">
          <div className="flex items-center gap-2">
            <StatusBadge variant={testResult.success ? 'success' : 'error'}>
              {testResult.success ? 'Connected' : 'Failed'}
            </StatusBadge>
            <span className="text-sm text-[var(--color-text-secondary)]">{testResult.message}</span>
          </div>
          <div className="flex gap-2 justify-end">
            {!testResult.success && (
              <Button variant="ghost" size="sm" onClick={() => setStep('enter-credentials')}>
                Try Again
              </Button>
            )}
            {onCancel && (
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        </div>
      )}

      {/* No-op: Button handles its own loading spinner */}
    </div>
  )
}
