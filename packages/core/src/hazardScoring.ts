import { HazardClip, HazardClipResult, HazardWindow } from './types/HazardClip';

function scoreWindow(clicks: number[], window: HazardWindow): number {
  const windowClicks = clicks.filter((t) => t >= window.startSec && t <= window.endSec);
  if (windowClicks.length === 0) return 0;

  // Anti-cheat: 8+ clicks in any 1-second interval = score 0
  const bySecond = new Map<number, number>();
  for (const t of clicks) {
    const sec = Math.floor(t);
    bySecond.set(sec, (bySecond.get(sec) ?? 0) + 1);
  }
  if (Math.max(...bySecond.values()) >= 8) return 0;

  // Score based on position of first valid click within the window
  const first = windowClicks[0];
  const range = window.endSec - window.startSec;
  const pos = (first - window.startSec) / range;

  if (pos < 1 / 3) return 5;
  if (pos < 2 / 3) return 4;
  return 3;
}

export function scoreClip(clip: HazardClip, clicks: number[]): HazardClipResult {
  let score = 0;
  for (const hazard of clip.hazards) {
    score += scoreWindow(clicks, hazard);
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
  // Mirror real-test passmark ratio: 44/75 ≈ 58.7%
  const passed = maxScore > 0 && score / maxScore >= 44 / 75;
  return { score, maxScore, passed };
}
