import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/src/constants/theme';
import { logFunnelEvent } from '@/src/funnel';
import {
  enableStudyReminders,
  getNotificationPermission,
  loadNotificationSettings,
  loadReminderAskState,
  recordReminderAsk,
} from '@/src/notifications';
import { shouldOfferReminder } from '@/src/studyNudges';

/**
 * In-app offer to turn on daily study reminders. Every reminder used to be
 * off by default and only reachable in Settings, and no learner had ever
 * come back for a second day. This asks at the moments it makes sense
 * (hitting the daily free limit; the home screen), at most 3 times and at
 * least 2 days apart, and never on web or once reminders are on.
 *
 * The OS permission prompt only appears after the learner taps "Yes" here,
 * so a "Not now" doesn't burn the one-time iOS prompt.
 */

type Context = 'daily_limit' | 'home';

const COPY: Record<Context, { title: string; body: string }> = {
  daily_limit: {
    title: 'Want a nudge tomorrow?',
    body: 'Your next 10 free questions unlock tomorrow. We’ll remind you at 7pm so you keep going.',
  },
  home: {
    title: 'Study a little every day',
    body: 'A daily reminder at 7pm keeps you on track for your test. You can change the time in Settings.',
  },
};

/** `active`: evaluate only while the place it would appear is on screen, and
 *  re-evaluate each time it comes back (so an answer given elsewhere counts). */
export function useReminderOffer(active = true): { visible: boolean; hide: () => void } {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    if (!active) { setVisible(false); return; }
    void (async () => {
      if (Platform.OS === 'web') return;
      try {
        const [settings, perm, ask] = await Promise.all([
          loadNotificationSettings(),
          getNotificationPermission(),
          loadReminderAskState(),
        ]);
        const show = shouldOfferReminder({
          isWeb: false,
          remindersOn: settings.studyReminder && perm.status === 'granted',
          permission: perm.status,
          canAskAgain: perm.canAskAgain,
          ask,
          now: new Date(),
        });
        if (!cancelled) setVisible(show);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [active]);
  return { visible, hide: () => setVisible(false) };
}

export function ReminderOffer({ context, onDone }: { context: Context; onDone: () => void }) {
  const [state, setState] = React.useState<'ask' | 'busy' | 'on' | 'blocked'>('ask');
  const copy = COPY[context];

  React.useEffect(() => {
    logFunnelEvent('reminder_offer_viewed', { context });
    void recordReminderAsk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleYes() {
    setState('busy');
    const ok = await enableStudyReminders(19, 0).catch(() => false);
    if (ok) {
      logFunnelEvent('reminder_enabled', { context });
      setState('on');
      setTimeout(onDone, 1800);
    } else {
      logFunnelEvent('reminder_os_denied', { context });
      setState('blocked');
    }
  }

  function handleNo() {
    logFunnelEvent('reminder_declined', { context });
    onDone();
  }

  if (state === 'on') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{'Reminders on ✅'}</Text>
        <Text style={styles.body}>{'We’ll nudge you at 7pm. Change or turn it off any time in Settings.'}</Text>
      </View>
    );
  }

  if (state === 'blocked') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{'Notifications are off'}</Text>
        <Text style={styles.body}>{'To get reminders, allow notifications for ClearPass in your phone’s settings.'}</Text>
        <TouchableOpacity style={styles.noBtn} onPress={onDone} activeOpacity={0.7}>
          <Text style={styles.noText}>{'OK'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{'🔔 '}{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.noBtn} onPress={handleNo} activeOpacity={0.7} disabled={state === 'busy'}>
          <Text style={styles.noText}>{'Not now'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.yesBtn} onPress={() => void handleYes()} activeOpacity={0.85} disabled={state === 'busy'}>
          <Text style={styles.yesText}>{state === 'busy' ? '…' : 'Yes, remind me'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 14,
    gap: 6,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', color: '#1E40AF' },
  body: { fontSize: 13, color: '#1E3A8A', lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 6 },
  noBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  noText: { fontSize: 13, color: '#3B82F6', fontWeight: '600' },
  yesBtn: { backgroundColor: Colors.indigo, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  yesText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
