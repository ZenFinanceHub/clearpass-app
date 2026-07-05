# Sentry Error Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sentry real-time crash reporting to the ClearPass Expo app so production errors appear in a dashboard with readable stack traces.

**Architecture:** `Sentry.init()` runs at module level in the root layout before any React renders; `Sentry.wrap()` hooks into native crash reporting; `<Sentry.ErrorBoundary>` catches JS render panics. Source maps upload automatically during EAS builds via the `@sentry/react-native/expo` Expo config plugin.

**Tech Stack:** `@sentry/react-native` (SDK-native, no sentry-expo wrapper), Expo SDK ~54, Expo Router, EAS Build.

## Global Constraints

- Expo SDK version: ~54.0.33 — use `npx expo install` not `npm install` to ensure compatible version resolution
- Package: `@sentry/react-native` only — do NOT install `sentry-expo` (deprecated)
- DSN env var name: `EXPO_PUBLIC_SENTRY_DSN` — must have `EXPO_PUBLIC_` prefix for Expo to expose it client-side
- `tracesSampleRate`: exactly `0.2` (20%)
- Sentry enabled in both dev and production (tagged by environment string)
- Dev test button: `__DEV__` guard only — no platform guard, no separate env file
- Do not modify `eas.json` — source maps are handled entirely by the Expo plugin

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/app/_layout.tsx` | Modify | Sentry init, ErrorBoundary, wrap export |
| `apps/mobile/app.json` | Modify | Add `@sentry/react-native/expo` plugin |
| `apps/mobile/.env` | Modify | Add DSN stub env var |
| `apps/mobile/app/(tabs)/settings.tsx` | Modify | Dev-only test error button |

---

## Task 1: Install package and stub env var

**Files:**
- Modify: `apps/mobile/.env`
- Run: `npx expo install @sentry/react-native` in `apps/mobile/`

**Interfaces:**
- Produces: `@sentry/react-native` available to import; `process.env.EXPO_PUBLIC_SENTRY_DSN` defined (placeholder value)

- [ ] **Step 1: Install the package**

```bash
cd apps/mobile
npx expo install @sentry/react-native
```

Expected output: Package added to `package.json` and `package-lock.json` (or yarn.lock). No peer dependency errors.

- [ ] **Step 2: Add DSN stub to `.env`**

Open `apps/mobile/.env`. It currently contains:
```
EXPO_PUBLIC_API_URL=https://clearpass-app.vercel.app
```

Add this line:
```
EXPO_PUBLIC_SENTRY_DSN=PASTE_YOUR_DSN_HERE
```

The file should now read:
```
EXPO_PUBLIC_API_URL=https://clearpass-app.vercel.app
EXPO_PUBLIC_SENTRY_DSN=PASTE_YOUR_DSN_HERE
```

> **Note:** After creating the Sentry account and project, replace `PASTE_YOUR_DSN_HERE` with the real DSN from Sentry → Project Settings → Client Keys (DSN).

- [ ] **Step 3: Verify TypeScript can resolve the package**

```bash
cd apps/mobile
npx tsc --noEmit 2>&1 | grep -i sentry
```

Expected: no output (no Sentry-related type errors).

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add package.json package-lock.json .env
git commit -m "feat: install @sentry/react-native"
```

---

## Task 2: Add Expo config plugin to app.json

**Files:**
- Modify: `apps/mobile/app.json` (plugins array)

**Interfaces:**
- Produces: EAS build will run the Sentry Expo plugin, patching native files and uploading source maps when `SENTRY_AUTH_TOKEN` is set

- [ ] **Step 1: Add the plugin**

Open `apps/mobile/app.json`. The `plugins` array currently ends with `"expo-web-browser"`. Add the Sentry plugin as the last entry:

```json
"plugins": [
  "expo-router",
  "expo-font",
  [
    "expo-notifications",
    {
      "icon": "./assets/icon.png",
      "color": "#0D9488",
      "defaultChannel": "default"
    }
  ],
  "expo-apple-authentication",
  "expo-web-browser",
  [
    "@sentry/react-native/expo",
    {
      "organization": "PLACEHOLDER_ORG_SLUG",
      "project": "clearpass"
    }
  ]
]
```

> **Note:** Replace `PLACEHOLDER_ORG_SLUG` with your Sentry organization slug (found in Sentry → Settings → Organization → the slug in the URL). The `project` value `"clearpass"` matches the project name you'll create.

- [ ] **Step 2: Verify app.json is valid JSON**

```bash
cd apps/mobile
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat: add @sentry/react-native/expo config plugin"
```

---

## Task 3: Initialise Sentry in root layout

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `process.env.EXPO_PUBLIC_SENTRY_DSN` (from Task 1)
- Produces: `Sentry` module initialised globally; all uncaught JS and native crashes captured; `<Sentry.ErrorBoundary>` wrapping entire tree; export is `Sentry.wrap(RootLayout)`

- [ ] **Step 1: Add Sentry import at the top of `_layout.tsx`**

The file currently starts:
```tsx
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
```

Add the Sentry import as the very first import (before all others):
```tsx
import * as Sentry from '@sentry/react-native';
```

So the file now opens with:
```tsx
import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// ... rest of imports unchanged
```

- [ ] **Step 2: Add `Sentry.init()` call at module level, after the imports**

Find the line:
```tsx
configureNotificationHandler();
```

