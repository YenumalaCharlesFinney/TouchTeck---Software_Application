import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Activity, Radio, Tv, Zap, LogOut, LogIn, MousePointerClick, X, Palette } from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';
import LaneWater, { POOL_PRESETS } from './home3d/LaneWater';
import CanvasBackground from './home3d/Backgrounds';
import { LOOKS, PRESET_KEY, PICKER_KEY } from './home3d/looks';

type TabTarget = 'scoreboard' | 'operator' | 'system-check' | 'meet-setup';

interface Home3DProps {
  onNavigateToTab: (tab: TabTarget) => void;
  accountLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const actions: { icon: React.ElementType; label: string; tab: TabTarget; primary?: boolean; hotkey: string }[] = [
  { icon: Radio, label: 'Operator Console', tab: 'operator', primary: true, hotkey: '1' },
  { icon: Tv, label: 'Arena Scoreboard', tab: 'scoreboard', hotkey: '2' },
  { icon: Activity, label: 'System Check', tab: 'system-check', hotkey: '3' },
  { icon: Zap, label: 'Meet Setup', tab: 'meet-setup', hotkey: '4' },
];

export default function Home3D({ onNavigateToTab, accountLoggedIn, onLoginClick, onLogoutClick }: Home3DProps) {
  const [webglFailed, setWebglFailed] = useState(false);
  const [hotkeyHit, setHotkeyHit] = useState<string | null>(null);

  const [lookId, setLookId] = useState<string>(() => {
    const saved = localStorage.getItem(PRESET_KEY);
    return LOOKS.some((l) => l.id === saved) ? (saved as string) : LOOKS[0].id;
  });
  const [showPicker, setShowPicker] = useState(() => localStorage.getItem(PICKER_KEY) !== 'off');

  const look = LOOKS.find((l) => l.id === lookId) ?? LOOKS[0];
  const poolPreset =
    look.kind === 'pool'
      ? POOL_PRESETS.find((p) => p.id === look.preset) ?? POOL_PRESETS[0]
      : POOL_PRESETS[0];

  const choosePreset = useCallback((id: string) => {
    setLookId(id);
    localStorage.setItem(PRESET_KEY, id);
  }, []);

  const hidePicker = useCallback(() => {
    setShowPicker(false);
    localStorage.setItem(PICKER_KEY, 'off');
  }, []);

  // Without this there is no way back once the picker is hidden, short of
  // clearing storage.
  const revealPicker = useCallback(() => {
    setShowPicker(true);
    localStorage.setItem(PICKER_KEY, 'on');
  }, []);

  const navigate = useCallback(
    (tab: TabTarget) => {
      onNavigateToTab(tab);
    },
    [onNavigateToTab],
  );

  // 1-4 jump straight to a destination — quicker than aiming at a button with
  // wet hands on a poolside laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;

      // While the picker is up the number keys belong to it — otherwise
      // pressing "1" to try a look would navigate away instead.
      if (showPicker) {
        const idx = Number(e.key) - 1;
        if (Number.isInteger(idx) && idx >= 0 && idx < LOOKS.length) {
          e.preventDefault();
          choosePreset(LOOKS[idx].id);
        }
        return;
      }

      const match = actions.find((a) => a.hotkey === e.key);
      if (!match) return;
      e.preventDefault();
      setHotkeyHit(match.hotkey);
      window.setTimeout(() => setHotkeyHit(null), 180);
      navigate(match.tab);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, showPicker, choosePreset]);

  // Fall back gracefully rather than showing an empty black screen if the
  // display adapter can't give us a WebGL context.
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) setWebglFailed(true);
    } catch {
      setWebglFailed(true);
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#03050a' }}>
      {/* ---------- 3D layer ---------- */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {look.kind === 'canvas' ? (
          <CanvasBackground key={look.id} mode={look.mode} />
        ) : (
          !webglFailed && (
            <Suspense fallback={null}>
              <LaneWater preset={poolPreset} />
            </Suspense>
          )
        )}
      </div>

      {/* keeps the type legible over the brightest peaks */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(70% 55% at 50% 34%, rgba(3,5,10,0.86) 0%, rgba(3,5,10,0.45) 45%, transparent 72%), linear-gradient(180deg, rgba(3,5,10,0.9) 0%, transparent 20%, transparent 70%, rgba(3,5,10,0.95) 100%)',
        }}
      />

      {/* ---------- top bar ---------- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          insetInline: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '20px 28px',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {accountLoggedIn ? (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }} onClick={onLogoutClick}>
              <LogOut size={13} /> Logout
            </button>
          ) : (
            <button className="btn btn-yellow" style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }} onClick={onLoginClick}>
              <LogIn size={13} /> Login
            </button>
          )}
        </div>
      </div>

      {/* ---------- centre stack ---------- */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          pointerEvents: 'none',
        }}
      >
        <AnimatedLogo size="hero" showText={true} className="mb-8 drop-shadow-[0_10px_60px_rgba(0,0,0,0.9)]" />

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.64rem',
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: '#fff500',
            marginBottom: '1.4rem',
          }}
        >
          Omega ARES 21 · Live Timing
        </span>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 5.6vw, 4.6rem)',
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            margin: 0,
            color: '#fff',
            textShadow: '0 8px 50px rgba(0,0,0,0.9)',
          }}
        >
          WHEN EVERY <span style={{ color: '#fff500' }}>MILLISECOND</span>
          <span style={{ display: 'block' }}>MATTERS.</span>
        </h1>


        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.85rem',
            marginTop: '2.4rem',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          {actions.map(({ icon: Icon, label, tab, primary, hotkey }) => (
            <button
              key={tab}
              className={`btn ${primary ? 'btn-yellow' : 'btn-secondary'} home3d-action${hotkeyHit === hotkey ? ' is-hotkey-hit' : ''}`}
              style={{ padding: '0.82rem 1.7rem' }}
              onClick={() => navigate(tab)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

      </div>

      {/* ---------- interaction hint ---------- */}
      <div
        style={{
          position: 'absolute',
          // lifted clear of the picker while it's on screen
          bottom: showPicker && !webglFailed ? '150px' : '26px',
          insetInline: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          transition: 'bottom 180ms ease',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          <MousePointerClick size={12} />
          {look.kind === 'pool'
            ? 'Move to cut a wake · click for the start pulse'
            : 'Move to light it up and quicken the fall · click to send a ring'}
        </span>
      </div>

      {/* ---------- look picker (testing aid) ---------- */}
      {showPicker && !webglFailed && (
        <div className="home3d-picker">
          <div className="home3d-picker-head">
            <span className="home3d-picker-title">Pool look</span>
            <button className="home3d-picker-close" onClick={hidePicker} title="Hide this picker">
              <X size={12} /> Hide
            </button>
          </div>

          <div className="home3d-picker-row">
            {LOOKS.map((l, i) => (
              <button
                key={l.id}
                className={`home3d-picker-btn${l.id === lookId ? ' is-active' : ''}`}
                onClick={() => choosePreset(l.id)}
                title={l.hint}
              >
                <span className="home3d-picker-num">{i + 1}</span>
                {l.label}
              </button>
            ))}
          </div>

          <span className="home3d-picker-hint">{look.hint}</span>
        </div>
      )}

      {/* the way back once it's hidden — quiet until you go looking for it */}
      {!showPicker && !webglFailed && (
        <button className="home3d-picker-show" onClick={revealPicker} title="Change the pool look">
          <Palette size={14} />
          Look
        </button>
      )}

      {webglFailed && look.kind === 'pool' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
          }}
        >
          3D view unavailable on this display adapter — the classic home page still works.
        </div>
      )}
    </div>
  );
}
