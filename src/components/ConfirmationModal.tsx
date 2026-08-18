import React from 'react';
import { createPortal } from 'react-dom';
import { useModalClose } from '../hooks/useModalClose';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'cyan' | 'yellow' | 'danger';
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant
}: ConfirmationModalProps) {
  const { isClosing, triggerClose } = useModalClose();

  if (!isOpen) return null;

  const actualConfirmText = confirmText || confirmLabel || 'OK';
  const actualCancelText = cancelText || cancelLabel || 'Cancel';

  const isDestructive =
    actualConfirmText.toLowerCase().includes('delete') ||
    title.toLowerCase().includes('delete') ||
    title.toLowerCase().includes('end') ||
    message.toLowerCase().includes('delete');

  const confirmBtnClass = confirmVariant
    ? `btn-${confirmVariant}`
    : isDestructive
      ? 'btn-danger'
      : 'btn-cyan';
  const closingClass = isClosing ? ' modal-closing' : '';

  return createPortal(
    <div className={`modal-overlay${closingClass}`} style={{ zIndex: 99999 }}>
      <div className={`modal-content${closingClass}`} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
            onClick={() => triggerClose(onCancel)}
          >
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ margin: '1rem 0 1.5rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {message}
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => triggerClose(onCancel)}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {actualCancelText}
          </button>
          <button
            type="button"
            className={`btn ${confirmBtnClass}`}
            onClick={() => triggerClose(onConfirm)}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {actualConfirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
