// Real store URLs, duplicated from apps/mobile/app/ipassed.tsx rather than
// imported (see lib/theme.ts for why this app duplicates instead). The App
// Store URL's numeric id is a placeholder until Apple actually assigns one
// on approval — using it now, not a fake placeholder of our own, so this
// starts working the moment that id is filled in over there, with nothing
// to change here.
export const APP_STORE_URL = "https://apps.apple.com/app/clearpass-theory-test/id000000000";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=co.uk.getclearpass.app";

// Neither store listing is live yet. A single build-time switch, flipped in
// Vercel's env vars the day both are actually live — same shape as mobile's
// getPurchaseRoute() being the one place that knows what's available today.
// Defaults to false (coming-soon) so an unset var fails toward "don't show a
// link that 404s", not the other way round.
export const STORE_LISTINGS_LIVE = process.env.NEXT_PUBLIC_STORE_LISTINGS_LIVE === "true";
