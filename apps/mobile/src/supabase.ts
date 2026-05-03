import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';

// On web, omit the storage option so Supabase uses its built-in localStorage handling.
// On native, pass AsyncStorage explicitly since there is no window.localStorage.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const options: any =
  Platform.OS === 'web'
    ? { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
    : {
        auth: {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          storage: require('@react-native-async-storage/async-storage').default,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
