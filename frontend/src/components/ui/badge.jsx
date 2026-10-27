'use client';

import { useLanguage } from '@/i18n/language-provider';

export default function Badge({ tone = 'neutral', children, className = '' }) {
  const { t } = useLanguage();
  return <span className={`ui-badge badge-${tone} ${className}`.trim()}>{typeof children === 'string' ? t(children) : children}</span>;
}
