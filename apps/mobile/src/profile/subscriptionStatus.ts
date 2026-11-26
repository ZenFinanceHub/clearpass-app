/**
 * Profile › Subscription (ClearPass 2.0, ui_v2 only). PURE: no imports, so
 * plain Node tests it (scripts/lib/subscriptionStatus.test.mjs).
 *
 * Turns the EXISTING entitlement state (user_progress.progress: isPro,
 * proExpiresAt, proSource — written by the Stripe/RevenueCat webhooks) into
 * what the Profile card shows. No payment logic, no prices, no entitlement
 * changes: it only decides which existing destination a button opens.
 *
 *  - App Store / Google Play subscription (proSource 'iap'): "Manage
 *    subscription" opens the store's own subscription page.
 *  - Web purchase (proSource 'stripe'): a one-off card payment that never
 *    renews (purchaseGate getSubscriptionDisclosure), so there is nothing to
 *    manage — we say what they bought and until when, and show no link.
 *  - comp / instructor / seat: free grants, nothing to manage.
 *  - Free: the existing paywall.
 */

export type AppPlatform = 'ios' | 'android' | 'web';

export interface EntitlementState {
  isPro: boolean;
  proExpiresAt: string | null;
  proSource: string | null;
}

export type ManageAction =
  | { kind: 'store'; label: 'Manage subscription'; url: string; store: 'App Store' | 'Google Play' }
  | { kind: 'info'; text: string }
  | { kind: 'upgrade'; label: 'Upgrade'; route: '/paywall' };

export interface SubscriptionView {
  plan: 'free' | 'pro';
  title: string;
  status: string;
  manage: ManageAction;
  /** "Restore purchases" (RevenueCat) only exists where the store SDK runs. */
  canRestore: boolean;
}

/** app.json expo.android.package (a drift test keeps these equal). */
export const ANDROID_PACKAGE = 'co.uk.getclearpass.app';
export const IOS_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

export function storeManagementUrl(platform: AppPlatform): string | null {
  if (platform === 'ios') return IOS_MANAGE_URL;
  if (platform === 'android') return `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Feb 2027" (local date), or '' when missing or unparseable. */
export function formatProDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function storeAction(platform: AppPlatform): ManageAction | null {
  const url = storeManagementUrl(platform);
  if (!url) return null;
  return { kind: 'store', label: 'Manage subscription', url, store: platform === 'ios' ? 'App Store' : 'Google Play' };
}

const MANAGE_IN_STORE_ELSEWHERE =
  'You subscribed in the ClearPass app. Manage or cancel it in the App Store or Google Play on that phone.';

export function subscriptionView(state: Partial<EntitlementState> | null | undefined, platform: AppPlatform): SubscriptionView {
  const canRestore = platform !== 'web';
  if (!state || state.isPro !== true) {
    return {
      plan: 'free',
      title: 'Free plan',
      status: '10 questions/day · Upgrade for full access',
      manage: { kind: 'upgrade', label: 'Upgrade', route: '/paywall' },
      canRestore,
    };
  }
  const date = formatProDate(state.proExpiresAt);
  const pro = (status: string, manage: ManageAction): SubscriptionView => ({ plan: 'pro', title: 'ClearPass Pro', status, manage, canRestore });

  switch (state.proSource) {
    case 'iap':
      return pro(
        `Subscription through the App Store or Google Play${date ? ` · current period ends ${date}` : ''}`,
        storeAction(platform) ?? { kind: 'info', text: MANAGE_IN_STORE_ELSEWHERE },
      );
    case 'stripe':
      return pro(
        `One-off card payment${date ? ` · Pro until ${date}` : ''}`,
        { kind: 'info', text: 'This was a one-off payment. It doesn’t renew, so there’s nothing to cancel. Buy again any time to extend.' },
      );
    case 'comp':
      return pro('Complimentary Pro access', { kind: 'info', text: 'Given to you by ClearPass. There’s nothing to manage or pay.' });
    case 'instructor':
      return pro('Pro with your instructor account', { kind: 'info', text: 'Included with your instructor account. There’s nothing to manage or pay.' });
    case 'seat':
      return pro(
        `Pro from your instructor${date ? ` · until ${date}` : ''}`,
        { kind: 'info', text: 'Your instructor gave you this access. There’s nothing for you to manage or pay.' },
      );
    default:
      // Pro with no recorded source (older accounts). On a phone the store's
      // page is harmless to open; on web, point them at it.
      return pro(
        `Pro${date ? ` until ${date}` : ''}`,
        storeAction(platform) ?? { kind: 'info', text: 'If you subscribed in the ClearPass app, manage it in the App Store or Google Play on that phone.' },
      );
  }
}
