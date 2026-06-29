import { useAccessibility } from './AccessibilityContext';
import { Colors } from './constants/theme';
export { Colors, Typography, Radii } from './constants/theme';

export function useTheme() {
  const { settings } = useAccessibility();
  const { creamBackground: bg, highContrast: hc, largeText: lt, wordSpacing: ws, dyslexiaFont: df, darkMode: dm } = settings;

  const shared = {
    highContrast: hc,
    fontFamily: df ? 'OpenDyslexic-Regular' : undefined,
    fontSize: (base: number) => base * (lt ? 1.2 : 1),
    letterSpacing: ws ? 1.5 : 0,
    lineHeight: (base: number) => base * (lt ? 1.2 : 1) * (ws ? 1.5 : 1),
  };

  if (dm) {
    return {
      ...shared,
      backgroundColor: '#0A0A0F',
      cardColor: Colors.darkSurface,
      textColor: '#FFFFFF',
      subTextColor: '#9CA3AF',
      borderColor: hc ? '#FFFFFF' : '#1F2937',
      primaryColor: Colors.indigoDark,
    };
  }

  return {
    ...shared,
    backgroundColor: bg ? '#FFFBF0' : '#F7F8FA',
    cardColor: '#FFFFFF',
    textColor: hc ? '#000000' : '#111827',
    subTextColor: hc ? '#000000' : '#6B7280',
    borderColor: hc ? '#000000' : '#E5E7EB',
    primaryColor: Colors.indigo,
  };
}
