import { HazardClip, HazardClipResult, HazardWindow } from './types/HazardClip';

// Absorbs timing jitter (video currentTime staleness, touch-dispatch latency) at the
// moment a hazard's scoring window OPENS, so a genuinely correctly-timed tap isn't
// excluded for missing the boundary by a few milliseconds. No DVSA-documented jitter
// allowance was found for this repo (checked for "tolerance"/"margin"/"jitter" in
// project docs) — this is a conservative technical buffer, not a DVSA-specified value.
// Deliberately NOT applied to window.endSec: the closing edge must stay exact so this
// can't leak tolerance into reveal/solution footage or otherwise widen the window.
const WINDOW_OPEN_TOLERANCE_SEC = 0.08;

// DVSA passmark: 44 out of a 75-point full session. Exported as a ratio, not
// a literal "44/75", so every place that displays a pass threshold (which
// may be for a partial/single-clip session, not the full 75) derives it from
// the same single source of truth instead of re-hardcoding the fraction.
export const DVSA_HAZARD_PASS_RATIO = 44 / 75;

function isInWindow(t: number, window: HazardWindow): boolean {
  return t >= window.startSec - WINDOW_OPEN_TOLERANCE_SEC && t <= window.endSec;
}

function detectAntiCheat(clicks: number[]): boolean {
  if (clicks.length === 0) return false;
  // 8+ clicks in any 1-second bucket = random button-bashing
  const bySecond = new Map<number, number>();
  for (const t of clicks) {
    const sec = Math.floor(t);
    bySecond.set(sec, (bySecond.get(sec) ?? 0) + 1);
  }
  return Math.max(...bySecond.values()) >= 8;
}

function scoreWindow(clicks: number[], window: HazardWindow): number {
  const windowClicks = clicks.filter((t) => isInWindow(t, window));
  if (windowClicks.length === 0) return 0;

  // The EARLIEST qualifying tap scores. A learner may legitimately tap once
  // on spotting a hazard and again as it develops — a later, additional tap
  // in the same window no longer zeroes the hazard; only the clip-wide
  // excessive-clicking rule (detectAntiCheat, in scoreClip) still zeroes for
  // spam-tapping. `windowClicks` preserves the original clicks[] order, not
  // necessarily chronological order, so take the minimum explicitly.
  const earliest = Math.min(...windowClicks);

  // A tap that landed in the tolerance zone just before the window's nominal start
  // is treated as if it landed exactly on the opening edge — absorbed as on-time
  // jitter, not scored as "early" against the bands/thirds below.
  const first = Math.max(earliest, window.startSec);

  if (window.bands && window.bands.length > 0) {
    // DVSA explicit bands: prefer an exact match first (both edges inclusive).
    // Bands are ordered 5→1 by points, so a tap landing exactly on a shared,
    // touching boundary between two bands (a real tie in some clips' data)
    // resolves to the higher-point band, since it's checked first.
    const byPoints = [...window.bands].sort((a, b) => b.points - a.points);
    for (const band of byPoints) {
      if (first >= band.startSec && first <= band.endSec) return band.points;
    }
    // No band's own range contains the tap — a genuine inter-band gap (e.g. a
    // real 0.01s/0.04s authoring hole between adjacent bands, distinct from
    // the touching-boundary case above). Credit the band that most recently
    // opened: the one with the greatest startSec still <= the tap. Fixed in
    // code, not data — the bands themselves are untouched.
    const byStartDesc = [...window.bands].sort((a, b) => b.startSec - a.startSec);
    const opened = byStartDesc.find((band) => band.startSec <= first);
    return opened ? opened.points : 0;
  }

  // Fallback: divide window into thirds (5/4/3 pts) for non-DVSA clips.
  const range = window.endSec - window.startSec;
  const pos = (first - window.startSec) / range;
  if (pos < 1 / 3) return 5;
  if (pos < 2 / 3) return 4;
  return 3;
}

export function scoreClip(clip: HazardClip, clicks: number[]): HazardClipResult {
  const cheating = detectAntiCheat(clicks);
  let score = 0;
  if (!cheating) {
    for (const hazard of clip.hazards) {
      score += scoreWindow(clicks, hazard);
    }
  }
  // Taps that actually fell inside a scoring window — i.e. the ones that counted
  // toward (or zeroed) a hazard's score, as opposed to every tap made anywhere in
  // the clip (which also includes taps outside any window, before it opens etc).
  const countedTaps = clicks.filter((t) =>
    clip.hazards.some((h) => isInWindow(t, h)),
  ).length;
  return {
    clipId: clip.id,
    clicks,
    score,
    maxScore: clip.hazards.length * 5,
    countedTaps,
  };
}

export function calculateHazardTotal(
  results: HazardClipResult[],
): { score: number; maxScore: number; passed: boolean } {
  const score = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.reduce((sum, r) => sum + r.maxScore, 0);
  const passed = maxScore > 0 && score / maxScore >= DVSA_HAZARD_PASS_RATIO;
  return { score, maxScore, passed };
}
