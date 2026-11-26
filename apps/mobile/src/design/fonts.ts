import { useFonts } from 'expo-font';
// Per-weight entry points so only these four .ttf files are bundled (not all 18).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

/**
 * Loads Inter at runtime (OTA-safe: the .ttf files ship as JS-update
 * assets; no native config). Same mechanism as OpenDyslexic in
 * app/_layout.tsx. Only called from ui_v2 screens, so with the flag off
 * nothing new is downloaded.
 *
 * Returns true once loaded. Until then text falls back to the system font
 * with the equivalent weight, so nothing is blocked on the font.
 */
export function useInterFonts(): boolean {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return loaded && !error;
}
