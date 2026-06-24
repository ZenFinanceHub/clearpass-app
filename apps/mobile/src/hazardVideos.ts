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

interface CatalogueEntry {
  scoring_method: 'time' | 'frame';
  has_solution_clip: boolean;
  solution_start_s: number | null;
  scoring_windows: DbHazardWindow[];
}

// Static scoring catalogue keyed by storage_path — avoids needing schema migration.
// Generated from DVSA scoring documents; update when new clips arrive.
const SCORING_CATALOGUE: Record<string, CatalogueEntry> = {
  'clips-1-10/clip-01.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:18.19,end_s:19.18},{points:4,start_s:19.19,end_s:20.18},{points:3,start_s:20.19,end_s:21.18},{points:2,start_s:21.19,end_s:22.18},{points:1,start_s:22.19,end_s:23.18}]}] },
  'clips-1-10/clip-02.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:32.06,end_s:33.00},{points:4,start_s:33.01,end_s:33.95},{points:3,start_s:33.96,end_s:34.90},{points:2,start_s:34.91,end_s:35.85},{points:1,start_s:35.86,end_s:36.80}]}] },
  'clips-1-10/clip-03.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:28.13,end_s:29.07},{points:4,start_s:29.08,end_s:30.02},{points:3,start_s:30.03,end_s:30.97},{points:2,start_s:30.98,end_s:31.92},{points:1,start_s:31.93,end_s:32.87}]}] },
  'clips-1-10/clip-04.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:31.24,end_s:32.23},{points:4,start_s:32.24,end_s:33.23},{points:3,start_s:33.24,end_s:34.23},{points:2,start_s:34.24,end_s:35.23},{points:1,start_s:35.24,end_s:36.23}]}] },
  'clips-1-10/clip-05.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:32.09,end_s:33.23},{points:4,start_s:33.24,end_s:34.38},{points:3,start_s:34.39,end_s:35.53},{points:2,start_s:35.54,end_s:36.68},{points:1,start_s:36.60,end_s:37.83}]}] },
  'clips-1-10/clip-06.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:14.18,end_s:16.22},{points:4,start_s:16.23,end_s:18.27},{points:3,start_s:18.28,end_s:20.32},{points:2,start_s:20.33,end_s:22.37},{points:1,start_s:22.38,end_s:24.42}]}] },
  'clips-1-10/clip-07.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:44.02,end_s:45.13},{points:4,start_s:45.14,end_s:46.25},{points:3,start_s:46.26,end_s:47.37},{points:2,start_s:47.38,end_s:48.49},{points:1,start_s:48.50,end_s:49.61}]}] },
  'clips-1-10/clip-08.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:30.00,end_s:31.24},{points:4,start_s:31.25,end_s:32.49},{points:3,start_s:32.50,end_s:33.74},{points:2,start_s:33.75,end_s:34.99},{points:1,start_s:35.00,end_s:36.24}]}] },
  'clips-1-10/clip-09.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:34.20,end_s:35.15},{points:4,start_s:35.16,end_s:36.11},{points:3,start_s:36.12,end_s:37.07},{points:2,start_s:37.08,end_s:38.03},{points:1,start_s:38.04,end_s:38.59}]}] },
  'clips-1-10/clip-10.mp4': { scoring_method:'time', has_solution_clip:true, solution_start_s:60, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:15.00,end_s:16.09},{points:4,start_s:16.10,end_s:17.19},{points:3,start_s:17.20,end_s:18.29},{points:2,start_s:18.30,end_s:19.39},{points:1,start_s:19.40,end_s:20.49}]}] },
  'clips-11-20/CG1001.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:2.80,end_s:5.00},{points:4,start_s:5.04,end_s:7.24},{points:3,start_s:7.28,end_s:9.48},{points:2,start_s:9.52,end_s:11.72},{points:1,start_s:11.76,end_s:14.00}]}] },
  'clips-11-20/CG1004.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:30.00,end_s:31.28},{points:4,start_s:31.32,end_s:32.60},{points:3,start_s:32.64,end_s:33.92},{points:2,start_s:33.96,end_s:35.24},{points:1,start_s:35.28,end_s:36.60}]}] },
  'clips-11-20/CG1006.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:31.40,end_s:32.52},{points:4,start_s:32.56,end_s:33.68},{points:3,start_s:33.72,end_s:34.84},{points:2,start_s:34.88,end_s:36.00},{points:1,start_s:36.04,end_s:37.20}]}] },
  'clips-11-20/CG1401.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:29.00,end_s:29.76},{points:4,start_s:29.80,end_s:30.56},{points:3,start_s:30.60,end_s:31.36},{points:2,start_s:31.40,end_s:32.16},{points:1,start_s:32.20,end_s:33.00}]}] },
  'clips-11-20/CG1404.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:37.60,end_s:38.20},{points:4,start_s:38.24,end_s:38.84},{points:3,start_s:38.88,end_s:39.48},{points:2,start_s:39.52,end_s:40.12},{points:1,start_s:40.16,end_s:40.80}]}] },
  'clips-11-20/CG1450.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:48.40,end_s:49.48},{points:4,start_s:49.52,end_s:50.60},{points:3,start_s:50.64,end_s:51.72},{points:2,start_s:51.76,end_s:52.84},{points:1,start_s:52.88,end_s:54.00}]}] },
  'clips-11-20/CG1750.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:30.80,end_s:31.80},{points:4,start_s:31.84,end_s:32.84},{points:3,start_s:32.88,end_s:33.88},{points:2,start_s:33.92,end_s:34.92},{points:1,start_s:34.96,end_s:36.00}]}] },
  'clips-11-20/CG1800.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:31.80,end_s:33.32},{points:4,start_s:33.36,end_s:34.88},{points:3,start_s:34.92,end_s:36.44},{points:2,start_s:36.48,end_s:38.00},{points:1,start_s:38.04,end_s:39.60}]}] },
  'clips-11-20/CG1851.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:7.20,end_s:8.04},{points:4,start_s:8.08,end_s:8.92},{points:3,start_s:8.96,end_s:9.80},{points:2,start_s:9.84,end_s:10.68},{points:1,start_s:10.72,end_s:11.60}]}] },
  'clips-11-20/CG1901.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:14.00,end_s:15.16},{points:4,start_s:15.20,end_s:16.36},{points:3,start_s:16.40,end_s:17.56},{points:2,start_s:17.60,end_s:18.76},{points:1,start_s:18.80,end_s:20.00}]}] },
  'clips-14-additional/HP135.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:40.20,end_s:41.20},{points:4,start_s:41.24,end_s:42.24},{points:3,start_s:42.28,end_s:43.28},{points:2,start_s:43.32,end_s:44.32},{points:1,start_s:44.36,end_s:45.40}]}] },
  'clips-14-additional/HP165.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:22.40,end_s:24.24},{points:4,start_s:24.28,end_s:26.08},{points:3,start_s:26.12,end_s:27.92},{points:2,start_s:27.96,end_s:29.76},{points:1,start_s:29.80,end_s:31.60}]}] },
  'clips-14-additional/HP188.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:21.40,end_s:22.20},{points:4,start_s:22.24,end_s:23.00},{points:3,start_s:23.04,end_s:23.80},{points:2,start_s:23.84,end_s:24.60},{points:1,start_s:24.64,end_s:25.40}]}] },
  'clips-14-additional/HP258.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:16.60,end_s:17.96},{points:4,start_s:18.00,end_s:19.32},{points:3,start_s:19.36,end_s:20.68},{points:2,start_s:20.72,end_s:22.04},{points:1,start_s:22.08,end_s:23.40}]}] },
  'clips-14-additional/HP474.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:17.80,end_s:18.92},{points:4,start_s:18.96,end_s:20.04},{points:3,start_s:20.08,end_s:21.16},{points:2,start_s:21.20,end_s:22.28},{points:1,start_s:22.32,end_s:23.40}]}] },
  'clips-14-additional/HP630.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:30.40,end_s:31.20},{points:4,start_s:31.24,end_s:32.00},{points:3,start_s:32.04,end_s:32.80},{points:2,start_s:32.84,end_s:33.60},{points:1,start_s:33.64,end_s:34.40}]}] },
  'clips-14-additional/HP635.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:15.60,end_s:16.40},{points:4,start_s:16.44,end_s:17.20},{points:3,start_s:17.24,end_s:18.00},{points:2,start_s:18.04,end_s:18.80},{points:1,start_s:18.84,end_s:19.60}]}] },
  'clips-14-additional/HP700.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:33.40,end_s:34.04},{points:4,start_s:34.08,end_s:34.68},{points:3,start_s:34.72,end_s:35.32},{points:2,start_s:35.36,end_s:35.96},{points:1,start_s:36.00,end_s:36.60}]}] },
  'clips-14-additional/HP702.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:25.20,end_s:26.08},{points:4,start_s:26.12,end_s:26.96},{points:3,start_s:27.00,end_s:27.84},{points:2,start_s:27.88,end_s:28.72},{points:1,start_s:28.76,end_s:29.60}]}] },
  'clips-14-additional/HP717.mp4':  { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:31.40,end_s:32.08},{points:4,start_s:32.12,end_s:32.76},{points:3,start_s:32.80,end_s:33.44},{points:2,start_s:33.48,end_s:34.12},{points:1,start_s:34.16,end_s:34.80}]}] },
  'clips-14-additional/HP2006.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:17.00,end_s:17.96},{points:4,start_s:18.00,end_s:18.96},{points:3,start_s:19.00,end_s:19.96},{points:2,start_s:20.00,end_s:20.96},{points:1,start_s:21.00,end_s:22.00}]}] },
  'clips-14-additional/HP2012.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:24.00,end_s:24.76},{points:4,start_s:24.80,end_s:25.56},{points:3,start_s:25.60,end_s:26.36},{points:2,start_s:26.40,end_s:27.16},{points:1,start_s:27.20,end_s:28.00}]}] },
  'clips-14-additional/HP2038.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:32.68,end_s:33.60},{points:4,start_s:33.64,end_s:34.56},{points:3,start_s:34.60,end_s:35.52},{points:2,start_s:35.56,end_s:36.48},{points:1,start_s:36.52,end_s:37.48}]}] },
  'clips-14-additional/HP2057.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:25.68,end_s:26.60},{points:4,start_s:26.64,end_s:27.56},{points:3,start_s:27.60,end_s:28.52},{points:2,start_s:28.56,end_s:29.48},{points:1,start_s:29.52,end_s:30.48}]}] },
  'bonus-2/HPT3000.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:31.60,end_s:32.44},{points:4,start_s:32.44,end_s:33.28},{points:3,start_s:33.28,end_s:34.16},{points:2,start_s:34.16,end_s:35.00},{points:1,start_s:35.00,end_s:35.84}]}] },
  'bonus-2/HPT3008.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[
    {hazard_number:1,bands:[{points:5,start_s:7.20,end_s:7.88},{points:4,start_s:7.88,end_s:8.56},{points:3,start_s:8.56,end_s:9.28},{points:2,start_s:9.28,end_s:9.96},{points:1,start_s:9.96,end_s:10.60}]},
    {hazard_number:2,bands:[{points:5,start_s:20.96,end_s:21.40},{points:4,start_s:21.40,end_s:21.84},{points:3,start_s:21.84,end_s:22.32},{points:2,start_s:22.32,end_s:22.76},{points:1,start_s:22.76,end_s:23.16}]},
  ] },
  'parallel-2/5013.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:38.08,end_s:39.04},{points:4,start_s:39.04,end_s:40.00},{points:3,start_s:40.00,end_s:40.96},{points:2,start_s:40.96,end_s:41.92},{points:1,start_s:41.92,end_s:42.92}]}] },
  'parallel-2/5010.mp4': { scoring_method:'frame', has_solution_clip:false, solution_start_s:null, scoring_windows:[{hazard_number:1,bands:[{points:5,start_s:41.12,end_s:41.76},{points:4,start_s:41.76,end_s:42.40},{points:3,start_s:42.40,end_s:43.04},{points:2,start_s:43.04,end_s:43.68},{points:1,start_s:43.68,end_s:44.32}]}] },
};

const DEFAULT_ENTRY: CatalogueEntry = {
  scoring_method: 'frame',
  has_solution_clip: false,
  solution_start_s: null,
  scoring_windows: [],
};

type DbRow = {
  id: string;
  title: string;
  duration_seconds: number;
  storage_path: string;
  thumbnail_path: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
};

export async function getHazardVideoList(): Promise<HazardClipMeta[]> {
  try {
    const { data } = await supabase
      .from('hazard_clips')
      .select('id, title, duration_seconds, storage_path, thumbnail_path, difficulty, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    return ((data as DbRow[] | null) ?? []).map((row) => {
      const cat = SCORING_CATALOGUE[row.storage_path] ?? DEFAULT_ENTRY;
      return { ...row, ...cat };
    });
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
