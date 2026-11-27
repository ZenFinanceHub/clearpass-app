import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { appConfig } from './appConfig';

// Production values are pinned in src/appEnv.ts; local/staging come from
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
const SUPABASE_URL = appConfig.supabaseUrl;
const SUPABASE_ANON_KEY = appConfig.supabaseAnonKey;

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

// JS timers are throttled/suspended while the app is backgrounded on native, so the
// autoRefreshToken timer can't be relied on to fire on schedule. Drive it from AppState
// instead, per Supabase's React Native guidance, so the token is refreshed proactively
// on foreground rather than left to fail on-demand mid-navigation.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
