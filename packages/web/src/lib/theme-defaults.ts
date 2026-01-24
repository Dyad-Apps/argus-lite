import type { ColorPalette } from '@/types/theme';

export const DEFAULT_LIGHT_THEME: ColorPalette = {
  name: 'Viaanix Light',
  mode: 'light',
  colors: {
    primary: {
      main: '#1890FF',
      dark: '#0066CC',
      light: '#40A9FF',
      lightest: '#E6F7FF',
    },
    neutral: {
      textPrimary: '#333333',
      textSecondary: '#666666',
      textDisabled: '#BFBFBF',
      border: '#E0E0E0',
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F5F5F5',
      bgTertiary: '#F5F5F5',
    },
    semantic: {
      success: '#52C41A',
      warning: '#FAAD14',
      error: '#F5222D',
      info: '#1890FF',
    },
    sidebar: {
      background: '#FFFFFF',
      text: '#333333',
      textSecondary: '#666666',
      active: '#1890FF',
      activeText: '#FFFFFF',
      hover: '#E6F7FF',
      hoverText: '#1890FF',
      divider: '#E0E0E0',
    },
  },
};

export const DEFAULT_DARK_THEME: ColorPalette = {
  name: 'Viaanix Dark',
  mode: 'dark',
  colors: {
    primary: {
      main: '#40A9FF',
      dark: '#1890FF',
      light: '#69C0FF',
      lightest: '#111D2C',
    },
    neutral: {
      textPrimary: '#E8E8E8',
      textSecondary: '#B0B0B0',
      textDisabled: '#5A5A5A',
      border: '#3A3A3A',
      bgPrimary: '#2A2A2A',
      bgSecondary: '#1F1F1F',
      bgTertiary: '#2A2A2A',
    },
    semantic: {
      success: '#73D13D',
      warning: '#FFC53D',
      error: '#FF4D4F',
      info: '#40A9FF',
    },
    sidebar: {
      background: '#0A1929',
      text: '#B0B0B0',
      textSecondary: '#808080',
      active: '#1890FF',
      activeText: '#FFFFFF',
      hover: '#1A2940',
      hoverText: '#E0E0E0',
      divider: '#2A3A4A',
    },
  },
};

export const PLATFORM_NAME = 'ArgusIQ';
export const PLATFORM_VERSION = '1.0.0';
