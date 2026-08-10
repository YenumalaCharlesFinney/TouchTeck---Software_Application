import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Delete, AlertCircle, ShieldCheck } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import AnimatedLogo from './AnimatedLogo';

/* ============================================================
   Access-code popup — shown whenever a locked action (one of the four
   Home3D buttons) is attempted and the passcode hasn't been verified yet
   this run of the app. Verifying unlocks the rest of this session only;
   closing and reopening the app resets it, so the code is asked again on
   every fresh launch.

   The real code is meant to be issued on the marketing site when a studio
   buys the yearly license. There is no backend wired up yet, so
   ACCESS_CODE below is a stand-in — swap the comparison in checkCode() for
   a real lookup once that exists.
   ============================================================ */

const ACCESS_CODE = '1234';
const CODE_LENGTH = 4;

type CheckStatus = 'idle' | 'granted' | 'denied';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

const pickZira = (all: SpeechSynthesisVoice[]) => all.find((v) => /zira/i.test(v.name)) ?? null;

// Speaks "Access granted" at the system's natural rate/pitch (Zira, when this
// PC has it) and calls `onDone` once the utterance genuinely finishes — not
// on a guessed timeout — so the modal can't close mid-word and cut it off.
function speakAccessGranted(voice: SpeechSynthesisVoice | null, onDone: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onDone();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance('Access granted');
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
  // Some SAPI voices in Electron never fire onend reliably — don't let a
  // silent failure leave the operator stuck on the "granted" screen forever.
  window.setTimeout(finish, 3000);
}

export default function PasscodeModal({ isOpen, onClose, onSuccess }: PasscodeModalProps) {
  const { isClosing, triggerClose } = useModalClose();

  const [digits, setDigits] = useState('');
  const [status, setStatus] = useState<CheckStatus>('idle');
  const resetTimeoutRef = useRef<number | null>(null);

  const [baseVoice, setBaseVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Electron's Chromium doesn't always fire `voiceschanged` promptly (sometimes
  // not at all), so a single lookup on mount can silently end up with an empty
  // list. Poll as a backstop so Zira gets found even on a slow first load.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    let cancelled = false;
    let attempts = 0;

    const tryLoad = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return false;
      if (!cancelled) setBaseVoice(pickZira(all) ?? all.find((v) => v.lang.toLowerCase().startsWith('en')) ?? all[0] ?? null);
      return true;
    };

    if (tryLoad()) return;

    const onVoicesChanged = () => tryLoad();
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    const interval = window.setInterval(() => {
      attempts += 1;
      if (tryLoad() || attempts > 15) window.clearInterval(interval);
    }, 300);

    return () => {
      cancelled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      window.clearInterval(interval);
    };
  }, []);

  // Belt-and-braces re-check right before actually speaking, in case voices
  // finished loading after the effect above already settled.
  const resolveVoiceNow = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return baseVoice;
    const all = window.speechSynthesis.getVoices();
    if (all.length === 0) return baseVoice;
    return pickZira(all) ?? baseVoice ?? all.find((v) => v.lang.toLowerCase().startsWith('en')) ?? all[0] ?? null;
  }, [baseVoice]);

  const checkCode = useCallback(
    (code: string) => {
      if (code === ACCESS_CODE) {
        setStatus('granted');
        speakAccessGranted(resolveVoiceNow(), () => {
          setDigits('');
          setStatus('idle');
          onSuccess();
        });
      } else {
        setStatus('denied');
        resetTimeoutRef.current = window.setTimeout(() => {
          setStatus('idle');
          setDigits('');
        }, 700);
      }
    },
    [resolveVoiceNow, onSuccess],
  );

  // pushDigit only ever updates `digits` — checking happens in the effect
  // below, keyed off `digits` itself, which only ever runs once per actual
  // value change (a functional setState updater can be invoked more than
  // once by React for a single update, so side effects don't belong in it).
  const pushDigit = useCallback(
    (d: string) => {
      if (status === 'granted') return;
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      setStatus('idle');
      setDigits((prev) => {
        const base = status === 'denied' ? '' : prev;
        if (base.length >= CODE_LENGTH) return base;
        return base + d;
      });
    },
    [status],
  );

  const popDigit = useCallback(() => {
    if (status === 'granted') return;
    setStatus('idle');
    setDigits((prev) => prev.slice(0, -1));
  }, [status]);

  // The single place a full code entry actually gets checked — runs once per
  // distinct `digits` value, never twice for the same entry.
  useEffect(() => {
    if (digits.length === CODE_LENGTH && status === 'idle') {
      checkCode(digits);
    }
  }, [digits, status, checkCode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        popDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        triggerClose(onClose);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, pushDigit, popDigit, onClose, triggerClose]);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) window.clearTimeout(resetTimeoutRef.current);
    },
    [],
  );

  // Fresh digits/status each time the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setDigits('');
      setStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const closingClass = isClosing ? ' modal-closing' : '';

  return createPortal(
    <div className={`modal-overlay${closingClass}`} style={{ zIndex: 99999 }}>
      <div className={`modal-content passcode-modal-content${closingClass}`}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Access Control
          </h3>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
            onClick={() => triggerClose(onClose)}
          >
            ✕
          </button>
        </div>

        <div className={`passcode-modal-single${status === 'denied' ? ' is-shaking' : ''}`}>
          <AnimatedLogo size="lg" showText className="mb-4" />

          <div className="login-passcode-label">
            <Lock size={13} />
            <span>Enter 4-digit access code</span>
          </div>

          <div
            className="login-passcode-dots"
            role="status"
            aria-label={`${digits.length} of ${CODE_LENGTH} digits entered`}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <span key={i} className={`login-passcode-dot${i < digits.length ? ' is-filled' : ''}`} />
            ))}
          </div>

          <div className={`login-status login-status-${status}`} role="alert">
            {status === 'granted' && (
              <>
                <ShieldCheck size={14} /> Access Granted
              </>
            )}
            {status === 'denied' && (
              <>
                <AlertCircle size={14} /> Access Denied — try again
              </>
            )}
          </div>

          <div className="login-keypad">
            {KEYPAD_KEYS.map((k, i) => {
              if (k === '') return <span key={i} aria-hidden="true" />;
              if (k === 'back') {
                return (
                  <button
                    key={i}
                    type="button"
                    className="login-keypad-btn login-keypad-btn-back"
                    onClick={popDigit}
                    aria-label="Backspace"
                  >
                    <Delete size={16} />
                  </button>
                );
              }
              return (
                <button key={i} type="button" className="login-keypad-btn" onClick={() => pushDigit(k)}>
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
