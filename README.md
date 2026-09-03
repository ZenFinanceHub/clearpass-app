# ClearPass

UK driving theory test prep app — Expo React Native monorepo.

## Setup

```
npm install
cd apps/mobile && npm install
```

## Environment variables

The AI tutor feature requires an Anthropic API key. Create `apps/mobile/.env.local` (this file is git-ignored and must never be committed):

```
ANTHROPIC_API_KEY=your_key_here
```

Get a key at https://console.anthropic.com. Without a key the AI tutor falls back to a plain-text hint.

## Running

```
cd apps/mobile
npx expo start --clear
```

## Publishing OTA updates

Always pass `--environment production` when publishing to the production channel:

```
cd apps/mobile
npx eas-cli update --branch production --environment production --message "..."
```

`eas update` does not automatically load EAS's server-side "production" environment variables the way `eas build` does — without `--environment production` it only loads local `.env`/`.env.local` files. `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`/`_IOS` exist only in EAS's environment store, not in any local `.env` file, so an OTA update published without this flag silently ships with those keys undefined, even though the store build it's updating is fine. This happened for real on 2026-09-02/03 — every OTA published that day and republished afterward.
