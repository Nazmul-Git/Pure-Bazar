'use client';

import { useLanguage } from '@/i18n/language-provider';

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const { t } = useLanguage();
  return (
    <button className={`ui-button button-${variant} button-${size} ${className}`.trim()} {...props}>
      {typeof children === 'string' ? t(children) : children}
    </button>
  );
}
