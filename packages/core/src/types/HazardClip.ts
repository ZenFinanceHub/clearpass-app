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
}

export interface HazardSessionResult {
  date: string;
  score: number;
  maxScore: number;
  passed: boolean;
  clipId?: string;
}
