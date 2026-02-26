// src/renderer/components/auth/AuthSetupFlow.tsx
// T052 — Multi-step authentication setup wizard.
// Step 1: select auth method  → Step 2: enter credentials → Step 3: test connection.

import { type JSX, type CSSProperties, useCallback, useState } from 'react';

import { useAuth } from '../../hooks/use-auth';

// ─── Derived types ────────────────────────────────────────────────────────────

type AuthConfigureMethod = Parameters<Window['experienceUI']['auth']['configure']>[0]['method'];
type AuthTestResponse = Awaited<ReturnType<Window['experienceUI']['auth']['testConnection']>>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthSetupFlowProps {
  baseUrl: string;
  onComplete?: (connectionId: string) => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3;
type AuthType = 'none' | 'apiKey' | 'bearer' | 'oauth2';

// ─── Step 1: Method selection ─────────────────────────────────────────────────

function MethodStep({
  selected,
  onChange,
  onNext,
  onCancel,
}: {
  selected: AuthType;
  onChange: (m: AuthType) => void;
  onNext: () => void;
  onCancel?: () => void;
}): JSX.Element {
  const methods: { value: AuthType; label: string; description: string }[] = [
    { value: 'none', label: 'None', description: 'No authentication required' },
    { value: 'apiKey', label: 'API Key', description: 'Custom header with a secret key' },
    { value: 'bearer', label: 'Bearer Token', description: 'Authorization: Bearer <token>' },
    { value: 'oauth2', label: 'OAuth 2.0', description: 'Authorization Code + PKCE flow' },
  ];
  return (
    <div>
      <h2 style={{ margin: '0 0 var(--spacing-4)' }}>Select authentication method</h2>
      {methods.map((m) => (
        <label
          key={m.value}
          style={{
            display: 'flex',
            gap: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-3)',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="auth-method"
            value={m.value}
            checked={selected === m.value}
            onChange={() => onChange(m.value)}
          />
          <span>
            <strong>{m.label}</strong>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {m.description}
            </span>
          </span>
        </label>
      ))}
      <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)' }}>
        {onCancel && (
          <button onClick={onCancel} type="button">
            Cancel
          </button>
        )}
        <button onClick={onNext} type="button" style={{ marginLeft: 'auto' }}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Credentials ─────────────────────────────────────────────────────

interface CredentialFormState {
  headerName: string;
  apiKey: string;
  token: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string;
  persist: boolean;
}

function CredentialsStep({
  authType,
  form,
  onChange,
  onBack,
  onNext,
}: {
  authType: AuthType;
  form: CredentialFormState;
  onChange: (patch: Partial<CredentialFormState>) => void;
  onBack: () => void;
  onNext: () => void;
}): JSX.Element {
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--spacing-2)',
    marginBottom: 'var(--spacing-3)',
    boxSizing: 'border-box',
  };
  return (
    <div>
      <h2 style={{ margin: '0 0 var(--spacing-4)' }}>Enter credentials</h2>

      {authType === 'apiKey' && (
        <>
          <label>
            Header name
            <input
              style={inputStyle}
              value={form.headerName}
              onChange={(e) => onChange({ headerName: e.target.value })}
              placeholder="X-API-Key"
            />
          </label>
          <label>
            API Key
            <input
              style={inputStyle}
              type="password"
              value={form.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
            />
          </label>
        </>
      )}

      {authType === 'bearer' && (
        <label>
          Token
          <textarea
            style={{ ...inputStyle, minHeight: 80 }}
            value={form.token}
            onChange={(e) => onChange({ token: e.target.value })}
          />
        </label>
      )}

      {authType === 'oauth2' && (
        <>
          <label>
            Client ID
            <input
              style={inputStyle}
              value={form.clientId}
              onChange={(e) => onChange({ clientId: e.target.value })}
            />
          </label>
          <label>
            Auth endpoint
            <input
              style={inputStyle}
              value={form.authEndpoint}
              onChange={(e) => onChange({ authEndpoint: e.target.value })}
            />
          </label>
          <label>
            Token endpoint
            <input
              style={inputStyle}
              value={form.tokenEndpoint}
              onChange={(e) => onChange({ tokenEndpoint: e.target.value })}
            />
          </label>
          <label>
            Scopes (space-separated)
            <input
              style={inputStyle}
              value={form.scopes}
              onChange={(e) => onChange({ scopes: e.target.value })}
            />
          </label>
        </>
      )}

      <label
        style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          alignItems: 'center',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <input
          type="checkbox"
          checked={form.persist}
          onChange={(e) => onChange({ persist: e.target.checked })}
        />
        Persist credentials to OS keychain
      </label>

      <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
        <button onClick={onBack} type="button">
          ← Back
        </button>
        <button
          onClick={onNext}
          type="button"
          style={{ marginLeft: 'auto' }}
          disabled={authType === 'none'}
          title={authType === 'none' ? 'Select an authentication method first' : undefined}
        >
          Test connection →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Test connection ──────────────────────────────────────────────────

function TestStep({
  baseUrl,
  authType,
  form,
  onBack,
  onComplete,
  configure,
  testConnection,
  isLoading,
}: {
  baseUrl: string;
  authType: AuthType;
  form: CredentialFormState;
  onBack: () => void;
  onComplete?: (id: string) => void;
  configure: ReturnType<typeof useAuth>['configure'];
  testConnection: ReturnType<typeof useAuth>['testConnection'];
  isLoading: boolean;
}): JSX.Element {
  const [healthCheckPath, setHealthCheckPath] = useState('/');
  const [result, setResult] = useState<AuthTestResponse | null>(null);

  const handleTest = useCallback(async () => {
    let method: AuthConfigureMethod | undefined;
    if (authType === 'apiKey')
      method = { type: 'apiKey', headerName: form.headerName, key: form.apiKey };
    else if (authType === 'bearer') method = { type: 'bearer', token: form.token };
    else if (authType === 'oauth2')
      method = {
        type: 'oauth2',
        clientId: form.clientId,
        authEndpoint: form.authEndpoint,
        tokenEndpoint: form.tokenEndpoint,
        scopes: form.scopes.split(' ').filter(Boolean),
      };
    if (!method) return;

    await configure(baseUrl, method, form.persist);
    const res = await testConnection(baseUrl, healthCheckPath);
    setResult(res);
    if (res.status === 'connected' && onComplete) onComplete(baseUrl);
  }, [authType, baseUrl, form, healthCheckPath, configure, testConnection, onComplete]);

  return (
    <div>
      <h2 style={{ margin: '0 0 var(--spacing-4)' }}>Test connection</h2>
      <label>
        Health check path
        <input
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            marginBottom: 'var(--spacing-3)',
            boxSizing: 'border-box',
          }}
          value={healthCheckPath}
          onChange={(e) => setHealthCheckPath(e.target.value)}
        />
      </label>

      {result && (
        <div
          role="status"
          style={{
            padding: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)',
            background:
              result.status === 'connected'
                ? 'var(--color-status-success-bg)'
                : 'var(--color-status-error-bg)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Status: <strong>{result.status}</strong>
          {result.responseTimeMs > 0 && <span> ({result.responseTimeMs}ms)</span>}
          {result.error && <span> — {result.error}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
        <button onClick={onBack} type="button">
          ← Back
        </button>
        <button
          onClick={() => void handleTest()}
          type="button"
          disabled={isLoading}
          style={{ marginLeft: 'auto' }}
        >
          {isLoading ? 'Testing…' : 'Test connection'}
        </button>
      </div>
    </div>
  );
}

// ─── AuthSetupFlow ────────────────────────────────────────────────────────────

export function AuthSetupFlow({ baseUrl, onComplete, onCancel }: AuthSetupFlowProps): JSX.Element {
  const [step, setStep] = useState<Step>(1);
  const [authType, setAuthType] = useState<AuthType>('apiKey');
  const [form, setForm] = useState<CredentialFormState>({
    headerName: 'X-API-Key',
    apiKey: '',
    token: '',
    clientId: '',
    authEndpoint: '',
    tokenEndpoint: '',
    scopes: '',
    persist: false,
  });

  const { configure, testConnection, isLoading } = useAuth();
  const patchForm = useCallback(
    (patch: Partial<CredentialFormState>) => setForm((f) => ({ ...f, ...patch })),
    [],
  );

  const containerStyle: CSSProperties = {
    maxWidth: 480,
    margin: '0 auto',
    padding: 'var(--spacing-6)',
    background: 'var(--color-bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--color-text-primary)',
  };

  return (
    <div style={containerStyle} aria-label="Authentication setup">
      <div
        style={{
          marginBottom: 'var(--spacing-4)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        Step {step} of 3 — {baseUrl}
      </div>

      {step === 1 && (
        <MethodStep
          selected={authType}
          onChange={setAuthType}
          onNext={() => setStep(authType === 'none' ? 3 : 2)}
          onCancel={onCancel}
        />
      )}
      {step === 2 && (
        <CredentialsStep
          authType={authType}
          form={form}
          onChange={patchForm}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <TestStep
          baseUrl={baseUrl}
          authType={authType}
          form={form}
          onBack={() => setStep(2)}
          onComplete={onComplete}
          configure={configure}
          testConnection={testConnection}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
