// src/theme/themeScheme.ts
// colorSchemeManager Mantine maison : une seule memorisation (cle « tk-theme »)
// et attribut data-theme="dark|light" sur <html>.
import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';

export const TK_THEME_KEY = 'tk-theme';
const LEGACY_KEY = 'mantine-color-scheme-value';

const isScheme = (v: unknown): v is MantineColorScheme =>
  v === 'light' || v === 'dark' || v === 'auto';

const resolve = (v: MantineColorScheme): 'light' | 'dark' => {
  if (v !== 'auto') return v;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const applyDataTheme = (v: MantineColorScheme): void => {
  try {
    document.documentElement.setAttribute('data-theme', resolve(v));
  } catch { /* ignore */ }
};

export function tkColorSchemeManager(): MantineColorSchemeManager {
  let handler: ((e: StorageEvent) => void) | null = null;

  return {
    get: (defaultValue) => {
      if (typeof window === 'undefined') return defaultValue;
      try {
        window.localStorage.removeItem(LEGACY_KEY);
        const stored = window.localStorage.getItem(TK_THEME_KEY);
        if (isScheme(stored)) return stored;
      } catch { /* ignore */ }
      // Valeur deja posee par le script de index.html
      const attr = document.documentElement.getAttribute('data-theme');
      return isScheme(attr) ? attr : defaultValue;
    },

    set: (value) => {
      try {
        window.localStorage.setItem(TK_THEME_KEY, value);
      } catch { /* ignore */ }
      applyDataTheme(value);
    },

    subscribe: (onUpdate) => {
      handler = (e: StorageEvent) => {
        if (e.storageArea === window.localStorage && e.key === TK_THEME_KEY && isScheme(e.newValue)) {
          applyDataTheme(e.newValue);
          onUpdate(e.newValue);
        }
      };
      window.addEventListener('storage', handler);
    },

    unsubscribe: () => {
      if (handler) window.removeEventListener('storage', handler);
      handler = null;
    },

    clear: () => {
      try {
        window.localStorage.removeItem(TK_THEME_KEY);
      } catch { /* ignore */ }
    },
  };
}

export const colorSchemeManager = tkColorSchemeManager();
export const defaultColorScheme: MantineColorScheme = 'light';
