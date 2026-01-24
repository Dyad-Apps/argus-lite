export interface ThemeColors {
  primary: {
    main: string;
    dark: string;
    light: string;
    lightest: string;
  };
  neutral: {
    textPrimary: string;
    textSecondary: string;
    textDisabled: string;
    border: string;
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  sidebar: {
    background: string;
    text: string;
    textSecondary: string;
    active: string;
    activeText: string;
    hover: string;
    hoverText: string;
    divider: string;
  };
}

export interface ColorPalette {
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
}

export interface ThemeContextType {
  mode: 'light' | 'dark';
  currentPalette: ColorPalette;
  toggleTheme: () => void;
  setCustomTheme: (palette: ColorPalette) => void;
  resetToDefault: () => void;
}
