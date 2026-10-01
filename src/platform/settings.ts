import type { Settings } from '../core/types';

/** Settings are small and kept in LocalStorage (PRD 8.2 / 19). */
const KEY = 'echo-island-settings';

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  musicVolume: 0.5,
  sfx: true,
  sfxVolume: 0.7,
  haptics: true,
  graphics: 'medium',
  reducedMotion: false,
  textSize: 'medium',
  colorBlind: false,
  language: 'en',
};

export function loadSettings(): Settings {
  const prefersReduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaults = { ...DEFAULT_SETTINGS, reducedMotion: prefersReduced };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode): settings simply won't persist.
  }
}

export function applySettingsToDocument(s: Settings): void {
  const root = document.documentElement;
  root.dataset.textSize = s.textSize;
  root.dataset.colorBlind = String(s.colorBlind);
  root.dataset.reducedMotion = String(s.reducedMotion);
  root.lang = s.language;
}
