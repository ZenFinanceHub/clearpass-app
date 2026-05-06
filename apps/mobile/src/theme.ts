import { useAccessibility } from './AccessibilityContext';

export function useTheme() {
  const { settings } = useAccessibility();
  const { creamBackground: bg, highContrast: hc, largeText: lt, wordSpacing: ws, dyslexiaFont: df } = settings;

  return {
    backgroundColor: bg ? '#FAF7F2' : '#0A0A0F',
    cardColor: bg ? (hc ? '#FFFFFF' : '#EDE8DF') : (hc ? '#000000' : '#13131A'),
    textColor: bg ? (hc ? '#000000' : '#1C1917') : (hc ? '#FFFFFF' : '#F1F0FF'),
    subTextColor: bg ? (hc ? '#292524' : '#57534E') : (hc ? '#D1D5DB' : '#6B7280'),
    borderColor: bg ? '#000000' : '#FFFFFF',
    highContrast: hc,
    fontFamily: df ? 'OpenDyslexic-Regular' : undefined,
    fontSize: (base: number) => base * (lt ? 1.2 : 1),
    letterSpacing: ws ? 1.5 : 0,
    lineHeight: (base: number) => base * (lt ? 1.2 : 1) * (ws ? 1.5 : 1),
  };
}
