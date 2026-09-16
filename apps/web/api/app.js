export const config = { runtime: 'edge' };

const IOS_UA_REGEX = /iPad|iPhone|iPod/i;
const ANDROID_UA_REGEX = /Android/i;

const APPLE_APP_URL = 'https://apps.apple.com/gb/app/id6779180295';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.uk.getclearpass.app';
const SITE_ROOT_URL = 'https://getclearpass.co.uk';

export default function handler(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const ref = new URL(request.url).searchParams.get('ref');

  let destination;

  if (IOS_UA_REGEX.test(userAgent)) {
    destination = ref ? `${APPLE_APP_URL}?ref=${encodeURIComponent(ref)}` : APPLE_APP_URL;
  } else if (ANDROID_UA_REGEX.test(userAgent)) {
    destination = ref ? `${PLAY_STORE_URL}&referrer=${encodeURIComponent(ref)}` : PLAY_STORE_URL;
  } else {
    destination = SITE_ROOT_URL;
  }

  return Response.redirect(destination, 302);
}
