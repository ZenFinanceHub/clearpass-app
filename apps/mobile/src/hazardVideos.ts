import { supabase } from './supabase';

export type HazardClipMeta = {
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
