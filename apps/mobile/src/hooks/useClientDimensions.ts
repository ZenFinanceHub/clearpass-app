import { useEffect, useState } from 'react';
import { useWindowDimensions, type ScaledSize } from 'react-native';

/**
 * Like useWindowDimensions, but returns null until after the first client-side
 * mount. This ensures SSG pre-rendered HTML (which has no real window) and the
 * client's initial render both agree on null, preventing React hydration
 * error #418 (text content mismatch).
 */
export function useClientDimensions(): ScaledSize | null {
  const dims = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? dims : null;
}
