import en from '../i18n/en.json';

/** All player-visible text comes from language files (PRD 23). English is the only MVP language. */
const languages: Record<string, Record<string, string>> = { en };
let current: Record<string, string> = en;

export function setLanguage(lang: string): void {
  current = languages[lang] ?? en;
}

export function hasKey(key: string): boolean {
  return key in current || key in en;
}

/** Translate a key, replacing `{name}` placeholders with params. Missing keys return the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const template = current[key] ?? en[key as keyof typeof en] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}
