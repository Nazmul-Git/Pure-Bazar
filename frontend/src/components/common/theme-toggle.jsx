'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import useTheme from './theme-provider';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Laptop },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          className={`theme-toggle-btn${theme === value ? ' theme-toggle-active' : ''}`}
          onClick={() => setTheme(value)}
        >
          <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
