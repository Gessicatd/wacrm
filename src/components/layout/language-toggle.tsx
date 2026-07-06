'use client';

import { useLanguage } from '@/hooks/use-language';
import type { Language } from '@/lib/i18n/types';
import { Languages } from 'lucide-react';

const OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="flex h-10 appearance-none items-center gap-1 rounded-md bg-transparent pl-8 pr-6 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground [&>option]:bg-popover [&>option]:text-foreground"
        aria-label="Select language"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.flag} {opt.label}
          </option>
        ))}
      </select>
      <Languages className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
