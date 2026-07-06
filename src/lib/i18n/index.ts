import type { Language, TranslationDict } from './types';
import en from './en';
import pt from './pt';
import es from './es';

const dicts: Record<Language, TranslationDict> = { en, pt, es };

export function t(key: string, lang: Language, count?: number): string {
  const dict = dicts[lang];
  let value = dict[key];
  if (value === undefined) {
    value = dicts.en[key];
  }
  if (value === undefined) return key;
  if (count !== undefined) {
    value = value.replace('{count}', String(count));
  }
  return value;
}

export function getDict(lang: Language): TranslationDict {
  return dicts[lang];
}
