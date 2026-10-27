'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES, translate } from './translate';

const LanguageContext = createContext({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  t: (text) => text,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANGUAGE);

  // Read the saved preference after hydration so server and client markup match.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (LANGUAGES.some((item) => item.code === saved)) setLangState(saved);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGUAGES.some((item) => item.code === next)) return;
    setLangState(next);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: (text) => translate(lang, text) }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function T({ children }) {
  const { t } = useLanguage();
  return typeof children === 'string' ? t(children) : children;
}
