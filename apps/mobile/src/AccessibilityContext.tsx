import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccessibilitySettings {
  dyslexiaFont: boolean;
  largeText: boolean;
  highContrast: boolean;
  textToSpeech: boolean;
  wordSpacing: boolean;
  creamBackground: boolean;
}

const DEFAULTS: AccessibilitySettings = {
  dyslexiaFont: false,
  largeText: false,
  highContrast: false,
  textToSpeech: false,
  wordSpacing: false,
  creamBackground: false,
};

const STORAGE_KEY = 'accessibility_settings';

interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  setSetting: <K extends keyof AccessibilitySettings>(key: K, value: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  settings: DEFAULTS,
  setSetting: () => {},
});

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<AccessibilitySettings>) });
      })
      .catch(() => {});
  }, []);

  const setSetting = useCallback(<K extends keyof AccessibilitySettings>(key: K, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AccessibilityContext.Provider value={{ settings, setSetting }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  return useContext(AccessibilityContext);
}
