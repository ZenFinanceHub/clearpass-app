# ClearPass 2.0 — Daily Coach

An improvement programme that turns ClearPass into a guided daily learning experience. It is not a rewrite.

| Doc | Purpose |
|---|---|
| [01-design-spec.md](01-design-spec.md) | Approved requirements vs recommendations, the WCAG-validated palette, and how mockup conflicts are resolved |
| [02-navigation-mapping.md](02-navigation-mapping.md) | Every existing route mapped to its place in the 5-tab structure, plus the external links that must keep working |
| [03-implementation-tracker.md](03-implementation-tracker.md) | Phases, PRs, estimates, release path per PR, dependencies, milestones, risks, staging/testing and analytics |
| [04-craig-actions.md](04-craig-actions.md) | Actions, decisions and PR #79/#19 recommendations; kept up to date throughout |
| [06-chrome-prompts.md](06-chrome-prompts.md) | Ready-to-paste Claude in Chrome prompts for the browser-only setup steps (C1 read-only check now; C2 staging Supabase after cost approval) |
| [05-setup-guide.md](05-setup-guide.md) | Step-by-step staging Supabase, Vercel, Railway, EAS, GitHub Actions, Stripe test mode and RevenueCat sandbox setup, with costs |

Inputs:
- Craig's brief (2026-11-25).
- Approved mockups (held outside the repo).
- The UI/UX audit pack (`/home/craig/clearpass-audit-pack/`, outside the repo; it contains synthetic screenshots and aggregate analytics only).

Precedence when sources disagree: written requirements > existing functionality and brand assets > mockups.
