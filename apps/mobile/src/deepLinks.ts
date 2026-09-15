export type DeepLink =
  | { type: 'referral';        code: string }
  | { type: 'referralCapture'; code: string }
  | { type: 'confirmParent';   token: string }
  | { type: 'authCallback' }
  | { type: 'unknown' };

// Hosts that legitimately carry a root-level ?ref= (marketing site + app web build)
const REFERRAL_HOSTS = new Set(['getclearpass.co.uk', 'clearpass-app.vercel.app']);

// Normalises a raw clearpass://... or https://getclearpass.co.uk/... URL to
// a parseable https URL. Shared by handleIncomingUrl below and by
// getDeepLinkPath, so there's exactly one place that knows how to turn a
// custom-scheme URL into something URL() can parse.
function normaliseDeepLink(url: string): URL | null {
  try {
    const normalised = url
      .replace('clearpass://confirmParent', 'https://getclearpass.co.uk/confirm-parent')
      .replace('clearpass://confirm-parent', 'https://getclearpass.co.uk/confirm-parent')
      .replace('clearpass://referral', 'https://getclearpass.co.uk/referral')
      .replace('clearpass://', 'https://getclearpass.co.uk/');
    return new URL(normalised);
  } catch {
    return null;
  }
}

// The lowercased, leading-slash-stripped path a raw URL resolves to (e.g.
// 'auth/callback', 'confirm-parent'), or null if it can't be parsed at all.
// Exported so app/_layout.tsx's bootstrap() can ask "does the URL that
// launched this app resolve to a route I must not override" directly from
// the raw launch URL (Linking.getInitialURL()) rather than from
// expo-router's segments — segments can still be resolving by the time
// bootstrap's async work finishes, which is exactly the cold-start race
// this function exists to let bootstrap sidestep. Needs no navigation
// state at all, just the raw string, so there's nothing to race against.
export function getDeepLinkPath(url: string): string | null {
  const parsed = normaliseDeepLink(url);
  if (!parsed) return null;
  return parsed.pathname.replace(/^\/+/, '').toLowerCase();
}

export function handleIncomingUrl(url: string): DeepLink {
  const parsed = normaliseDeepLink(url);
  if (!parsed) return { type: 'unknown' };
  try {
    const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();

    if (path === 'confirm-parent') {
      const token = parsed.searchParams.get('token');
      if (token) return { type: 'confirmParent', token };
    }

    if (path === 'referral') {
      const code = parsed.searchParams.get('code');
      if (code) return { type: 'referral', code: code.toUpperCase() };
    }

    // The Google sign-in OAuth redirect (see src/socialAuth.ts). This is
    // handled by its own route, app/auth/callback.tsx — recognised here so
    // it's classified correctly rather than lumped in with genuinely
    // unrecognised URLs.
    if (path === 'auth/callback') {
      return { type: 'authCallback' };
    }

    if ((path === '' || path === 'start') && REFERRAL_HOSTS.has(parsed.hostname)) {
      const ref = parsed.searchParams.get('ref');
      if (ref) return { type: 'referralCapture', code: ref.toUpperCase() };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}
