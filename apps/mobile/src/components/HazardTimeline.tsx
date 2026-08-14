import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  computeHazardTimelineLayout,
  HazardResult,
  HazardTimelineLayout,
  HazardWindow,
} from '@clearpass/core';
import { useTheme } from '@/src/theme';

interface HazardTimelineProps {
  hazard: HazardWindow;
  /** The full clip's recorded taps (HazardClipResult.clicks) — filtered internally to this hazard. */
  clicks: number[];
  result: HazardResult;
}

// Local to this component — a 5-step "good to bad" scale distinct enough
// that band identity doesn't depend on colour alone (every segment also
// carries its numeral).
const BAND_COLORS: Record<number, string> = {
  5: '#10B981',
  4: '#65A30D',
  3: '#F5A623',
  2: '#EA580C',
  1: '#EF4444',
};

type Theme = ReturnType<typeof useTheme>;

function buildAccessibilityLabel(layout: HazardTimelineLayout, result: HazardResult): string {
  if (layout.noTapsAtAll) return "You didn't tap during this hazard.";

  const earlyCount = layout.taps.filter((t) => t.kind === 'too-early').length;
  const lateCount = layout.taps.filter((t) => t.kind === 'too-late').length;

  const parts: string[] = [];
  if (result.scoringTap !== null) {
    parts.push(
      result.zeroed
        ? `You tapped at a scoring moment, but it was zeroed for excessive tapping elsewhere in this clip.`
        : `You scored ${result.points} point${result.points === 1 ? '' : 's'}.`,
    );
  } else {
    parts.push('You did not tap within the scoring window for this hazard.');
  }
  if (earlyCount > 0) parts.push(`${earlyCount} tap${earlyCount > 1 ? 's' : ''} too early.`);
  if (lateCount > 0) parts.push(`${lateCount} tap${lateCount > 1 ? 's' : ''} too late.`);
  return parts.join(' ');
}

function BandsRow({ layout, theme }: { layout: HazardTimelineLayout; theme: Theme }) {
  if (layout.segments.length === 0) return null;
  const first = layout.segments[0];
  const last = layout.segments[layout.segments.length - 1];
  const leadingPct = Math.max(0, first.startPct);
  const trailingPct = Math.max(0, 100 - (last.startPct + last.widthPct));

  return (
    <View style={styles.bandsRow}>
      {leadingPct > 0 && <View style={[styles.paddingSeg, { width: `${leadingPct}%` }]} />}
      {layout.segments.map((seg) => (
        <View
          key={seg.points}
          style={[
            styles.bandSeg,
            {
              width: `${seg.widthPct}%`,
              backgroundColor: BAND_COLORS[seg.points],
              borderRightWidth: theme.highContrast ? 2 : 0.5,
              borderRightColor: theme.highContrast ? '#000000' : 'rgba(255,255,255,0.6)',
            },
          ]}
        >
          <Text style={styles.bandNumeral} numberOfLines={1}>{seg.points}</Text>
        </View>
      ))}
      {trailingPct > 0 && <View style={[styles.paddingSeg, { width: `${trailingPct}%` }]} />}
    </View>
  );
}

export function HazardTimeline({ hazard, clicks, result }: HazardTimelineProps) {
  const theme = useTheme();

  // scoreClip only reaches HazardTimeline via a scorable clip result, which
  // guarantees bands — this is a defensive no-op, not an expected path.
  if (!hazard.bands || hazard.bands.length === 0) return null;

  const layout = computeHazardTimelineLayout(hazard, clicks, result.scoringTap, result.zeroed);
  const tooEarly = layout.taps.filter((t) => t.kind === 'too-early');
  const tooLate = layout.taps.filter((t) => t.kind === 'too-late');
  const inRange = layout.taps.filter((t) => t.kind === 'in-range');

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={buildAccessibilityLabel(layout, result)}
    >
      <View style={styles.barWrap}>
        <BandsRow layout={layout} theme={theme} />
        {inRange.map((t, i) => {
          if (t.kind !== 'in-range') return null;
          const { marker } = t;
          return (
            <View
              key={i}
              style={[
                styles.marker,
                { left: `${marker.positionPct}%` },
                marker.isScoringTap ? styles.markerScoring : styles.markerOther,
              ]}
            >
              <Text style={styles.markerGlyph}>{marker.isScoringTap ? '✓' : '•'}</Text>
            </View>
          );
        })}
      </View>

      {layout.noTapsAtAll && (
        <Text style={[styles.stateText, { fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {"You didn't tap during this hazard"}
        </Text>
      )}
      {tooEarly.length > 0 && (
        <Text style={[styles.stateText, { fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {tooEarly.length === 1 ? 'You tapped too early' : `You tapped too early (${tooEarly.length}×)`}
        </Text>
      )}
      {tooLate.length > 0 && (
        <Text style={[styles.stateText, { fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {tooLate.length === 1 ? 'You tapped too late' : `You tapped too late (${tooLate.length}×)`}
        </Text>
      )}
      {result.zeroed && (
        <Text style={[styles.stateText, styles.zeroedText, { fontFamily: theme.fontFamily }]}>
          {'Zeroed — too many taps this clip'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  barWrap: {
    height: 28,
    borderRadius: 6,
    overflow: 'visible',
  },
  bandsRow: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  paddingSeg: { backgroundColor: '#E5E7EB' },
  bandSeg: { alignItems: 'center', justifyContent: 'center' },
  bandNumeral: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  marker: {
    position: 'absolute',
    top: -2,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerScoring: { backgroundColor: '#111827' },
  markerOther: { backgroundColor: '#9CA3AF' },
  markerGlyph: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  stateText: { fontSize: 12, fontWeight: '600' },
  zeroedText: { color: '#EF4444' },
});
