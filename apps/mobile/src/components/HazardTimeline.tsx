import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  computeHazardTimelineLayout,
  HazardResult,
  HazardTimelineLayout,
  HazardWindow,
} from '@clearpass/core';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

interface HazardTimelineProps {
  hazard: HazardWindow;
  /** The full clip's recorded taps (HazardClipResult.clicks) — filtered internally to this hazard. */
  clicks: number[];
  result: HazardResult;
}

// Single-hue ramp on the brand indigo, darkest/most saturated at 5 down to
// lightest at 1 — deliberately NOT a green→red "good→bad" scale. Every band
// is a pass (1 point still means the hazard was correctly spotted, just
// later); red specifically implies failure, which is the wrong lesson.
// A single-hue lightness ramp also stays monotonically distinguishable in
// greyscale, unlike red/amber/green which can collapse to similar
// luminance. Reuses two existing theme tokens at the endpoints —
// Colors.indigo (band 5) and Colors.indigoBg (band 1) — the app has no
// pre-built 5-step ramp between them, so bands 3/2 are linear RGB
// interpolations between those same two tokens (50/75%), not new arbitrary
// hex values. Band 4 is NOT the even 25% interpolation (#776FEB) — that
// value only gave white numerals a 3.99:1 contrast ratio (fails WCAG AA's
// 4.5:1; the numeral is 10px, well under the large-text threshold where
// 3:1 would apply). #6B63EA (~18% toward indigoBg) is the lightest point
// on the same ramp line where white text still clears 4.5:1 (4.57:1) —
// chosen over enlarging the numeral because bands can be as narrow as
// ~0.4s within a ~6s padded span (Priority Bridge hazard 2), and a
// large-text-sized numeral risked not fitting inside that width at all.
// This does compress band 4 slightly closer to band 5 visually — a minor,
// accepted trade-off against actually failing contrast.
const BAND_COLORS: Record<number, string> = {
  5: Colors.indigo,   // #4F46E5 — existing token
  4: '#6B63EA',       // ~18% toward indigoBg — darkened from the even 25% step for contrast
  3: '#9E98F2',       // 50% toward indigoBg
  2: '#C6C0F8',       // 75% toward indigoBg
  1: Colors.indigoBg, // #EDE9FE — existing token
};

// Lighter bands (3/2/1) are too light for white numerals to read against.
// Colors.indigo text measured 5.30:1 on band 1 (passes WCAG AA 4.5:1) but
// only 3.68:1 on band 2 and 2.47:1 on band 3 (both fail) — see the
// contrast-ratio table in the commit message. Colors.textPrimary
// (near-black, #111827) clears 4.5:1 against all three: 14.94:1 (band 1),
// 10.39:1 (band 2), 6.95:1 (band 3). Band colours are untouched — only the
// text darkened, per instruction.
const BAND_TEXT_COLORS: Record<number, string> = {
  5: '#FFFFFF',
  4: '#FFFFFF',
  3: Colors.textPrimary,
  2: Colors.textPrimary,
  1: Colors.textPrimary,
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
  if (earlyCount > 0) parts.push(`${earlyCount} earlier tap${earlyCount > 1 ? 's' : ''} didn't count.`);
  if (lateCount > 0) parts.push(`${lateCount} later tap${lateCount > 1 ? 's' : ''} didn't count.`);
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
          <Text
            style={[
              styles.bandNumeral,
              { color: BAND_TEXT_COLORS[seg.points] },
              BAND_TEXT_COLORS[seg.points] === '#FFFFFF' ? styles.bandNumeralShadow : null,
            ]}
            numberOfLines={1}
          >
            {seg.points}
          </Text>
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
          {tooEarly.length === 1 ? "1 earlier tap didn't count" : `${tooEarly.length} earlier taps didn't count`}
        </Text>
      )}
      {tooLate.length > 0 && (
        <Text style={[styles.stateText, { fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {tooLate.length === 1 ? "1 later tap didn't count" : `${tooLate.length} later taps didn't count`}
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
    height: 44,
    borderRadius: 6,
    overflow: 'visible',
    justifyContent: 'flex-end',
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
  bandNumeral: { fontSize: 10, fontWeight: '800' },
  bandNumeralShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  marker: {
    position: 'absolute',
    // Above the bar (bandsRow is 20 tall, anchored to barWrap's bottom via
    // justifyContent: 'flex-end'), not centred on it — a marker centred on
    // the bar sat directly on top of the band numeral, hiding the one
    // piece of text that has to survive independently of colour.
    bottom: 22,
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
