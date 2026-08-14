import { HazardClip, HazardWindow, ScoringBand } from '../types/HazardClip';

// Real production band data (seconds). Source: production Supabase
// `hazard_clips.scoring_windows`, supplied 2026-08-13. Shared between
// hazardScoring.test.ts and hazardTimeline.test.ts so both exercise the
// exact same real-world data rather than two copies that could drift.

export const CGI1_HAZARD1_BANDS: ScoringBand[] = [
  { points: 5, startSec: 18.19, endSec: 19.18 },
  { points: 4, startSec: 19.19, endSec: 20.18 },
  { points: 3, startSec: 20.19, endSec: 21.18 },
  { points: 2, startSec: 21.19, endSec: 22.18 },
  { points: 1, startSec: 22.19, endSec: 23.18 },
];

export const BRIDGE_HAZARD1_BANDS: ScoringBand[] = [
  { points: 5, startSec: 7.20, endSec: 7.88 },
  { points: 4, startSec: 7.88, endSec: 8.56 },
  { points: 3, startSec: 8.56, endSec: 9.28 },
  { points: 2, startSec: 9.28, endSec: 9.96 },
  { points: 1, startSec: 9.96, endSec: 10.60 },
];

export const BRIDGE_HAZARD2_BANDS: ScoringBand[] = [
  { points: 5, startSec: 20.96, endSec: 21.40 },
  { points: 4, startSec: 21.40, endSec: 21.84 },
  { points: 3, startSec: 21.84, endSec: 22.32 },
  { points: 2, startSec: 22.32, endSec: 22.76 },
  { points: 1, startSec: 22.76, endSec: 23.16 },
];

// Mirrors apps/mobile/src/hazardVideos.ts:buildHazardClip — window bounds are
// the min band start / max band end, exactly as production derives them.
export function windowFromBands(bands: ScoringBand[]): HazardWindow {
  const sorted = [...bands].sort((a, b) => a.startSec - b.startSec);
  return { startSec: sorted[0].startSec, endSec: sorted[sorted.length - 1].endSec, bands };
}

export function makeClip(id: string, hazards: HazardWindow[]): HazardClip {
  return { id, title: id, description: '', videoUrl: '', durationSec: 60, hazards };
}

export const CGI1_WINDOW = windowFromBands(CGI1_HAZARD1_BANDS);
export const CGI1_CLIP = makeClip('cgi-clip-1', [CGI1_WINDOW]);

export const BRIDGE_H1_WINDOW = windowFromBands(BRIDGE_HAZARD1_BANDS);
export const BRIDGE_H2_WINDOW = windowFromBands(BRIDGE_HAZARD2_BANDS);
export const BRIDGE_CLIP = makeClip('priority-bridge-cyclist', [BRIDGE_H1_WINDOW, BRIDGE_H2_WINDOW]);
export const BRIDGE_H1_ONLY_CLIP = makeClip('priority-bridge-cyclist-h1-only', [BRIDGE_H1_WINDOW]);
