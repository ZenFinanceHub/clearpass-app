/**
 * Position maths for the draggable Ask Pip button. Pure, so it can be tested
 * with plain Node.
 *
 * The button snaps to the nearer side of the screen when let go, and its
 * height is stored as a fraction of the free space, not in pixels, so it lands
 * in a sensible place after a rotation, a different phone or a resized window.
 */

export const FAB_SIZE = 52;
export const FAB_EDGE = 16;

export type FabBounds = { width: number; minY: number; maxY: number };
export type FabSide = 'left' | 'right';
export type StoredFabPos = { side: FabSide; yRatio: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function xForSide(side: FabSide, b: FabBounds): number {
  return side === 'left' ? FAB_EDGE : Math.max(FAB_EDGE, b.width - FAB_SIZE - FAB_EDGE);
}

/** Where the button settles after being dropped with its top-left at (x, y). */
export function snapFab(x: number, y: number, b: FabBounds): { side: FabSide; x: number; y: number } {
  const side: FabSide = x + FAB_SIZE / 2 < b.width / 2 ? 'left' : 'right';
  return { side, x: xForSide(side, b), y: clamp(y, b.minY, Math.max(b.minY, b.maxY)) };
}

export function toStored(p: { side: FabSide; y: number }, b: FabBounds): StoredFabPos {
  const span = b.maxY - b.minY;
  return { side: p.side, yRatio: span > 0 ? clamp((p.y - b.minY) / span, 0, 1) : 0 };
}

export function fromStored(s: StoredFabPos, b: FabBounds): { x: number; y: number } {
  const span = Math.max(0, b.maxY - b.minY);
  return { x: xForSide(s.side, b), y: b.minY + clamp(s.yRatio, 0, 1) * span };
}

/** Accepts only a well-formed saved value; anything else means "use the default". */
export function parseStoredFabPos(raw: string | null): StoredFabPos | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredFabPos>;
    if ((v.side === 'left' || v.side === 'right') && typeof v.yRatio === 'number' && isFinite(v.yRatio)) {
      return { side: v.side, yRatio: clamp(v.yRatio, 0, 1) };
    }
  } catch {}
  return null;
}
