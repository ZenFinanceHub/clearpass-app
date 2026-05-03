import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';

const webStorage = {
  getItem: (key: string) => {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {}
    return Promise.resolve();
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nativeStorage: any = null;
if (Platform.OS !== 'web') {
  nativeStorage = require('@react-native-async-storage/async-storage').default;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : nativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
