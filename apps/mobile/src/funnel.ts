import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Conversion funnel logging. Fire-and-forget: never throws, never blocks
 * the UI, and a failed insert is simply dropped. Rows land in
 * public.funnel_events and are summarised in the 08:00 Slack stats.
 *
 * Keep event names stable — the daily stats group by them.
 */
export type FunnelEvent =
  | 'taster_started'
  | 'taster_completed'
  | 'onboarding_completed'
  | 'daily_limit_hit'
  | 'paywall_prompt_viewed'
  | 'paywall_prompt_tapped'
  | 'paywall_viewed'
  | 'plan_selected'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'free_mock_started'
  | 'free_mock_completed';

const ANON_ID_KEY = '@clearpass/anon_id';
let anonIdPromise: Promise<string> | null = null;

function randomId(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getAnonId(): Promise<string> {
  if (!anonIdPromise) {
    anonIdPromise = (async () => {
      try {
        const existing = await AsyncStorage.getItem(ANON_ID_KEY);
        if (existing) return existing;
        const fresh = randomId();
        await AsyncStorage.setItem(ANON_ID_KEY, fresh);
        return fresh;
      } catch {
        return randomId();
      }
    })();
  }
  return anonIdPromise;
}

export function logFunnelEvent(event: FunnelEvent, props: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const [anonId, { data: { session } }] = await Promise.all([getAnonId(), supabase.auth.getSession()]);
      await supabase.from('funnel_events').insert({
        event,
        props,
        anon_id: anonId,
        user_id: session?.user.id ?? null,
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      });
    } catch {
      // Analytics must never break the app.
    }
  })();
}