Add `Sentry.init()` immediately **before** that line:
```tsx
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
});

configureNotificationHandler();
```

- [ ] **Step 3: Add a fallback component for the ErrorBoundary**

Add this component definition immediately before the `RootLayout` function declaration (which starts at `export default function RootLayout()`). Do not change the `RootLayout` function declaration yet:

```tsx
function SentryFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
        {'Something went wrong'}
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
        {'Please close and reopen the app.'}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Wrap the return JSX with `<Sentry.ErrorBoundary>` and change the export**

The `RootLayout` function currently:
- Is declared as `export default function RootLayout()`
- Returns `<AccessibilityProvider>...</AccessibilityProvider>`

Make two changes:

**a)** Change the declaration line from:
```tsx
export default function RootLayout() {
```
to:
```tsx
function RootLayout() {
```

**b)** Wrap the entire return with `<Sentry.ErrorBoundary>`. Change:
```tsx
  return (
    <AccessibilityProvider>
```
to:
```tsx
  return (
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <AccessibilityProvider>
```

And close it by changing:
```tsx
    </AccessibilityProvider>
  );
```
to:
```tsx
      </AccessibilityProvider>
    </Sentry.ErrorBoundary>
  );
```

**c)** Add the wrapped export at the very end of the file, after the `toastStyles` StyleSheet (which ends around line 221):
```tsx
export default Sentry.wrap(RootLayout);
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd apps/mobile
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors). If you see `Cannot find name '__DEV__'`, add `/// <reference types="react-native" />` at the top of `_layout.tsx` — though this error should not occur as `__DEV__` is declared by the React Native type package already installed.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat: initialise Sentry in root layout with ErrorBoundary"
```

---

## Task 4: Dev-only test button in Settings

**Files:**
- Modify: `apps/mobile/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `Sentry` module (globally initialised by Task 3)
- Produces: Amber-coloured "Test Sentry (dev only)" button visible only when `__DEV__ === true`; tapping sends a non-crashing `captureException` event to Sentry

- [ ] **Step 1: Add Sentry import to settings.tsx**

Open `apps/mobile/app/(tabs)/settings.tsx`. Find the first import line and add:
```tsx
import * as Sentry from '@sentry/react-native';
```
alongside the other imports at the top of the file.

- [ ] **Step 2: Add the test button after the Sign Out button**

Find this block (around line 988):
```tsx
      <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()} activeOpacity={0.85}>
        <Text style={styles.signOutBtnText}>{'Sign Out'}</Text>
      </TouchableOpacity>
```

Add the test button immediately after it:
```tsx
      <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()} activeOpacity={0.85}>
        <Text style={styles.signOutBtnText}>{'Sign Out'}</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => Sentry.captureException(new Error('Test error from ClearPass'))}
          activeOpacity={0.85}
        >
          <Text style={[styles.signOutBtnText, { color: '#F59E0B' }]}>{'Test Sentry (dev only)'}</Text>
        </TouchableOpacity>
      )}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd apps/mobile
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/settings.tsx
git commit -m "feat: add dev-only Sentry test button in Settings"
```

---

## Task 5: Manual smoke test

This task has no code — it is the verification gate before considering the integration complete.

**Prerequisites:** Sentry account created, real DSN pasted into `.env`, org slug filled in `app.json`.

- [ ] **Step 1: Start the Expo dev server**

```bash
cd apps/mobile
npx expo start
```

Open in a simulator or on a physical device via Expo Go / dev build.

- [ ] **Step 2: Navigate to Settings and tap the test button**

The amber "Test Sentry (dev only)" button should appear below "Sign Out" (visible in dev builds only). Tap it.

- [ ] **Step 3: Verify event in Sentry dashboard**

Open your Sentry project → Issues. Within ~30 seconds you should see a new issue:
- Title: `Error: Test error from ClearPass`
- Environment: `development`
- Stack trace pointing to `settings.tsx`

If the event does not arrive, check:
1. `EXPO_PUBLIC_SENTRY_DSN` in `.env` matches the DSN in Sentry → Project Settings → Client Keys
2. The dev server restarted after `.env` was updated (Expo caches env vars)
3. Network connectivity from the device/simulator to `sentry.io`

- [ ] **Step 4: Post-account setup — fill in placeholders**

Once the Sentry account exists and the smoke test passes:

a) `.env` — replace `PASTE_YOUR_DSN_HERE` with real DSN  
b) `app.json` — replace `PLACEHOLDER_ORG_SLUG` with real org slug  
c) Add `SENTRY_AUTH_TOKEN` as EAS secret for source map upload:

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token-from-sentry>
```

Generate the token in Sentry → Settings → Auth Tokens with scopes: `project:releases`, `org:read`.

---

## Self-Review Notes

- **Spec coverage check:** install ✓, env ✓, app.json plugin ✓, init ✓, environment tagging ✓, `tracesSampleRate: 0.2` ✓, ErrorBoundary ✓, `Sentry.wrap()` ✓, dev test button ✓, source maps via plugin ✓, `SENTRY_AUTH_TOKEN` EAS secret ✓
- **No placeholders in code steps** — all code is complete and copy-pasteable
- **Type consistency** — `Sentry` imported as `* as Sentry` in both files, same namespace used throughout
- **`__DEV__`** is a global boolean provided by React Native's type definitions — no extra declaration needed
