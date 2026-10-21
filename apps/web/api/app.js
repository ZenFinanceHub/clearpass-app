export const config = { runtime: 'edge' };

const IOS_UA_REGEX = /iPad|iPhone|iPod/i;
const ANDROID_UA_REGEX = /Android/i;

// Tracked store links. App Store: provider token + campaign (App Store
// Connect > Analytics > Campaigns). Play: utm_* inside referrer (Play
// Console > Store performance by UTM campaign). The previous version passed
// ?ref= / a bare referrer, which neither store reads.
const APPLE_APP_ID = '6779180259';
const APPLE_PROVIDER_TOKEN = '129017368';
const PLAY_PACKAGE = 'co.uk.getclearpass.app';
const SITE_ROOT_URL = 'https://getclearpass.co.uk';

function cleanCampaign(ref) {
  const c = (ref || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return c || 'app_link';
}

export function appleUrl(ref) {
  return `https://apps.apple.com/gb/app/id${APPLE_APP_ID}?pt=${APPLE_PROVIDER_TOKEN}&ct=${encodeURIComponent(cleanCampaign(ref))}&mt=8`;
}

export function playUrl(ref) {
  const campaign = cleanCampaign(ref);
  const referrer = `utm_source=${campaign}&utm_medium=link&utm_campaign=${campaign}`;
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(referrer)}`;
}

export default function handler(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const ref = new URL(request.url).searchParams.get('ref');

  let destination;

  if (IOS_UA_REGEX.test(userAgent)) {
    destination = appleUrl(ref);
  } else if (ANDROID_UA_REGEX.test(userAgent)) {
    destination = playUrl(ref);
  } else {
    destination = SITE_ROOT_URL;
  }

  return Response.redirect(destination, 302);
}
