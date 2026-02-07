import { useColorScheme } from 'react-native';

// Colors extracted from the web app's CSS variables
const lightColors = {
  background: '#ffffff',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  primary: '#3b82f6',
  primaryForeground: '#f8fafc',
  secondary: '#f1f5f9',
  secondaryForeground: '#1e293b',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#f1f5f9',
  accentForeground: '#1e293b',
  destructive: '#ef4444',
  destructiveForeground: '#f8fafc',
  border: '#e2e8f0',
  input: '#e2e8f0',
  ring: '#3b82f6',
  // Chart colors
  chart1: '#3b82f6',
  chart2: '#22c55e',
  chart3: '#ef4444',
  chart4: '#a855f7',
  chart5: '#f97316',
  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

const darkColors = {
  background: '#0f172a',
  foreground: '#f8fafc',
  card: '#0f172a',
  cardForeground: '#f8fafc',
  primary: '#60a5fa',
  primaryForeground: '#1e293b',
  secondary: '#1e293b',
  secondaryForeground: '#f8fafc',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  accent: '#1e293b',
  accentForeground: '#f8fafc',
  destructive: '#ef4444',
  destructiveForeground: '#f8fafc',
  border: '#1e293b',
  input: '#1e293b',
  ring: '#3b82f6',
  chart1: '#60a5fa',
  chart2: '#4ade80',
  chart3: '#f87171',
  chart4: '#a855f7',
  chart5: '#f97316',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
};

export type Colors = typeof lightColors;

export function useColors(): Colors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}

export { lightColors, darkColors };
