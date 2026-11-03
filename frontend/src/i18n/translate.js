import bn from './bn.js';

export const LANGUAGE_STORAGE_KEY = 'purebazar-language';
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGES = [
  { code: 'en', label:   'English', short: 'EN' },
    { code: 'bn', label: 'বাংলা', short: 'BN' },
];

const dictionaries = { en: {}, bn };

const nouns = {
  'goods receives': 'পণ্য গ্রহণ',
  'outlet transfers': 'আউটলেট ট্রান্সফার',
  'the POS': 'পিওএস',
  'the revenue ledger': 'আয়ের খতিয়ান',
  'warehouse stock': 'গুদামের স্টক',
  'wallet bill logs': 'ওয়ালেট বিল লগ',
  'wallet reconciliation': 'ওয়ালেট মিলকরণ',
  'payout approvals': 'পরিশোধ অনুমোদন',
  'payout history': 'পরিশোধের ইতিহাস',
  'salary advances': 'বেতন অগ্রিম',
  'salary sheets': 'বেতন শিট',
  'stock adjustments': 'স্টক সমন্বয়',
  'stock counts': 'স্টক গণনা',
  'vendor ledgers': 'ভেন্ডর খতিয়ান',
  'vendor settlements': 'ভেন্ডর নিষ্পত্তি',
  'vendor statements': 'ভেন্ডর স্টেটমেন্ট',
};

function lookupNoun(noun) {
  const key = noun.charAt(0).toUpperCase() + noun.slice(1);
  return nouns[noun] ?? dictionaries.bn[key] ?? null;
}

// Dynamic sentence patterns that share a template but differ by noun.
function translatePattern(text) {
  const loading = text.match(/^Loading (.+?)(?:\.\.\.|…)$/);
  if (loading) {
    const noun = lookupNoun(loading[1]);
    return noun ? `${noun} লোড হচ্ছে...` : 'লোড হচ্ছে...';
  }
  const view = text.match(/^You do not have permission to view (.+)\.$/);
  const noun = view && lookupNoun(view[1]);
  return noun ? `${noun} দেখার অনুমতি আপনার নেই।` : null;
}

// English text is the key; unknown strings (and dynamic data) fall back to the original text.
export function translate(lang, text) {
  if (typeof text !== 'string' || lang !== 'bn') return text;
  return dictionaries.bn[text] ?? translatePattern(text) ?? text;
}
