export interface ScoringBand {
  points: number;
  startSec: number;
  endSec: number;
}

export interface HazardWindow {
  startSec: number;
  endSec: number;
  // DVSA-style explicit bands (5 → 1 pts). When present, used instead of simplified thirds scoring.
  bands?: ScoringBand[];
}

export interface HazardClip {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  youtubeId?: string;
  durationSec: number;
  hazards: HazardWindow[];
}

export interface HazardResult {
  /** Final awarded points for this one hazard — 0 if missed or zeroed. */
  points: number;
  /**
   * The earliest qualifying in-window tap's timestamp, or null if no tap
   * landed in this hazard's window. Set even when `zeroed` is true, so a
   * reviewer can still see which tap *would* have scored.
   */
  scoringTap: number | null;
  /**
   * True when a qualifying tap existed (scoringTap !== null) but the
   * clip-wide excessive-clicking rule zeroed the whole clip's score —
   * distinct from simply never having tapped this hazard at all.
   */
  zeroed: boolean;
}

export interface HazardClipResult {
  clipId: string;
  clicks: number[];
  score: number;
  maxScore: number;
  /** Taps that landed inside a scoring window and so actually counted toward the score. */
  countedTaps: number;
  /**
   * False when the clip has any hazard authored without bands. Such a clip
   * fails closed — it isn't scored at all (score/maxScore both 0) rather
   * than falling back to an approximate thirds model that can only ever
   * return 5, 4, or 3 points, never 2 or 1.
   */
  scorable: boolean;
  /** Per-hazard breakdown, parallel to the clip's `hazards` array. Empty when !scorable. */
  hazards: HazardResult[];
}

export interface HazardSessionResult {
  date: string;
  score: number;
  maxScore: number;
  passed: boolean;
  clipId?: string;
}
