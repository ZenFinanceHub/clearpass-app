# Deployment boundaries

This repo has no root `package.json` and no monorepo workspace tooling
(no npm/pnpm/yarn workspaces, no Turborepo, no Nx). Each deployable app
is fully independent. That's simple until a build platform scopes itself
to a subdirectory — then "independent" starts to matter in ways that
aren't obvious until they crash in production. This file exists because
that happened twice in one week.

## The rule

**A deployment scoped to a Root Directory cannot see anything outside
it, no matter how the import is written.** `../` and `../../` in source
code are lies if the build platform never copied those parent
directories into the build in the first place. This isn't a Node
resolution quirk — it's true for every platform below.

## The three deployments that exist today

### 1. Railway — `clearpass-app` service, Root Directory `apps/mobile/server`

Runs `proxy.js` and everything under `apps/mobile/server/`. Nothing
outside that directory exists in the container Railway builds — not
`apps/mobile/src`, not `packages/`, nothing.

**What broke**: `proxy.js` had `require('../src/constants/earnings')`,
resolving to `apps/mobile/src/constants/earnings.js` — one directory
above Railway's root. Every deploy crash-looped with `MODULE_NOT_FOUND`
from at least 2026-08-14 until it was caught and fixed. The fix moved
the file to `apps/mobile/server/lib/earnings.js`, inside the root.

**Guard against a repeat**: `scripts/verify-build-boundary.sh` — copies
only `apps/mobile/server` to a temp directory (no `node_modules`, no
`.env`, matching what Railway actually has) and statically confirms
every local `require()` reachable from `proxy.js` resolves inside that
copy. Run it before merging any change that touches `proxy.js` or adds a
file under `server/lib/`.

### 2. Vercel — `clearpass-app` project, Root Directory `apps/mobile`

Builds the Expo web export (`npx expo export --platform web`) for
`clearpass-app-production.up.railway.app`'s companion web build. Root
Directory is `apps/mobile`, so in principle `apps/mobile/server/lib/*`
files are inside the same root Railway builds from — but `apps/mobile/
.vercelignore` blanket-excluded `server/` entirely, so Vercel's build
never received them either.

**What broke**: fixing incident 1 by moving `earnings.js` into
`server/lib/` immediately broke *this* build instead — `instructor.tsx`
importing it hit `.vercelignore`'s `server/` exclusion. Same underlying
rule, opposite direction: this boundary excludes a directory *within*
its own root, rather than everything outside a smaller root like
Railway's.

**Guard against a repeat**: `.vercelignore` now names exactly what
shouldn't ship to the client (`server/proxy.js`, `server/package.json`,
`server/package-lock.json`, `server/.env`, `server/scripts`) instead of
excluding the whole `server/` directory, so `server/lib/*` — small,
dependency-free, no secrets — stays reachable. Verify a `.vercelignore`
change by testing the pattern set with `git check-ignore` (same syntax)
before pushing, and ideally reproduce the actual checkout locally (copy
the repo respecting the ignore rules, run the real build command against
that copy) rather than trusting the pattern alone.

### 3. Vercel — `instructor-web` project, Root Directory `apps/instructor-web`

Instructor-facing purchase/seat-management app. Root Directory is
`apps/instructor-web`, a sibling of `apps/mobile` and `packages/`.

**The trap this one introduces**: `apps/mobile`'s `node_modules/
@clearpass/{core,content,ai}` are relative symlinks
(`../../../../packages/core`, etc.) pointing into `packages/`. They work
locally because someone (or `npm install`, if a postinstall script ever
sets them up) created them by hand in this checkout. There is no root
`package.json` declaring workspaces, so a fresh `npm install` inside a
Vercel build scoped to a different Root Directory has no way to know
those symlinks should exist — it just runs `npm install` against
whatever `package.json` lives in that root and nothing else.

**Guard against this one — decided before any code was written, not
discovered after a crash**: `apps/instructor-web` imports nothing from
outside its own directory. No `@clearpass/core`, no reaching into
`apps/mobile/src`. Every dependency is either an npm package in its own
`package.json` or code physically written inside `apps/instructor-web`.
Where something small is genuinely needed from elsewhere (e.g. a type
shape), it's duplicated locally rather than imported — a few duplicated
lines cost nothing; a working-locally-broken-on-Vercel import costs a
production incident. Verified by running a clean `npm install` and
`npm run build` from inside `apps/instructor-web` only, not from the
repo root, so nothing from an ambient root-level `node_modules` or a
pre-existing symlink can mask a real problem.

## If you're adding a fourth deployment

Ask, before writing any code: what is this platform's Root Directory
going to be, and does anything this app needs live outside it? If the
answer is "yes, via a workspace symlink" or "yes, via a relative `../`
path," that dependency will work on your machine and nowhere else. Copy
it in, publish it as a real package, or don't take the dependency.
