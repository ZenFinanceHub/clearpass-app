export interface HazardWindow {
  startSec: number;
  endSec: number;
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
}

export interface HazardSessionResult {
  date: string;
  score: number;
  maxScore: number;
  passed: boolean;
}
