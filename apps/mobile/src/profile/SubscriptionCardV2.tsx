import React, { useCallback, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getEntitlementState } from '@/src/subscription';
import { restoreProPurchases } from '@/src/purchases';
import { loadUserProgress, saveUserProgress } from '@/src/storage';
import { useDesignTheme } from '@/src/design';
import { Badge, Button, Card, ListRow, Text } from '@/src/ui';
import { subscriptionView, type AppPlatform, type EntitlementState } from './subscriptionStatus';

/**
 * Profile › Subscription (ClearPass 2.0, ui_v2 only; settings.tsx renders the
 * old card with the flag off). Shows the plan from the existing entitlement
 * state and opens the right existing destination:
 *  - App Store / Google Play subscription: the store's own management page
 *  - web (Stripe) one-off purchase: what they bought, no management link
 *  - free: the existing paywall
 * "Restore purchases" is the existing RevenueCat restore, handled exactly as
 * the paywall does. No new payment logic, no prices.
 */
export function SubscriptionCardV2() {
  const { colors } = useDesignTheme();
  const [state, setState] = useState<EntitlementState | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    void getEntitlementState().then(setState);
  }, []));

  const platform: AppPlatform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const v = subscriptionView(state, platform);

  async function openStore(url: string) {
    setError('');
    try {
      await Linking.openURL(url);
    } catch {
      setError('Couldn’t open the store. Open your store app and go to Subscriptions.');
    }
  }

  // Same outcome handling as paywall.tsx handleRestore.
  async function handleRestore() {
    setError('');
    setNotice('');
    setRestoring(true);
    const outcome = await restoreProPurchases();
    setRestoring(false);
    if (outcome.status === 'restored') {
      const local = await loadUserProgress();
      if (local) await saveUserProgress({ ...local, isPro: true });
      router.replace('/payment-success');
    } else if (outcome.status === 'none') {
      setNotice('No previous ClearPass Pro purchase was found for this account.');
    } else {
      setError(outcome.message);
    }
  }

  return (
    <Card padding={14} testID="subscription-card" style={{ marginBottom: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="heading" weight={700} style={{ flex: 1 }}>{'My subscription'}</Text>
        {state === null ? null : v.plan === 'pro'
          ? <Badge label="Pro" tone="gold" icon="star" accessibilityLabel="Pro member" />
          : <Badge label="Free" tone="neutral" />}
      </View>
      {state === null ? (
        <Text variant="bodySmall" color="secondary">{'Loading…'}</Text>
      ) : (
        <ListRow title={v.title} subtitle={v.status} testID="subscription-status" />
      )}
      {state !== null && v.manage.kind === 'store' && (
        <Button
          label={v.manage.label}
          icon="open-outline"
          variant="primary"
          accessibilityHint={`Opens ${v.manage.store} subscriptions`}
          onPress={() => { if (v.manage.kind === 'store') void openStore(v.manage.url); }}
          testID="subscription-manage"
        />
      )}
      {state !== null && v.manage.kind === 'upgrade' && (
        <Button label={v.manage.label} variant="primary" onPress={() => router.push('/paywall')} testID="subscription-upgrade" />
      )}
      {state !== null && v.manage.kind === 'info' && (
        <Text variant="bodySmall" color="secondary" testID="subscription-info">{v.manage.text}</Text>
      )}
      {v.canRestore && (
        <Button
          label="Restore purchases"
          variant="ghost"
          loading={restoring}
          onPress={() => void handleRestore()}
          testID="subscription-restore"
        />
      )}
      {notice ? <Text variant="bodySmall" color="secondary">{notice}</Text> : null}
      {error ? <Text variant="bodySmall" style={{ color: colors.status.error }}>{error}</Text> : null}
    </Card>
  );
}
