// profiles.username is a free-text field an instructor can edit from the
// mobile app's Settings screen (apps/mobile/app/(tabs)/settings.tsx) with no
// format validation beyond "not empty" — the same field learners use, with
// no separate "business name" concept. In production today it holds things
// like "craig instructor" and "test2": placeholder-ish, but not something
// this check can catch. What it CAN catch, and must: empty, or a raw email
// address (nothing stops an instructor typing their email into that field).
// Showing either verbatim on a page a learner sees reads as broken or as a
// privacy leak, so both fall back to generic copy instead.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function presentableInstructorName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (EMAIL_SHAPE.test(trimmed)) return null;
  return trimmed;
}

// display_name (profiles.display_name) is what an instructor deliberately
// set on the dashboard specifically to be shown to learners — preferred
// whenever it passes the same presentability check as username below.
// username is the pre-existing fallback for instructors who haven't set
// one yet. Each step is checked independently: a present-but-email-shaped
// display_name still falls through to username, not straight to generic.
export function resolveInstructorDisplayName(
  displayName: string | null | undefined,
  username: string | null | undefined
): string | null {
  return presentableInstructorName(displayName) ?? presentableInstructorName(username);
}
