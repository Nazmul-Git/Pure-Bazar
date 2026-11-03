'use client';

import { Languages } from 'lucide-react';
import { useLanguage } from '@/i18n/language-provider';
import { LANGUAGES } from '@/i18n/translate';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="language-switcher" role="group" aria-label="Language">
      <Languages size={16} aria-hidden="true" />
      {LANGUAGES.map((item) => (
        <button
          key={item.code}
          type="button"
          className={`language-option${lang === item.code ? ' language-option-active' : ''}`}
          aria-pressed={lang === item.code}
          aria-label={item.label}
          title={item.label}
          onClick={() => setLang(item.code)}
        >
          {item.short}
        </button>
      ))}
    </div>
  );
}
