import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceHover: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  
  // Border colors
  border: string;
  borderSecondary: string;
  
  // Accent colors
  primary: string;
  primaryForeground: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Chart colors
  chartPrimary: string;
  chartSecondary: string;
  chartBackground: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const lightColors: ThemeColors = {
  // Backgrounds
  background: '#ffffff',
  backgroundSecondary: '#f4f4f5',
  backgroundTertiary: '#e4e4e7',
  surface: '#f9fafb',
  surfaceHover: '#f3f4f6',
  
  // Text
  text: '#18181b',
  textSecondary: '#3f3f46',
  textTertiary: '#52525b',
  textMuted: '#71717a',
  
  // Borders
  border: '#e4e4e7',
  borderSecondary: '#d4d4d8',
  
  // Accent
  primary: '#f97316',
  primaryForeground: '#ffffff',
  
  // Status
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Charts
  chartPrimary: '#18181b',
  chartSecondary: '#71717a',
  chartBackground: '#e4e4e7',
};

const darkColors: ThemeColors = {
  // Backgrounds
  background: '#09090b',
  backgroundSecondary: '#18181b',
  backgroundTertiary: '#27272a',
  surface: 'rgba(24, 24, 27, 0.5)',
  surfaceHover: 'rgba(39, 39, 42, 0.5)',
  
  // Text
  text: '#ffffff',
  textSecondary: '#e4e4e7',
  textTertiary: '#a1a1aa',
  textMuted: '#71717a',
  
  // Borders
  border: 'rgba(39, 39, 42, 0.5)',
  borderSecondary: '#3f3f46',
  
  // Accent
  primary: '#f97316',
  primaryForeground: '#ffffff',
  
  // Status
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Charts
  chartPrimary: '#ffffff',
  chartSecondary: '#a1a1aa',
  chartBackground: '#27272a',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'focusflow_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
          setModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);
  
  // Save theme preference when changed
  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };
  
  // Determine if dark mode is active
  const isDark = mode === 'system' 
    ? systemColorScheme === 'dark' 
    : mode === 'dark';
  
  // Toggle between light and dark
  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };
  
  // Get current colors
  const colors = isDark ? darkColors : lightColors;
  
  const value: ThemeContextType = {
    mode,
    isDark,
    colors,
    setMode,
    toggleTheme,
  };
  
  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }
  
  return (
    <ThemeContext.Provider value={value}>
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

// Export colors for direct use
export { darkColors, lightColors };
export type { ThemeColors, ThemeMode };

