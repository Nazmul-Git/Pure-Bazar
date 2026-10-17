'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import Button from '@/components/ui/button';
import useAuth from '@/store/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const { error, status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isLoading = status === 'loading';

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch {
      // The auth slice holds the server or connection error for display.
    }
  }

  return (
    <main className="login-screen">
      <aside className="login-brand-panel">
        <a className="login-brand" href="/login" aria-label="PureBazar home">
          <span className="login-brand-mark">PB</span>
          <span>PureBazar</span>
        </a>
        <div className="login-brand-copy">
          <span className="login-kicker">INVENTORY AND POINT OF SALE</span>
          <h1>Good operations start with a clear view.</h1>
          <p>Your workspace for stock, sales, and the people who keep things moving.</p>
        </div>
        <span className="login-brand-foot">PUREBAZAR <span>·</span> OPERATIONS</span>
      </aside>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><span className="login-brand-mark">PB</span> PureBazar</div>
          <div className="login-heading">
            <span className="login-kicker">YOUR WORKSPACE</span>
            <h2 id="login-title">Welcome back</h2>
            <p>Sign in with your staff account to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="ui-field" htmlFor="email">
              <span className="field-label">Email address</span>
              <span className="login-password-wrap">
                <Mail className="login-field-icon" size={17} aria-hidden="true" />
                <input
                  id="email"
                  className="ui-input login-email-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isLoading}
                />
              </span>
            </label>
            <label className="ui-field" htmlFor="password">
              <span className="field-label">Password</span>
              <span className="login-password-wrap">
                <LockKeyhole className="login-field-icon" size={17} aria-hidden="true" />
                <input
                  id="password"
                  className="ui-input login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <Button className="login-submit" type="submit" disabled={isLoading || !email || !password}>
              {isLoading ? 'Signing in...' : 'Sign in'}
              {!isLoading && <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </form>
          <p className="login-security-note"><LockKeyhole size={14} aria-hidden="true" /> Staff access only</p>
        </div>
      </section>
    </main>
  );
}