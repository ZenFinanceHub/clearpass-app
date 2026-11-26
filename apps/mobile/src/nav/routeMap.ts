/**
 * ClearPass 2.0 five-tab navigation (P2-2), as data. PURE: no imports, so
 * plain Node tests it (scripts/lib/routeMap.test.mjs) and the e2e
 * route-coverage spec reads the same table.
 *
 * Source of truth for the mapping: docs/clearpass-2.0/02-navigation-mapping.md.
 * Only used when `uiV2` is on; the flag-off navigator is untouched.
 */

export type V2Tab = 'home' | 'learn' | 'tests' | 'progress' | 'profile';
export const V2_TAB_ORDER: readonly V2Tab[] = ['home', 'learn', 'tests', 'progress', 'profile'];

/**
 * The (tabs) route file each tab opens. Profile keeps the `settings` file
 * (mapping doc: "keep the file name to avoid churn"), so /(tabs)/settings
 * renders Profile.
 */
export const TAB_ROUTE: Record<V2Tab, string> = {
  home: 'home',
  learn: 'learn',
  tests: 'tests',
  progress: 'progress',
  profile: 'settings',
};

/** Every (tabs) route file and the tab it belongs to (which tab is highlighted). */
export const ROUTE_TAB: Record<string, V2Tab> = {
  home: 'home',
  learn: 'learn',
  practice: 'learn',
  roadsigns: 'learn',
  highwaycode: 'learn',
  tutor: 'learn',
  tests: 'tests',
  mock: 'tests',
  hazard: 'tests',
  progress: 'progress',
  leaderboard: 'progress',
  settings: 'profile',
};

/** Header titles for the (tabs) screens under ui_v2 (null = the screen draws its own). */
export const V2_HEADER_TITLE: Record<string, string | null> = {
  home: null,
  learn: null,
  tests: null,
  practice: 'Practice',
  roadsigns: 'Road signs',
  highwaycode: 'Highway Code',
  tutor: 'Ask Pip',
  mock: 'Mock tests',
  hazard: 'Hazard perception',
  progress: 'Progress',
  leaderboard: 'Leaderboards',
  settings: 'Profile',
};

export function tabForRoute(routeName: string | undefined | null): V2Tab {
  return (routeName && ROUTE_TAB[routeName]) || 'home';
}

/** Routes that launch something per tap get a fresh nonce (practice.tsx starts once per `t`). */
export function withTapNonce(route: string, now: number): string {
  return /^\/\(tabs\)\/practice\?(topic|launch)=/.test(route) ? `${route}&t=${now}` : route;
}

// ─── Hub contents (spec §6.2–6.5) ────────────────────────────────────────────

export interface HubEntry {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  /** Ionicons name. */
  icon: string;
  /** Needs a connection (existing Study hub rule for Ask Pip). */
  onlineOnly?: boolean;
  /** Not available on web: shown with an "in the app" note and no route. */
  nativeOnly?: boolean;
}

export const LEARN_HUB: readonly HubEntry[] = [
  { id: 'practice', title: 'Practice questions', subtitle: 'Mixed sets across every topic', route: '/(tabs)/practice', icon: 'school-outline' },
  { id: 'ask-pip', title: 'Ask Pip', subtitle: 'Get any question explained', route: '/(tabs)/tutor', icon: 'chatbubble-ellipses-outline', onlineOnly: true },
  { id: 'weak-spots', title: 'Weak Spots', subtitle: 'Drill the questions you get wrong', route: '/(tabs)/practice?launch=weakspots', icon: 'locate-outline' },
  { id: 'speed-round', title: 'Speed Round', subtitle: '10 questions in 90 seconds', route: '/(tabs)/practice?launch=speed', icon: 'timer-outline' },
  { id: 'battle', title: 'Battle Mode', subtitle: 'Combo streaks on your weakest topics', route: '/(tabs)/practice?launch=battle', icon: 'flash-outline' },
  { id: 'challenge', title: 'Challenge a friend', subtitle: 'Send a head-to-head quiz', route: '/challenge', icon: 'people-outline' },
  { id: 'bookmarked', title: 'Bookmarked questions', subtitle: 'Your saved questions', route: '/(tabs)/practice?mode=bookmarked', icon: 'bookmark-outline' },
  { id: 'road-signs', title: 'Road signs', subtitle: 'Learn all UK signs', route: '/(tabs)/roadsigns', icon: 'warning-outline' },
  { id: 'highway-code', title: 'Highway Code', subtitle: 'Rules and regulations', route: '/(tabs)/highwaycode', icon: 'document-text-outline' },
  { id: 'study-plan', title: 'Study plan', subtitle: 'Your daily task to test day', route: '/study-plan', icon: 'calendar-outline' },
  { id: 'ai-study-plan', title: 'Personalise with Pip (AI)', subtitle: 'An AI study plan from your results', route: '/studyplan', icon: 'sparkles-outline', onlineOnly: true },
];

