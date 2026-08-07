export type DeepLink =
  | { type: 'referral';        code: string }
  | { type: 'referralCapture'; code: string }
  | { type: 'confirmParent';   token: string }
  | { type: 'unknown' };

// Hosts that legitimately carry a root-level ?ref= (marketing site + app web build)
const REFERRAL_HOSTS = new Set(['getclearpass.co.uk', 'clearpass-app.vercel.app']);

export function handleIncomingUrl(url: string): DeepLink {
  try {
    // Normalise custom scheme to https for URL parsing
    const normalised = url
      .replace('clearpass://confirmParent', 'https://getclearpass.co.uk/confirm-parent')
      .replace('clearpass://confirm-parent', 'https://getclearpass.co.uk/confirm-parent')
      .replace('clearpass://referral', 'https://getclearpass.co.uk/referral')
      .replace('clearpass://', 'https://getclearpass.co.uk/');

    const parsed = new URL(normalised);
    const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();

    if (path === 'confirm-parent') {
      const token = parsed.searchParams.get('token');
      if (token) return { type: 'confirmParent', token };
    }

    if (path === 'referral') {
      const code = parsed.searchParams.get('code');
      if (code) return { type: 'referral', code: code.toUpperCase() };
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
