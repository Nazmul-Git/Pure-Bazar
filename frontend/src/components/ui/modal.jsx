'use client';

import { X } from 'lucide-react';
import { useLanguage } from '@/i18n/language-provider';

export default function Modal({ open, onClose, title, children, className = '' }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section
        className={`modal-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={(event) => event.key === 'Escape' && onClose?.()}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id="modal-title">{typeof title === 'string' ? t(title) : title}</h2>
          <button className="icon-button" aria-label={t('Close dialog')} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}