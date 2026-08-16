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
