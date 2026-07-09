# Google Play Submission Checklist

Step-by-step guide for submitting ClearPass to Google Play once identity verification clears.

---

## Pre-submission checklist

- [ ] Google Play identity verification complete (waiting on Google)
- [ ] EAS account configured (`craigyp1982` — confirmed in app.json)
- [ ] Android keystore generated (EAS manages this automatically with managed credentials)
- [ ] `app.json` reviewed: version 1.0.0, versionCode 1, package `co.uk.getclearpass.app`
- [ ] Supabase production project live
- [ ] Railway proxy live at `clearpass-app-production.up.railway.app`
- [ ] All Railway env vars set (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY, STRIPE_PRICE_ID)

---

## Step 1: Build the APK / AAB with EAS

```bash
# Install EAS CLI if not already
npm install -g eas-cli

# Log in
eas login

# Build production Android AAB (recommended for Play Store)
cd apps/mobile
eas build --platform android --profile production
```

EAS will use the managed credentials stored in your Expo account.
The output is an `.aab` (Android App Bundle) — this is what Google Play requires.

Download the AAB from the EAS dashboard after the build completes.

---

## Step 2: Create the app in Google Play Console

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - App name: `ClearPass - Theory Test`
   - Default language: `English (United Kingdom)`
   - App or game: `App`
   - Free or paid: `Free`
4. Accept the declarations and click **Create app**

---

## Step 3: Store Listing

Navigate to **Store presence > Main store listing**:

- **App name:** ClearPass - Theory Test
- **Short description:** (copy from `docs/app-store-metadata.md` — 80 chars max)
- **Full description:** (copy from `docs/app-store-metadata.md`)
- **App icon:** Upload `apps/mobile/assets/icon.png` (must be 512x512 PNG)
- **Feature graphic:** Create a 1024x500px banner (teal gradient with app name)
- **Phone screenshots:** Upload at least 4 portrait screenshots (see app-store-metadata.md for list)
- **Contact details:** Email `privacy@clearpass.app`
- **Privacy policy:** `https://clearpass-app.vercel.app/privacy-policy`

---

## Step 4: Content Rating Questionnaire

Navigate to **Policy > App content > Content rating**:

- Category: **Education**
- Answer all questions honestly:
  - Violence: **No**
  - Sexual content: **No**
  - Real gambling: **No** (there is an in-app purchase but it is a non-gambling subscription)
  - User-generated content: **No** (pass stories are submitted but not public chat)
  - Personal information collected: **Yes** (email address)
- Expected rating: **Everyone** or **Everyone 10+**

---

## Step 5: Data Safety Form

Navigate to **Policy > App content > Data safety**:

### Data collected and shared

| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Email address | Yes | No | Account authentication | No |
| User ID | Yes | No | App functionality | No |
| App interactions (quiz scores, streaks) | Yes | No | App functionality, analytics | No |
| Crash logs | Yes | No | App performance | No |
| Payment info | No (Stripe handles this) | — | — | — |

### Data security

- Data is encrypted in transit: **Yes** (HTTPS/TLS)
- Data is encrypted at rest: **Yes** (Supabase encrypted storage)
- You can request deletion: **Yes** (delete account in Settings)
- This app follows Google Play's Families policy: **No**

---

## Step 6: App Content Declarations

Navigate to **Policy > App content**:

- **Ads:** Does the app show ads? **No**
- **Target audience:** Age group - **13 and up** (do NOT select "Up to 12" - this triggers COPPA requirements)
- **News app:** No
- **COVID-19 contact tracing:** No

---

## Step 7: In-app Purchases

Navigate to **Monetise > Products > In-app products** (if needed):

The Stripe payment is handled outside Google Play (via a web checkout). However, Google Play's policy requires that in-app purchases for digital goods use Google Play Billing. 

**Action required - important:**
- The current Stripe web checkout approach may violate Google Play's payment policy for "digital goods"
- Options:
  1. Implement Google Play Billing (requires significant code changes)
  2. Keep the app free and show a web link to subscribe (acceptable if the app is free on Play Store)
  3. Submit as a "tool that requires a subscription managed on the web" — grey area
- **Recommended:** For the initial submission, mark the app as free, remove or disable the in-app purchase flow for the Play Store build, and rely on web signups at `clearpass-app.vercel.app`. You can add Play Billing later.

---

## Step 8: Upload the AAB

Navigate to **Release > Testing > Internal testing** first:

1. Click **Create new release**
2. Upload your `.aab` file
3. Add release notes: (copy WHAT'S NEW from app-store-metadata.md)
4. Click **Save** then **Review release**

Test internally with up to 100 testers before promoting to production.

---

## Step 9: Promote to Production

After internal testing passes:

1. Navigate to **Release > Production**
2. Click **Create new release**
3. Select the AAB you tested
4. Set **Rollout percentage** to 20% initially
5. Submit for review

Google review typically takes 1-3 business days for a new app.

---

## Step 10: Post-launch

- [ ] Set up Crashlytics or Sentry for error monitoring
- [ ] Monitor Play Console reviews and ratings
- [ ] Set up the weekly cron job for parent emails (cron-job.org or Vercel Cron calling `/api/send-weekly-parent-emails`)
- [ ] Apply the instructor free-Pro schema block (`instructor_since` column + `instructor_pro_quarters` table) to Supabase via the SQL Editor — see `apps/mobile/supabase/schema.sql`
- [ ] Set up the daily instructor Pro review cron (cron-job.org, `POST /api/cron/instructor-pro-review`, `x-cron-secret` header, e.g. 02:00 Europe/London)
- [ ] Verify Stripe webhook is receiving events in production
- [ ] Set `RESEND_FROM_EMAIL` to verified domain once Resend DNS is confirmed

---

## EAS build profile reference

Make sure `eas.json` exists in `apps/mobile/` with at minimum:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## Package name confirmation

- Android package: `co.uk.getclearpass.app` (confirmed in `app.json`)
- iOS bundle ID: `co.uk.getclearpass.app` (same — confirmed in `app.json`)
