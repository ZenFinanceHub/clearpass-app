import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { logFunnelEvent } from '@/src/funnel';
import { askForFullReminders, ensureReminderDefaults, recordReminderAsk } from '@/src/notifications';

/**
 * Last onboarding step (phones only): reminders are on by default, and this
 * asks for the OS permission at the moment it's most likely to be allowed,
 * with a reason first. The iOS/Android prompt only appears after "Turn on
 * reminders". "Not now" still leaves the iPhone's quiet delivery on (no
 * prompt needed, Notification Centre only), and the in-app offer can ask
 * again later.
 */
export default function RemindersScreen() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') { router.replace('/(tabs)/home'); return; }
    logFunnelEvent('reminder_offer_viewed', { context: 'onboarding' });
    void recordReminderAsk();
  }, []);

  async function handleYes() {
    setBusy(true);
    const ok = await askForFullReminders();
    logFunnelEvent(ok ? 'reminder_enabled' : 'reminder_os_denied', { context: 'onboarding' });
    router.replace('/(tabs)/home');
  }

  async function handleNotNow() {
    setBusy(true);
    logFunnelEvent('reminder_declined', { context: 'onboarding' });
    await ensureReminderDefaults();
    router.replace('/(tabs)/home');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>{'🔔'}</Text>
        <Text style={styles.title}>{'Stay on track for your test'}</Text>
        <Text style={styles.subtitle}>
          {'Little and often is the best way to prepare. We’ll send you one reminder a day at 7pm, and none on days you’ve already studied.'}
        </Text>

        <View style={styles.points}>
          <Text style={styles.point}>{'✅  Your free questions are ready'}</Text>
          <Text style={styles.point}>{'📅  Countdown to your test date'}</Text>
          <Text style={styles.point}>{'🔥  Keep your streak going'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.yesBtn, busy && styles.disabled]}
          onPress={() => void handleYes()}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={styles.yesText}>{busy ? '…' : 'Turn on reminders'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipLink} onPress={() => void handleNotNow()} disabled={busy} activeOpacity={0.7}>
          <Text style={styles.skipText}>{'Not now'}</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>{'You can change the time or turn reminders off any time in Settings.'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 100, paddingBottom: 48, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#F1F0FF', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  points: { width: '100%', backgroundColor: '#13131A', borderRadius: 14, borderWidth: 1, borderColor: '#1F1F2E', padding: 16, gap: 10, marginBottom: 28 },
  point: { fontSize: 15, color: '#F1F0FF' },
  yesBtn: { width: '100%', backgroundColor: '#7B5EA7', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  yesText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skipLink: { paddingVertical: 14 },
  skipText: { fontSize: 14, color: '#6B7280', textDecorationLine: 'underline' },
  footnote: { fontSize: 12, color: '#4B5563', textAlign: 'center', marginTop: 8 },
});
