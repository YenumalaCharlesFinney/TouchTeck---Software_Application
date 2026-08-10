import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import AnimatedLogo from './AnimatedLogo';

/* ============================================================
   Account identity popup — the same email/password shape the
   marketing site will use for a studio's account. This is just
   identity: it does not gate access to any timing tool by itself,
   it only flips the corner button from "Login" to "Logout" and
   remembers that across app restarts. The real access gate is the
   4-digit passcode (see PasscodeModal), which is asked again every
   time the app is closed and reopened.
   ============================================================ */

interface AccountLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string) => void;
}

export default function AccountLoginModal({ isOpen, onClose, onLogin }: AccountLoginModalProps) {
  const { isClosing, triggerClose } = useModalClose();

  const [email, setEmail] = useState(() => localStorage.getItem('touchteck_saved_email') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => localStorage.getItem('touchteck_remember_me') !== 'false');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const close = () => triggerClose(onClose);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (remember) {
      localStorage.setItem('touchteck_saved_email', email);
      localStorage.setItem('touchteck_remember_me', 'true');
    } else {
      localStorage.removeItem('touchteck_saved_email');
      localStorage.setItem('touchteck_remember_me', 'false');
    }
    setError('');
    setPassword('');
    triggerClose(() => onLogin(email));
  };

  const closingClass = isClosing ? ' modal-closing' : '';

  return createPortal(
    <div className={`modal-overlay${closingClass}`} style={{ zIndex: 99999 }}>
      <div className={`modal-content${closingClass}`} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Sign in to TouchTeck
          </h3>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
            onClick={close}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.1rem' }}>
          <AnimatedLogo size="lg" showText />
        </div>

        <form className="modal-body" style={{ margin: '0 0 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }} onSubmit={submit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoFocus
              placeholder="studio@touchteck.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Remember me</span>
          </label>

          {error && (
            <p className="login-error" role="alert">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-yellow" style={{ justifyContent: 'center', padding: '0.7rem 1rem' }}>
            <LogIn size={16} /> Sign In
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
