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
}

export interface HazardSessionResult {
  date: string;
  score: number;
  maxScore: number;
  passed: boolean;
  clipId?: string;
}
