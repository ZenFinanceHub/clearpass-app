import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'clearpass_support_dismissed';

export function useSupportDismissed() {
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      setIsDismissed(val === 'true');
    });
  }, []);

  const dismiss = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  }, []);

  const restore = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIsDismissed(false);
  }, []);

  return { isDismissed, dismiss, restore };
}
