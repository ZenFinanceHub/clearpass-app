import { HazardWindow } from './types/HazardClip';

// Bands occupy a few seconds of a 30-60s clip — a full-clip timeline would
// make them unreadable slivers. Zoom to the scoring window plus this much
// padding on each side, so near-miss taps (just before/after the window)
// still show in context instead of being invisible or jammed against an edge.
export const HAZARD_TIMELINE_PADDING_SEC = 2;

export interface TimelineBandSegment {
  points: number;
  /** Percent of the visible span (0-100) where this band starts. */
  startPct: number;
  /** Percent of the visible span (0-100) this band occupies. */
  widthPct: number;
}

export interface TimelineTapMarker {
  tap: number;
  /** Percent of the visible span (0-100) where this tap falls. */
  positionPct: number;
  isScoringTap: boolean;
  /** False if the tap is within the visible (padded) range but outside every band. */
  inBand: boolean;
}

export type TimelineTapClassification =
  | { kind: 'in-range'; marker: TimelineTapMarker }
  | { kind: 'too-early'; tap: number }
  | { kind: 'too-late'; tap: number };

export interface HazardTimelineLayout {
  visibleStart: number;
  visibleEnd: number;
  paddingSec: number;
  /** Proportionally-sized band segments, 5→1, sorted by position. */
  segments: TimelineBandSegment[];
  /** Every tap in `clicks`, classified against this hazard's visible range. */
  taps: TimelineTapClassification[];
  noTapsAtAll: boolean;
  scoringTap: number | null;
  zeroed: boolean;
}

/**
 * Pure geometry for one hazard's review timeline — no rendering, no units
 * beyond percentages. `clicks` is the FULL clip's tap list (from
 * HazardClipResult.clicks); this classifies each one relative to this single
 * hazard's own padded window, so calling it once per hazard on a
 * multi-hazard clip naturally gives each hazard its own independently-scaled
 * timeline (see Priority Bridge — its two hazards are ~13s apart, so a
 * shared bar spanning both would crush each one's bands unreadably).
 */
export function computeHazardTimelineLayout(
  hazard: HazardWindow,
  clicks: number[],
  scoringTap: number | null,
  zeroed: boolean,
): HazardTimelineLayout {
  const sortedBands = [...(hazard.bands ?? [])].sort((a, b) => a.startSec - b.startSec);

  const visibleStart = hazard.startSec - HAZARD_TIMELINE_PADDING_SEC;
  const visibleEnd = hazard.endSec + HAZARD_TIMELINE_PADDING_SEC;
  const span = visibleEnd - visibleStart;

  const segments: TimelineBandSegment[] = sortedBands.map((band) => ({
    points: band.points,
    startPct: ((band.startSec - visibleStart) / span) * 100,
    widthPct: ((band.endSec - band.startSec) / span) * 100,
  }));

  const taps: TimelineTapClassification[] = clicks.map((tap): TimelineTapClassification => {
    if (tap < visibleStart) return { kind: 'too-early', tap };
    if (tap > visibleEnd) return { kind: 'too-late', tap };
    return {
      kind: 'in-range',
      marker: {
        tap,
        positionPct: ((tap - visibleStart) / span) * 100,
        isScoringTap: scoringTap !== null && tap === scoringTap,
        inBand: sortedBands.some((band) => tap >= band.startSec && tap <= band.endSec),
      },
    };
  });

  return {
    visibleStart,
    visibleEnd,
    paddingSec: HAZARD_TIMELINE_PADDING_SEC,
    segments,
    taps,
    noTapsAtAll: clicks.length === 0,
    scoringTap,
    zeroed,
  };
}

/**
 * Coaching copy for a hazard the learner missed entirely (no scoring tap —
 * the caller decides that by checking HazardResult.scoringTap === null
 * before calling this; it isn't re-derived here). Plain, encouraging
 * language for a nervous learner: what happened and what to try next time,
 * not a tally of failed taps.
 */
export function missedHazardMessage(noTapsAtAll: boolean, earlyCount: number, lateCount: number): string {
  if (noTapsAtAll) {
    return "You didn't tap for this one — that's okay, keep watching for the next hazard.";
  }
  if (earlyCount > 0 && lateCount === 0) {
    return 'You tapped a little too soon — try waiting just a moment longer before reacting.';
  }
  if (lateCount > 0 && earlyCount === 0) {
    return 'You tapped a little too late — try to spot the hazard developing a bit sooner.';
  }
  return "Your taps didn't quite line up with this hazard — it takes practice to get the timing right.";
}
