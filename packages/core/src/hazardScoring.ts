import { HazardClip, HazardClipResult, HazardWindow } from './types/HazardClip';

// Absorbs timing jitter (video currentTime staleness, touch-dispatch latency) at the
// moment a hazard's scoring window OPENS, so a genuinely correctly-timed tap isn't
// excluded for missing the boundary by a few milliseconds. No DVSA-documented jitter
// allowance was found for this repo (checked for "tolerance"/"margin"/"jitter" in
// project docs) — this is a conservative technical buffer, not a DVSA-specified value.
// Deliberately NOT applied to window.endSec: the closing edge must stay exact so this
// can't leak tolerance into reveal/solution footage or otherwise widen the window.
const WINDOW_OPEN_TOLERANCE_SEC = 0.08;

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
  // DVSA rule: repeated/multiple taps against the same developing hazard score zero for that hazard.
  if (windowClicks.length > 1) return 0;

  // A tap that landed in the tolerance zone just before the window's nominal start
  // is treated as if it landed exactly on the opening edge — absorbed as on-time
  // jitter, not scored as "early" against the bands/thirds below.
  const first = Math.max(windowClicks[0], window.startSec);

  if (window.bands && window.bands.length > 0) {
    // DVSA explicit bands: find which band contains the first qualifying click.
    // Bands are ordered 5→1; return the first match.
    const sorted = [...window.bands].sort((a, b) => b.points - a.points);
    for (const band of sorted) {
      if (first >= band.startSec && first <= band.endSec) return band.points;
    }
    return 0;
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
  // DVSA passmark: 44 out of 75 (≈58.7%)
  const passed = maxScore > 0 && score / maxScore >= 44 / 75;
  return { score, maxScore, passed };
}
