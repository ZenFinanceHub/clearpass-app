# Magic-Link Sign-In: Root Causes — 2026-09-15

Documenting this because it took a full day of investigation and the mechanism isn't
obvious from reading `app/auth/callback.tsx` alone. Two separate, independent causes,
both needed to fix before magic-link sign-in worked reliably. Fixing only one would
have left the other failing in a different way (warm delivery would still bounce with
"missing information" even with the verifier persisted; cold start would still throw
`pkce_code_verifier_not_found` even with the routing race fixed).

## Cause 1: `callback.tsx` cannot independently re-catch the deep link event that mounted it

`app/auth/callback.tsx` is only ever reached because expo-router's own internal
`Linking.addEventListener('url', ...)` subscriber (registered once at boot, in
`expo-router/build/fork/useLinking.native.js`) already resolved the incoming
`clearpass://auth/callback?code=...` URL and navigated here. `callback.tsx` used to
independently call `Linking.useURL()` / `Linking.getInitialURL()` to re-fetch that same
URL for itself — a second, separate listener racing the first one for the same
one-shot native `url` event.

On a **cold start**, that race is usually won by `getInitialURL()` (it directly asks
the native module for the launch URL, not dependent on event delivery order), so it
mostly worked. On a **warm start** — the app already running, user taps the link,
switches back — the event fires once, expo-router's listener consumes it and navigates
here, and there is nothing left to deliver to a second listener registered afterwards.
`useURL()` never resolves; `getInitialURL()` returns `null` (there was no fresh launch).
The screen's 3-second timeout fires and shows "Sign in link was missing information" —
**every time**, for every real user, since warm delivery (request the link inside the
app, switch to the mail app, tap, switch back) is the normal path, not an edge case.

**Fix:** read the PKCE `code` from `useLocalSearchParams()` instead. Since
`callback.tsx` only mounts *because* expo-router's routing already resolved this
navigation, the route params are already known synchronously — no race, no timeout
needed for this case. Confirmed via source (see Cause 3) that `code`, arriving as a
query param, survives expo-router's URL-to-route pipeline intact. The old
`useURL()`/`getInitialURL()` path stays as-is for the Google/Apple implicit-flow
branch, which structurally cannot use `useLocalSearchParams()` — see Cause 3.

## Cause 2: `persistSession: false` on the PKCE client meant the code verifier only lived in memory

Once Cause 1 was fixed, cold-start sign-in still failed, with
`pkce_code_verifier_not_found` and the (temporary, since-removed) on-screen diagnostic
confirming the verifier was reported **ABSENT**.

`src/supabaseMagicLink.ts` (the dedicated PKCE client used only for magic-link
request/exchange) was configured with `persistSession: false` and a `storage:
AsyncStorage` option. That combination doesn't do what it looks like it does. Confirmed
against `@supabase/auth-js`'s `GoTrueClient` constructor
(`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, ~lines 185–205):

```js
if (this.persistSession) {
  if (settings.storage) {
    this.storage = settings.storage;       // AsyncStorage only used HERE
  } else { /* localStorage / memory fallback */ }
} else {
  this.memoryStorage = {};
  this.storage = memoryLocalStorageAdapter(this.memoryStorage);   // always, unconditionally
}
```

When `persistSession` is `false`, the `storage` option is **never read at all** — the
client always uses an in-process, in-memory adapter instead. Every write of the PKCE
code verifier (`getCodeChallengeAndMethod()`, `helpers.js:264-274`, called from
`signInWithOtp`) goes through this same `this.storage`. So the verifier was always
memory-only, regardless of the `AsyncStorage` option being passed — it never survived
the process death between requesting the magic link and tapping it later, which is
exactly what a cold start is.

**Fix:** `persistSession: true`, on both the native and web option branches (the same
constructor logic applies to both — web's unset `storage` option falls back to
`localStorage` once `persistSession` is `true`, same fix shape as native's
`AsyncStorage`). The client's own `storageKey`
(`sb-clearpass-magiclink-pkce`, distinct from the main client's) still isolates its
storage from the main client's session — that isolation was never in question and
didn't need to change.

One verified side effect worth knowing about: `exchangeCodeForSession()` internally
calls `_saveSession()` (`GoTrueClient.js:1495`), which unconditionally persists the
exchanged session to `this.storage` under `storageKey`
(`GoTrueClient.js:3978-4013`) — no `persistSession` gate on that call either. So a
session blob for this client now lands in `AsyncStorage`/`localStorage` after every
successful exchange, where it previously was written and discarded in-memory. This
stays inert: nothing in the app calls `getSession()`/`onAuthStateChange()` on
`supabaseMagicLink`, and `autoRefreshToken: false` means no refresh ticker ever touches
it. Not a functional problem, but a real persisted artifact, not merely a documentation
detail.

## Why PKCE was necessary, not just preferable, for magic links

Related but separate finding, from source-reading `expo-router`'s own routing pipeline
(`expo-router/build/fork/extractPathFromURL.js`'s `fromDeepLink()`,
`expo-router/build/fork/getStateFromPath.js` /
`getStateFromPath-forks.js`):

- `fromDeepLink()` — the function that turns a raw incoming URL into the "path" string
  the rest of routing operates on — builds its result purely from `res.host` +
  `res.pathname` + a rebuilt query string from `res.searchParams`. **It never reads
  `res.hash` at all.** URL fragments (`#access_token=...&refresh_token=...`, the
  implicit-flow shape) are dropped at this first step, before routing or route-param
  resolution ever sees them.
- Downstream code that looks like fragment handling
  (`getUrlWithReactNavigationConcessions()`'s `hash` extraction,
  `parseQueryParams()`'s `params['#'] = hash.slice(1)`) is effectively dead for this
  purpose: it operates on the same already-hash-stripped path string, so the `hash` it
  extracts is structurally always empty.
- Query params (PKCE's `code`) don't have this problem — they're read from
  `res.searchParams` in `fromDeepLink()` and correctly reach `route.params`, hence
  `useLocalSearchParams()`.

**Conclusion:** an implicit-flow magic link (tokens in the fragment) could never be
read via `useLocalSearchParams()` under any circumstance — this isn't a workaround
that happened to be needed, it's why the PKCE migration was necessary in the first
place for `useLocalSearchParams()` to be usable at all for magic links. Google/Apple
sign-in still uses implicit flow and still cannot use `useLocalSearchParams()` for that
reason; `callback.tsx` still parses the raw URL directly for that branch.

## Correcting a prior misattribution

`callback.tsx` previously carried a comment (introduced in `6f06edd2`, "fix: Google
sign-in via implicit-flow tokens instead of PKCE code exchange") claiming
`useLocalSearchParams()` had been abandoned because "`.pathname`/`.host` are unreliable
for a non-http(s) scheme on React Native... silently return `''` for `clearpass://`".

That claim doesn't hold up: `fromDeepLink()` reads exactly `res.host`/`res.pathname` to
route `clearpass://` deep links, and that routing demonstrably works (this same
`/auth/callback` route, `confirm-parent`, and others all depend on it). The `6f06edd2`
commit was written when Google's redirect only ever carried implicit-flow tokens in the
fragment — so `useLocalSearchParams()` genuinely did come back empty for those, just not
for the reason stated. The real cause was the fragment-drop documented above, which
applies regardless of scheme or `.pathname`/`.host` correctness. The comment in
`callback.tsx` has been corrected to describe the actual mechanism.
