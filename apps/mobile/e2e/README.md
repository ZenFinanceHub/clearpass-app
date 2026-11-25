# ClearPass web e2e (Playwright)

The suite runs against a **local static web export** of the app with every
backend call answered by synthetic stubs. It never talks to production.

## Run it

From `apps/mobile` (after `npm ci` in `packages/core`, `packages/content` and here):

```bash
npx playwright install chromium     # once
npm run test:e2e                    # export + serve + run (desktop-chromium and mobile-chromium)
E2E_SKIP_EXPORT=1 npm run test:e2e  # reuse the existing dist-e2e/ (fast reruns)
npx playwright test e2e/smoke.spec.ts --project=desktop-chromium
npm run test:e2e:report             # open the last HTML report
```

`playwright.config.ts` builds `dist-e2e/` with `expo export --platform web`
(with `EXPO_NO_DOTENV=1`, so a local `.env` is never baked in) and serves it
on `http://127.0.0.1:8090` with `e2e/support/static-server.mjs`. Change the
port with `E2E_PORT`. CI runs the same command (`.github/workflows/ci.yml`).

`BASE_URL` is no longer read (setting it is an error). `E2E_REMOTE_BASE_URL`
loads the pages from a deployed origin instead, for **public pages only**
(no sign-in). The harness still stubs or blocks every backend call. It is
refused when `CI` is set, so it never runs in CI.

## Harness rules (`e2e/support/`)

Import `test` and `expect` from `./support`, never from `@playwright/test`.
That `test` installs the network harness on every browser context:

| Request | What happens |
|---|---|
| loopback (`127.0.0.1`, `localhost`): the export | passes through |
| `*.supabase.co`: REST, auth, storage, functions, realtime | synthetic stub, never forwarded |
| `clearpass-app-production.up.railway.app` | synthetic stub, never forwarded |
| anything else (Vercel, getclearpass.co.uk, RevenueCat, Stripe, Anthropic, Sentry, fonts...) | **aborted** |

Every non-loopback request is recorded. If any request was not claimed by a
stub, the test **fails at teardown** and lists the URLs, even if the app
swallowed the network error. The `request` fixture (APIRequestContext) is
disabled because it bypasses page routing. Service workers are blocked.
`e2e/network-guard.spec.ts` proves all of this for each production host.

Default stub behaviour (`e2e/support/stubs.ts`):

- **Auth**: no session by default. `/auth/v1/user` returns `network.authUser` or 401. Every token grant (password, PKCE, refresh) is rejected.
- **REST**: `GET /rest/v1/<table>` returns `network.db[<table>]` (default `[]`). `.single()` gets a 406 unless there is exactly one row. Writes succeed and echo the payload. RPCs return `network.rpc[<fn>]` (default `null`).
- **Storage**: image paths get a 1x1 image. Other paths get a 404.
- **Railway**: `/api/explain` (Ask Pip, study plan) replies with `network.pipReply`. `/api/config` returns test-mode config. `/api/create-checkout-session` returns 503. Everything else returns `{ ok: true }`.

## Synthetic learner state

```ts
import { test, expect, seedLearner, signInAs, clientNavigate } from './support';

test('signed-in learner', async ({ page, network }) => {
  await seedLearner(page, { progress: { xp: 120, isPro: false } }); // localStorage, before boot
  await signInAs(page, network, { accountType: 'learner' });        // fake session + profile row
  await page.goto('/(tabs)/home');
});
```

- `seedLearner(page, { onboarded, progress, sessionHistory, bookmarks, extra })` writes the AsyncStorage (localStorage) keys the app reads. `onboarded` defaults to `true` and sets both onboarding keys.
- `signInAs(page, network, { id, email, accountType, profile })` writes a JWT-shaped, unsigned session under `sb-<ref>-auth-token`, serves the same user from `/auth/v1/user`, and adds a `profiles` row. With `accountType: null` the profile has no account type.
- `clientNavigate(page, path)` reaches a screen through in-app navigation. Use it for screens such as `/landing`, which `app/_layout.tsx` redirects on a cold load when the visitor is signed out.

Without a session, `app/_layout.tsx` sends cold loads of non-public routes to
`/onboarding` (first visit) or `/auth/signin` (onboarding seen).

## Adding a stub

For one test, register an override. Overrides take priority over the
defaults, and the most recently added override wins:

```ts
import { test, expect, json, RAILWAY_HOST } from './support';

test('daily limit', async ({ page, network }) => {
  network.stub({
    name: 'explain-429',
    match: (url) => url.hostname === RAILWAY_HOST && url.pathname === '/api/explain',
    handle: (route) => json(route, 429, { isPro: false }),
  });
  network.db.leaderboard = [{ username: 'synthetic', xp: 10 }]; // or seed the default REST stub
});
```

If many specs need the same behaviour, add it to `stubs.ts`. Rules for any
stub:

- It must end in `route.fulfill()` or `route.abort()`. Never use `route.continue()` or `route.fetch()` for a non-loopback URL.
- Use synthetic data only: no real users, tokens, keys or production rows.
- Never stub a production host so that it passes through. To allow a new third-party host, write a stub that fulfils it locally.

`network.requests`, `network.requestsTo(host)` and `network.unexpected` are
available for assertions. `network.disableDefaultStub('supabase' | 'railway')`
turns a default off.

## Skipped tests

- `hazard.spec.ts`: clip loading and premium playback. The web build shows "Mobile app only" before it loads any clip, so these need a device run.
- `public-routes.spec.ts` "past date shows validation error" (`test.fixme`): `app/onboarding.tsx` accepts past dates. This is existing app behaviour.
