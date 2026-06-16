export type DeepLink =
  | { type: 'referral';      code: string }
  | { type: 'confirmParent'; token: string }
  | { type: 'unknown' };

export function handleIncomingUrl(url: string): DeepLink {
  try {
    // Normalise custom scheme to https for URL parsing
    const normalised = url
      .replace('clearpass://confirmParent', 'https://clearpass.app/confirm-parent')
      .replace('clearpass://confirm-parent', 'https://clearpass.app/confirm-parent')
      .replace('clearpass://referral', 'https://clearpass.app/referral')
      .replace('clearpass://', 'https://clearpass.app/')
      .replace('https://getclearpass.co.uk/', 'https://clearpass.app/');

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

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}
