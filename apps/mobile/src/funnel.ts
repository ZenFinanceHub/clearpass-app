import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { markOnce, sanitiseProps, shouldLogAppOpened, type FunnelEvent } from './analyticsEvents';

export type { FunnelEvent, Feature, OnboardingStep, QuestionSource } from './analyticsEvents';

/**
 * Funnel and product analytics. Fire-and-forget: never throws, never blocks
 * the UI, and a failed insert is simply dropped. Rows land in
 * public.funnel_events; the 08:00 Slack stats and the read-only queries in
 * docs/sql/analytics read them.
 *
 * Keep event names stable — the daily stats group by them. Props are
 * filtered through the allow-list in ./analyticsEvents (enums, booleans and
 * small integers only; no personal data or content), see
 * docs/analytics/event-taxonomy.md.
 */

const ANON_ID_KEY = '@clearpass/anon_id';
const ONCE_KEY = '@clearpass/funnel_once';
const APP_OPENED_DAY_KEY = '@clearpass/app_opened_day';
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

type PropValue = string | number | boolean | null | undefined;

export function logFunnelEvent(event: FunnelEvent, props: Record<string, PropValue> = {}): void {
  void (async () => {
    try {
      const [anonId, { data: { session } }] = await Promise.all([getAnonId(), supabase.auth.getSession()]);
      await supabase.from('funnel_events').insert({
        event,
        props: sanitiseProps(event, props),
        anon_id: anonId,
        user_id: session?.user.id ?? null,
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      });
    } catch {
      // Analytics must never break the app.
    }
  })();
}

// Serialises read-modify-write of the stored flags so two calls in the same
// tick can't both decide they are first.
let storageChain: Promise<unknown> = Promise.resolve();
function serialised(fn: () => Promise<void>): void {
  const run = storageChain.then(fn, fn);
  storageChain = run.catch(() => {});
}

/** Logs `event` only the first time it happens on this install. */
export function logFunnelEventOnce(event: FunnelEvent, props: Record<string, PropValue> = {}): void {
  serialised(async () => {
    try {
      const { fire, next } = markOnce(await AsyncStorage.getItem(ONCE_KEY), event);
      if (!fire) return;
      await AsyncStorage.setItem(ONCE_KEY, next);
      logFunnelEvent(event, props);
    } catch {
      // Analytics must never break the app.
    }
  });
}

/** `app_opened`, at most once per local calendar day per install. */
export function logAppOpened(trigger: 'launch' | 'foreground'): void {
  serialised(async () => {
    try {
      const { fire, day } = shouldLogAppOpened(await AsyncStorage.getItem(APP_OPENED_DAY_KEY), new Date());
      if (!fire) return;
      await AsyncStorage.setItem(APP_OPENED_DAY_KEY, day);
      logFunnelEvent('app_opened', { trigger });
    } catch {
      // Analytics must never break the app.
    }
  });
}

/** Root layout: app_opened on launch and whenever the app returns to the
 *  foreground (deduped to one per local day), so retention also counts
 *  learners who leave the app running in the background. */
export function useAppOpenedLogging(): void {
  useEffect(() => {
    logAppOpened('launch');
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') logAppOpened('foreground');
    });
    return () => sub.remove();
  }, []);
}
