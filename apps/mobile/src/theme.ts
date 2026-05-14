import { useAccessibility } from './AccessibilityContext';

export function useTheme() {
  const { settings } = useAccessibility();
  const { creamBackground: bg, highContrast: hc, largeText: lt, wordSpacing: ws, dyslexiaFont: df } = settings;

  return {
    backgroundColor: bg ? '#FFFBF0' : '#F7F8FA',
    cardColor: '#FFFFFF',
    textColor: hc ? '#000000' : '#111827',
    subTextColor: hc ? '#000000' : '#6B7280',
    borderColor: hc ? '#000000' : '#E5E7EB',
    highContrast: hc,
    fontFamily: df ? 'OpenDyslexic-Regular' : undefined,
    fontSize: (base: number) => base * (lt ? 1.2 : 1),
    letterSpacing: ws ? 1.5 : 0,
    lineHeight: (base: number) => base * (lt ? 1.2 : 1) * (ws ? 1.5 : 1),
  };
}
