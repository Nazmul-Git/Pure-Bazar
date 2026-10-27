'use client';

import { useLanguage } from '@/i18n/language-provider';

export default function Card({ title, description, actions, children, className = '' }) {
  const { t } = useLanguage();
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || actions) && (
        <header className="card-header">
          <div>{title && <h2>{t(title)}</h2>}{description && <p>{t(description)}</p>}</div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-content">{children}</div>
    </section>
  );
}