export const TESTS_HUB: readonly HubEntry[] = [
  { id: 'full-mock', title: 'Full mock', subtitle: '50 questions · 57 minutes · pass mark 43', route: '/(tabs)/mock', icon: 'clipboard-outline' },
  { id: 'quick-mock', title: 'Quick mock', subtitle: '25 questions · 28 minutes · pass mark 22', route: '/(tabs)/mock', icon: 'stopwatch-outline' },
  { id: 'hazard', title: 'Hazard perception', subtitle: 'Spot developing hazards in video clips', route: '/(tabs)/hazard', icon: 'play-circle-outline', nativeOnly: true },
];

export const PROGRESS_LINKS: readonly HubEntry[] = [
  { id: 'leaderboard', title: 'Leaderboards', subtitle: 'See how you rank', route: '/(tabs)/leaderboard', icon: 'trophy-outline' },
  { id: 'challenge', title: 'Challenge a friend', subtitle: 'Head-to-head quiz', route: '/challenge', icon: 'people-outline' },
];

// ─── Every route in 02-navigation-mapping.md ─────────────────────────────────

export type RouteExpectation =
  /** Renders a screen at this path (flag on and off). */
  | 'renders'
  /** Public / external entry: must render without a session. */
  | 'public';

export interface MappedRoute {
  path: string;
  /** The tab it belongs to under ui_v2, or null for stack screens outside the tabs. */
  tab: V2Tab | null;
  expect: RouteExpectation;
  /** Why it must keep working (external link source, alias, etc.). */
  note?: string;
}

/**
 * Every path named in the mapping doc (route table + external links). The
 * unit test checks each resolves to a route file; the e2e spec visits each.
 */
