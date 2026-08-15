# instructor-web

Minimal instructor-facing web app for instructor-paid seats (phase 3). Lets
an instructor sign in, buy a £5.99 learner seat, and get its invite link.
Deployed separately from `apps/mobile` — see
[`apps/mobile/server/README.md`](../mobile/server/README.md) for why this
app imports nothing from the rest of the monorepo.

## What's here

- `/login` — email/password via Supabase auth (same project as the mobile app)
- `/` — after sign-in, checks `profiles.account_type`; anything but
  `'instructor'` gets signed out with an explanation, not silently let through
- `/dashboard` — buy a seat, see existing seats and their redemption status
- `/purchase-success` — lands here after Stripe checkout, shows the new
  invite link once the webhook has minted it

Not here, on purpose: the learner redemption page, learner progress views,
instructor signup, seat management beyond viewing, email. Later phases.

## Local development

```bash
cp .env.example .env.local   # values are already correct for the shared dev project
npm install
npm run dev
```

## Env vars

See `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
are the same project the mobile app uses — safe client-side, RLS is the real
boundary. Never add a service-role key to this app.

## Deploying

Separate Vercel project, Root Directory `apps/instructor-web`, framework
auto-detects as Next.js — no custom build/output command needed. Domain:
`instructors.getclearpass.co.uk`.
