import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ColorPalette, ThemeContextType } from '@/types/theme';
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '@/lib/theme-defaults';
import { hexToHsl } from '@/lib/theme-utils';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'argus_iq_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: 'light' | 'dark';
}

export function ThemeProvider({ children, defaultMode = 'light' }: ThemeProviderProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(defaultMode);
  const [currentPalette, setCurrentPalette] = useState<ColorPalette>(
    defaultMode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
  );

  // Load saved theme mode on mount
  useEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null;
    if (savedMode) {
      setMode(savedMode);
      setCurrentPalette(savedMode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    const colors = currentPalette.colors;

    // Toggle dark class
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Set CSS variables
    root.style.setProperty('--primary', hexToHsl(colors.primary.main));
    root.style.setProperty('--primary-foreground', hexToHsl('#FFFFFF'));
    root.style.setProperty('--background', hexToHsl(colors.neutral.bgSecondary));
    root.style.setProperty('--foreground', hexToHsl(colors.neutral.textPrimary));
    root.style.setProperty('--card', hexToHsl(colors.neutral.bgPrimary));
    root.style.setProperty('--card-foreground', hexToHsl(colors.neutral.textPrimary));
    root.style.setProperty('--popover', hexToHsl(colors.neutral.bgPrimary));
    root.style.setProperty('--popover-foreground', hexToHsl(colors.neutral.textPrimary));
    root.style.setProperty('--secondary', hexToHsl(colors.neutral.bgTertiary));
    root.style.setProperty('--secondary-foreground', hexToHsl(colors.neutral.textPrimary));
    root.style.setProperty('--muted', hexToHsl(colors.neutral.bgTertiary));
    root.style.setProperty('--muted-foreground', hexToHsl(colors.neutral.textSecondary));
    root.style.setProperty('--accent', hexToHsl(colors.neutral.bgTertiary));
    root.style.setProperty('--accent-foreground', hexToHsl(colors.neutral.textPrimary));
    root.style.setProperty('--destructive', hexToHsl(colors.semantic.error));
    root.style.setProperty('--destructive-foreground', hexToHsl('#FFFFFF'));
    root.style.setProperty('--border', hexToHsl(colors.neutral.border));
    root.style.setProperty('--input', hexToHsl(colors.neutral.border));
    root.style.setProperty('--ring', hexToHsl(colors.primary.main));

    // Sidebar variables
    root.style.setProperty('--sidebar-background', hexToHsl(colors.sidebar.background));
    root.style.setProperty('--sidebar-foreground', hexToHsl(colors.sidebar.text));
    root.style.setProperty('--sidebar-primary', hexToHsl(colors.sidebar.active));
    root.style.setProperty('--sidebar-primary-foreground', hexToHsl(colors.sidebar.activeText));
    root.style.setProperty('--sidebar-accent', hexToHsl(colors.sidebar.hover));
    root.style.setProperty('--sidebar-accent-foreground', hexToHsl(colors.sidebar.hoverText));
    root.style.setProperty('--sidebar-border', hexToHsl(colors.sidebar.divider));

    // Semantic colors
    root.style.setProperty('--success', hexToHsl(colors.semantic.success));
    root.style.setProperty('--warning', hexToHsl(colors.semantic.warning));
    root.style.setProperty('--info', hexToHsl(colors.semantic.info));

    // Save preference
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, currentPalette]);

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    setCurrentPalette(newMode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);
  };

  const setCustomTheme = (palette: ColorPalette) => {
    setMode(palette.mode);
    setCurrentPalette(palette);
  };

  const resetToDefault = () => {
    setMode('light');
    setCurrentPalette(DEFAULT_LIGHT_THEME);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        currentPalette,
        toggleTheme,
        setCustomTheme,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
