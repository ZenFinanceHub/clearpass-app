/**
 * Every documented deep link / external entry URL (docs/clearpass-2.0/
 * 02-navigation-mapping.md "External links that must keep working" and
 * principle 3), with where it must land. PURE: plain Node tests it against
 * src/deepLinks.ts and the route files (scripts/lib/deepLinkMap.test.mjs);
 * e2e/deep-links-v2.spec.ts visits the `webPath` of each on a web export.
 *
 * None of these sit under (tabs), so ui_v2 can't move them; the tests
 * check that both ways. Links with no `webPath` can only be opened by a
 * phone (custom scheme, universal/App Links) and carry the device command.
 * All tokens and codes here are synthetic.
 */

export type DeepLinkKind = 'referral' | 'referralCapture' | 'confirmParent' | 'authCallback' | 'unknown';

export interface DocumentedDeepLink {
  url: string;
  /** What src/deepLinks.ts handleIncomingUrl() classifies it as. */
  kind: DeepLinkKind;
  /** getDeepLinkPath(url). */
  linkPath: string;
  /** The app route it ends on. */
  lands: string;
  /** Path to open on the web build, or null if only a phone can open it. */
  webPath: string | null;
  /** How to check it on a device (needed when webPath is null). */
  deviceCheck: string | null;
  source: string;
}

const ADB = (u: string) => `adb shell am start -W -a android.intent.action.VIEW -d "${u}" co.uk.getclearpass.app`;
const XCRUN = (u: string) => `xcrun simctl openurl booted "${u}"`;
const both = (u: string) => `${ADB(u)} ; ${XCRUN(u)}`;

export const DOCUMENTED_DEEP_LINKS: readonly DocumentedDeepLink[] = [
  {
    url: 'clearpass://confirm-parent?token=synthetic-token',
    kind: 'confirmParent', linkPath: 'confirm-parent', lands: '/confirm-parent', webPath: null,
    deviceCheck: both('clearpass://confirm-parent?token=synthetic-token'), source: 'src/deepLinks.ts',
  },
  {
    url: 'clearpass://confirmParent?token=synthetic-token',
    kind: 'confirmParent', linkPath: 'confirm-parent', lands: '/confirm-parent', webPath: null,
    deviceCheck: both('clearpass://confirmParent?token=synthetic-token'), source: 'src/deepLinks.ts (legacy spelling)',
  },
  {
    url: 'https://clearpass-app.vercel.app/confirm-parent?token=synthetic-token',
    kind: 'confirmParent', linkPath: 'confirm-parent', lands: '/confirm-parent', webPath: '/confirm-parent?token=synthetic-token',
    deviceCheck: null, source: 'server/proxy.js parent confirmation email',
  },
  {
    url: 'clearpass://referral?code=synth01',
    kind: 'referral', linkPath: 'referral', lands: '/auth/signup', webPath: null,
    deviceCheck: both('clearpass://referral?code=synth01'), source: 'src/deepLinks.ts referral share',
  },
  {
    url: 'clearpass://auth/callback',
    kind: 'authCallback', linkPath: 'auth/callback', lands: '/auth/callback', webPath: '/auth/callback',
    deviceCheck: both('clearpass://auth/callback'), source: 'src/socialAuth.ts Google sign-in redirect (must never move)',
  },
  {
    url: 'https://getclearpass.co.uk/start?ref=SYNTH01',
    kind: 'referralCapture', linkPath: 'start', lands: '/', webPath: null,
    deviceCheck: both('https://getclearpass.co.uk/start?ref=SYNTH01'), source: 'app.json applinks / Android App Link /start',
  },
  {
    url: 'https://clearpass-app.vercel.app/?ref=SYNTH01',
    kind: 'referralCapture', linkPath: '', lands: '/', webPath: '/?ref=SYNTH01',
    deviceCheck: null, source: 'web app referral link',
  },
  {
    url: 'https://clearpass-app.vercel.app/payment-success?session_id=cs_test_synthetic',
    kind: 'unknown', linkPath: 'payment-success', lands: '/payment-success', webPath: '/payment-success?session_id=cs_test_synthetic',
    deviceCheck: null, source: 'server/proxy.js Stripe success_url',
  },
  {
    url: 'https://clearpass-app.vercel.app/paywall',
    kind: 'unknown', linkPath: 'paywall', lands: '/paywall', webPath: '/paywall',
    deviceCheck: null, source: 'server/proxy.js Stripe cancel_url; apps/web/index.html',
  },
  {
    url: 'https://clearpass-app.vercel.app/connect-return',
    kind: 'unknown', linkPath: 'connect-return', lands: '/connect-return', webPath: '/connect-return',
    deviceCheck: null, source: 'server/proxy.js Stripe Connect return_url',
  },
  {
    url: 'https://clearpass-app.vercel.app/connect-refresh',
    kind: 'unknown', linkPath: 'connect-refresh', lands: '/connect-refresh', webPath: '/connect-refresh',
    deviceCheck: null, source: 'server/proxy.js Stripe Connect refresh_url',
  },
];
