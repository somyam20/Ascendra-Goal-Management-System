import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { storage } from '@/utils/storage';

export type LiveEffect = 'aurora' | 'stars' | 'petals' | 'waves' | 'fireflies' | 'grid';

interface ThemeDef { id: string; name: string; swatch: readonly string[]; kind: 'static' | 'live'; base: string; effect?: LiveEffect }

export const THEMES: readonly ThemeDef[] = [
  { id: 'aurora', name: 'Aurora', swatch: ['#6366f1', '#a855f7', '#14b8a6'], kind: 'static', base: 'aurora' },
  { id: 'sunset', name: 'Sunset', swatch: ['#f97316', '#ec4899', '#eab308'], kind: 'static', base: 'sunset' },
  { id: 'ocean', name: 'Ocean', swatch: ['#0ea5e9', '#2563eb', '#06b6d4'], kind: 'static', base: 'ocean' },
  { id: 'forest', name: 'Forest', swatch: ['#16a34a', '#65a30d', '#ca8a04'], kind: 'static', base: 'forest' },
  { id: 'sakura', name: 'Sakura', swatch: ['#db2777', '#c084fc', '#fb7185'], kind: 'static', base: 'sakura' },
  { id: 'neon', name: 'Midnight Neon', swatch: ['#7c3aed', '#06b6d4', '#d946ef'], kind: 'static', base: 'neon' },
  { id: 'lavender', name: 'Lavender', swatch: ['#8b5cf6', '#c4b5fd', '#f0abfc'], kind: 'static', base: 'lavender' },
  { id: 'graphite', name: 'Graphite', swatch: ['#334155', '#64748b', '#0ea5e9'], kind: 'static', base: 'graphite' },
  { id: 'citrus', name: 'Citrus', swatch: ['#84cc16', '#f59e0b', '#22c55e'], kind: 'static', base: 'citrus' },
  { id: 'royal', name: 'Royal Gold', swatch: ['#1e3a8a', '#b45309', '#eab308'], kind: 'static', base: 'royal' },
  { id: 'live-aurora', name: 'Aurora Live', swatch: ['#22d3ee', '#a855f7', '#34d399'], kind: 'live', base: 'aurora', effect: 'aurora' },
  { id: 'starfield', name: 'Starfield', swatch: ['#1e1b4b', '#818cf8', '#fde68a'], kind: 'live', base: 'royal', effect: 'stars' },
  { id: 'sakura-drift', name: 'Sakura Drift', swatch: ['#f9a8d4', '#db2777', '#fbcfe8'], kind: 'live', base: 'sakura', effect: 'petals' },
  { id: 'ocean-waves', name: 'Ocean Waves', swatch: ['#0284c7', '#22d3ee', '#1d4ed8'], kind: 'live', base: 'ocean', effect: 'waves' },
  { id: 'fireflies', name: 'Fireflies', swatch: ['#14532d', '#facc15', '#65a30d'], kind: 'live', base: 'forest', effect: 'fireflies' },
  { id: 'neon-grid', name: 'Neon Grid', swatch: ['#d946ef', '#06b6d4', '#7c3aed'], kind: 'live', base: 'neon', effect: 'grid' },
];

export type ThemeId = string;
export type Mode = 'light' | 'dark';

export interface ThemePalette {
  primary: string; secondary: string; accent: string; success: string; danger: string; warning: string;
  fg: string; subtle: string; border: string; surface: string; muted: string;
}

interface ThemeCtx {
  theme: ThemeId;
  mode: Mode;
  setTheme: (t: ThemeId) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  palette: ThemePalette;
  effect?: LiveEffect;
}

const Ctx = createContext<ThemeCtx | null>(null);

const readVar = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(',')})` : '#888';
};

const readPalette = (): ThemePalette => ({
  primary: readVar('primary'), secondary: readVar('secondary'), accent: readVar('accent'),
  success: readVar('success'), danger: readVar('danger'), warning: readVar('warning'),
  fg: readVar('fg'), subtle: readVar('subtle'), border: readVar('border'), surface: readVar('surface'), muted: readVar('muted'),
});

const initialMode = (): Mode => {
  const saved = storage.get('gc.mode');
  if (saved === 'light' || saved === 'dark') return saved;
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
};

const initialTheme = (): ThemeId => {
  const saved = storage.get('gc.theme');
  return THEMES.find((t) => t.id === saved)?.id ?? 'aurora';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [palette, setPalette] = useState<ThemePalette>(() => readPalette());

  useEffect(() => {
    const root = document.documentElement;
    const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
    root.dataset.theme = def.base;
    root.dataset.themeId = def.id;
    if (def.effect) root.dataset.live = def.effect; else delete root.dataset.live;
    root.dataset.mode = mode;
    storage.set('gc.theme', theme);
    storage.set('gc.mode', mode);
    setPalette(readPalette());
  }, [theme, mode]);

  const setTheme = useCallback((t: ThemeId) => setThemeState(t), []);
  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const toggleMode = useCallback(() => setModeState((m) => (m === 'dark' ? 'light' : 'dark')), []);

  const effect = THEMES.find((t) => t.id === theme)?.effect;
  const value = useMemo(() => ({ theme, mode, setTheme, setMode, toggleMode, palette, effect }), [theme, mode, setTheme, setMode, toggleMode, palette, effect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