export const MAPPED_ROUTES: readonly MappedRoute[] = [
  { path: '/(tabs)/home', tab: 'home', expect: 'renders' },
  { path: '/(tabs)/practice', tab: 'learn', expect: 'renders' },
  { path: '/(tabs)/practice?mode=bookmarked', tab: 'learn', expect: 'renders' },
  { path: '/(tabs)/learn', tab: 'learn', expect: 'renders' },
  { path: '/(tabs)/roadsigns', tab: 'learn', expect: 'renders' },
  { path: '/roadsigns', tab: null, expect: 'renders', note: 'alias' },
  { path: '/(tabs)/highwaycode', tab: 'learn', expect: 'renders' },
  { path: '/highwaycode', tab: null, expect: 'renders', note: 'alias' },
  { path: '/(tabs)/tutor', tab: 'learn', expect: 'renders' },
  { path: '/aitutor', tab: null, expect: 'renders', note: 'alias' },
  { path: '/challenge', tab: null, expect: 'renders' },
  { path: '/study-plan', tab: null, expect: 'renders' },
  { path: '/studyplan', tab: null, expect: 'renders', note: 'AI plan, was orphaned' },
  { path: '/(tabs)/mock', tab: 'tests', expect: 'renders' },
  { path: '/(tabs)/tests', tab: 'tests', expect: 'renders', note: 'new Tests hub (ui_v2); flag off redirects to Home' },
  { path: '/(tabs)/hazard', tab: 'tests', expect: 'renders' },
  { path: '/hazard', tab: null, expect: 'renders', note: 'alias' },
  { path: '/(tabs)/progress', tab: 'progress', expect: 'renders' },
  { path: '/progress', tab: null, expect: 'renders', note: 'alias' },
  { path: '/(tabs)/leaderboard', tab: 'progress', expect: 'renders' },
  { path: '/leaderboard', tab: null, expect: 'renders', note: 'alias' },
  { path: '/(tabs)/settings', tab: 'profile', expect: 'renders', note: 'renders Profile under ui_v2' },
  { path: '/paywall', tab: null, expect: 'public', note: 'apps/web/index.html' },
  { path: '/payment-success', tab: null, expect: 'public', note: 'Stripe redirect (proxy.js)' },
  { path: '/linked-instructors', tab: null, expect: 'renders' },
  { path: '/testday', tab: null, expect: 'renders' },
  { path: '/ipassed', tab: null, expect: 'renders' },
  { path: '/', tab: null, expect: 'public' },
  { path: '/onboarding', tab: null, expect: 'public' },
  { path: '/landing', tab: null, expect: 'public' },
  { path: '/taster', tab: null, expect: 'public' },
  { path: '/auth/signup', tab: null, expect: 'public' },
  { path: '/auth/signin', tab: null, expect: 'public' },
  { path: '/auth/choose-account-type', tab: null, expect: 'public' },
  { path: '/auth/testdate', tab: null, expect: 'public' },
  { path: '/auth/reminders', tab: null, expect: 'public' },
  { path: '/auth/forgot-password', tab: null, expect: 'public' },
  { path: '/auth/reset-password', tab: null, expect: 'public' },
  { path: '/auth/callback', tab: null, expect: 'public', note: 'must never move' },
  { path: '/instructor', tab: null, expect: 'renders' },
  { path: '/connect-return', tab: null, expect: 'public', note: 'Stripe Connect (proxy.js)' },
  { path: '/connect-refresh', tab: null, expect: 'public', note: 'Stripe Connect (proxy.js)' },
  { path: '/confirm-parent', tab: null, expect: 'public', note: 'email link (proxy.js)' },
  { path: '/privacy-policy', tab: null, expect: 'public', note: 'apps/web' },
  { path: '/terms', tab: null, expect: 'public', note: 'apps/web' },
  { path: '/legal', tab: null, expect: 'public' },
  { path: '/contact', tab: null, expect: 'public', note: 'apps/web/instructors.html' },
  { path: '/screenshot-mode', tab: null, expect: 'renders', note: 'dev' },
  // getclearpass.co.uk/start and /signup are marketing-site URLs (apps/web), not app routes;
  // `start` is a deep link handled by src/deepLinks.ts.
];

/** Paths the mapping doc mentions that are deliberately NOT app routes. */
export const DOC_PATHS_NOT_APP_ROUTES: Readonly<Record<string, string>> = {
  '/(tabs)/profile': 'the doc offers it as an alternative; the Profile tab keeps the settings file (/(tabs)/settings)',
  '/signup': 'marketing-site page (apps/web/instructors.html), not an app route',
  '/start': 'getclearpass.co.uk/start universal link, handled by src/deepLinks.ts',
};

/**
 * The app/ file an Expo Router path resolves to, given the set of route
 * files that exist (paths relative to app/, without extension). Groups like
 * (tabs) are transparent in URLs, so `/progress` matches `progress` or
 * `(tabs)/progress`; explicit group paths must match exactly.
 */
export function resolveRouteFile(path: string, files: ReadonlySet<string>): string | null {
  const clean = path.split('?')[0]!.replace(/^\/+|\/+$/g, '');
  const candidates = clean === '' ? ['index', '(tabs)/index'] : [clean, `${clean}/index`, `(tabs)/${clean}`];
  for (const c of candidates) if (files.has(c)) return c;
  return null;
}
