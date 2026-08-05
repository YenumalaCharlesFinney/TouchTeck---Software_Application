import React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const isDestructive = 
    confirmText.toLowerCase().includes('delete') || 
    title.toLowerCase().includes('delete') || 
    title.toLowerCase().includes('end') ||
    message.toLowerCase().includes('delete');

  const confirmBtnClass = isDestructive ? 'btn-danger' : 'btn-cyan';

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.2rem 0.5rem', minWidth: 'auto', border: 'none', background: 'transparent' }} 
            onClick={onCancel}
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
            onClick={onCancel}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className={`btn ${confirmBtnClass}`} 
            onClick={onConfirm}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
