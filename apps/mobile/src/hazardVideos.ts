import { HazardClip, HazardWindow, ScoringBand } from '@clearpass/core';
import { supabase } from './supabase';

export type HazardClipMeta = {
  id: string;
  title: string;
  duration_seconds: number;
  storage_path: string;
  thumbnail_path: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
  scoring_method: 'time' | 'frame';
  has_solution_clip: boolean;
  solution_start_s: number | null;
  scoring_windows: DbHazardWindow[];
};

interface DbScoringBand {
  points: number;
  start_s: number;
  end_s: number;
}

interface DbHazardWindow {
  hazard_number: number;
  bands: DbScoringBand[];
}

export async function getHazardVideoList(): Promise<HazardClipMeta[]> {
  try {
    const { data } = await supabase
      .from('hazard_clips')
      .select('id, title, duration_seconds, storage_path, thumbnail_path, difficulty, sort_order, scoring_method, has_solution_clip, solution_start_s, scoring_windows')
      .eq('is_active', true)
      .order('sort_order');
    return (data as HazardClipMeta[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function getVideoUrl(storagePath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from('hazard-videos')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

export async function getThumbUrl(thumbnailPath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from('hazard-videos')
      .createSignedUrl(thumbnailPath, 3600);
    return data?.signedUrl ?? null;
  } catch { return null; }
}

/** Convert a Supabase HazardClipMeta into a HazardClip suitable for the scoring engine. */
export function buildHazardClip(meta: HazardClipMeta, videoUrl: string): HazardClip {
  const hazards: HazardWindow[] = meta.scoring_windows.map((dbw) => {
    const bands: ScoringBand[] = dbw.bands.map((b) => ({
      points: b.points,
      startSec: b.start_s,
      endSec: b.end_s,
    }));
    const sorted = [...bands].sort((a, b) => a.startSec - b.startSec);
    return {
      startSec: sorted[0]?.startSec ?? 0,
      endSec: sorted[sorted.length - 1]?.endSec ?? 0,
      bands,
    };
  });

  return {
    id: meta.id,
    title: meta.title,
    description: '',
    videoUrl,
    durationSec: meta.duration_seconds,
    hazards,
  };
}
