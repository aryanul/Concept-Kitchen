import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth, type AuthUser } from '../../stores/auth';
import { BrandWordmark } from '../../components/ui/BrandMark';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;
type LoginResponse = { data: { token: string; user: AuthUser } };

export function LoginPage() {
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', values);
      setSession(data.data.token, data.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Login failed';
      setServerError(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ck-bg)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--ck-surface)',
          border: '1px solid var(--ck-line)',
          borderRadius: 14,
          padding: 32,
          boxShadow: 'var(--ck-shadow-md)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <BrandWordmark markSize={40} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ck-ink)',
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}
        >
          Sign in to HRMS
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--ck-muted)' }}>
          Welcome back. Enter your credentials to continue.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@cknest.local"
              {...register('email')}
              style={inputStyle}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              style={inputStyle}
            />
          </Field>

          {serverError && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--ck-danger-bg)',
                color: 'var(--ck-danger-fg)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: 44,
              marginTop: 4,
              background: 'var(--ck-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <details style={{ marginTop: 24, fontSize: 12.5, color: 'var(--ck-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>Demo logins</summary>
          <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>hr@cknest.local / Hr@123 — HR Admin</li>
            <li>manager@cknest.local / Mgr@123 — Manager</li>
            <li>emp@cknest.local / Emp@123 — Employee</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid var(--ck-line)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--ck-ink)',
  background: 'var(--ck-surface)',
};

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}
