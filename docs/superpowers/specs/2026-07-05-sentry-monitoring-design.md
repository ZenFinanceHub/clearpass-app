# Sentry Error Monitoring — ClearPass

**Date:** 2026-07-05  
**Status:** Approved

---

## Goal

Add real-time crash and error reporting to the ClearPass React Native app using Sentry, so production crashes appear in a dashboard with readable stack traces, environment tagging, and 20% performance tracing.

---

## Package Choice

Use `@sentry/react-native` directly — **not** `sentry-expo` (deprecated since Expo SDK 50). The SDK includes a first-party Expo config plugin (`@sentry/react-native/expo`) that handles all native setup and source map upload.

Install command:
```
npx expo install @sentry/react-native
```

---

## Files Changed

| File | Change |
|---|---|
| `apps/mobile/app/_layout.tsx` | Sentry.init() at module level; ErrorBoundary around stack; Sentry.wrap() on export |
| `apps/mobile/app.json` | Add `@sentry/react-native/expo` plugin |
| `apps/mobile/.env` | Add `EXPO_PUBLIC_SENTRY_DSN` stub |
| `apps/mobile/app/(tabs)/settings.tsx` | Dev-only test error button at bottom of settings list |

No changes to `eas.json` — source map upload is fully handled by the Expo plugin.

---

## Initialisation (`app/_layout.tsx`)

`Sentry.init()` is called at **module level** (outside the component), so it runs before any React rendering:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
  // enabled in both envs so dev builds can verify delivery
});
```

The exported component becomes `Sentry.wrap(RootLayout)` — this hooks into React Native's native crash reporter and populates Sentry breadcrumbs.

A `<Sentry.ErrorBoundary>` wraps the root `<Stack>` inside the component, catching any JS render errors before they propagate to a native crash. The fallback is a minimal full-screen view: "Something went wrong. Please restart the app."

---

## app.json Plugin

```json
["@sentry/react-native/expo", {
  "organization": "PLACEHOLDER_ORG_SLUG",
  "project": "clearpass"
}]
```

Fill `organization` with the Sentry org slug once the account is created. The plugin:
- Patches iOS/Android native files for crash reporting
- Uploads source maps automatically during EAS builds when `SENTRY_AUTH_TOKEN` is present

---

## Source Maps

Source map upload is automatic — no changes to `eas.json` needed. One-time setup after Sentry account creation:

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```

The token is a Sentry Auth Token with `project:releases` and `org:read` scopes. It is **never committed** to the repo.

---

## Dev Test Button (Settings)

A `__DEV__`-guarded row at the bottom of the settings screen:

```tsx
{__DEV__ && (
  <TouchableOpacity onPress={() => Sentry.captureException(new Error('Test error from ClearPass'))}>
    <Text>Test Sentry (dev only)</Text>
  </TouchableOpacity>
)}
```

This sends a non-crashing exception to Sentry. Verify in the Sentry dashboard that the event arrives with `environment: development`. Stripped entirely from production builds because `__DEV__` is false and tree-shaken.

---

## Environment Setup (Post-Account Creation Checklist)

1. Create Sentry account → new project → Platform: React Native
2. Copy DSN → paste into `apps/mobile/.env` replacing the placeholder
3. Copy org slug → paste into `app.json` plugin config replacing `PLACEHOLDER_ORG_SLUG`
4. Generate Auth Token (scopes: `project:releases`, `org:read`) → add as EAS secret

---

## What Is NOT in Scope

- Session replay / mobile replay (can be added later)
- User identity tagging (can call `Sentry.setUser()` after auth if wanted later)
- Custom breadcrumbs beyond what the SDK provides automatically
- Alerting/notification rules in Sentry (configured in dashboard, not code)
