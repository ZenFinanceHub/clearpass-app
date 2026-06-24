import { HazardClip, HazardClipResult, HazardWindow } from './types/HazardClip';

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
  const windowClicks = clicks.filter((t) => t >= window.startSec && t <= window.endSec);
  if (windowClicks.length === 0) return 0;

  const first = windowClicks[0];

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
  return {
    clipId: clip.id,
    clicks,
    score,
    maxScore: clip.hazards.length * 5,
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
