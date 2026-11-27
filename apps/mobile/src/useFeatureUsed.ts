import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { logFunnelEvent, type Feature } from './funnel';

/** Logs `feature_used{feature}` each time the screen comes into focus:
 *  one event per screen entry, never per question or re-render. */
export function useFeatureUsed(feature: Feature): void {
  useFocusEffect(
    useCallback(() => {
      logFunnelEvent('feature_used', { feature });
    }, [feature]),
  );
}
