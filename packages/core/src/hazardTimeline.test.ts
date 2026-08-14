import { describe, expect, test } from 'vitest';
import { computeHazardTimelineLayout, HAZARD_TIMELINE_PADDING_SEC } from './hazardTimeline';
import { CGI1_WINDOW, BRIDGE_H1_WINDOW, BRIDGE_H2_WINDOW } from './fixtures/hazardBands';

describe('computeHazardTimelineLayout — CGI Clip 1, one tap per band', () => {
  // visibleStart = 18.19 - 2 = 16.19, visibleEnd = 23.18 + 2 = 25.18, span = 9
  test.each([
    ['band 5 midpoint', 18.685, 5],
    ['band 4 midpoint', 19.685, 4],
    ['band 3 midpoint', 20.685, 3],
    ['band 2 midpoint', 21.685, 2],
    ['band 1 midpoint', 22.685, 1],
  ])('%s (t=%f) is in-range and in-band', (_label, tap, _points) => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [tap], tap, false);
    expect(layout.taps).toHaveLength(1);
    const t = layout.taps[0];
    if (t.kind !== 'in-range') throw new Error(`expected in-range, got ${t.kind}`);
    expect(t.marker.inBand).toBe(true);
    expect(t.marker.isScoringTap).toBe(true);
  });

  test('produces 5 proportionally-sized segments, not equal widths, summing to the real band durations', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [], null, false);
    expect(layout.segments).toHaveLength(5);
    expect(layout.segments.map((s) => s.points)).toEqual([5, 4, 3, 2, 1]);
    // Each CGI1 band is ~0.99-1.0s wide against a 9s span — roughly 11% each,
    // and NOT hardcoded to an equal 20% (which a naive "5 equal slices"
    // implementation would produce).
    for (const seg of layout.segments) {
      expect(seg.widthPct).toBeGreaterThan(10);
      expect(seg.widthPct).toBeLessThan(12);
    }
    // band 5 starts at (18.19 - 16.19) / 9 * 100
    expect(layout.segments[0].startPct).toBeCloseTo(22.222, 1);
  });
});

describe('computeHazardTimelineLayout — padding is exactly 2s either side of the window', () => {
  test('visibleStart/visibleEnd are the window bounds padded by HAZARD_TIMELINE_PADDING_SEC', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [], null, false);
    expect(HAZARD_TIMELINE_PADDING_SEC).toBe(2);
    expect(layout.visibleStart).toBeCloseTo(CGI1_WINDOW.startSec - 2, 5);
    expect(layout.visibleEnd).toBeCloseTo(CGI1_WINDOW.endSec + 2, 5);
  });
});

describe('computeHazardTimelineLayout — taps well outside the visible range', () => {
  test('a tap well before the window is "too-early", not plotted on the bar', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [CGI1_WINDOW.startSec - 5], null, false);
    expect(layout.taps).toEqual([{ kind: 'too-early', tap: CGI1_WINDOW.startSec - 5 }]);
  });

  test('a tap well after the window is "too-late", not plotted on the bar', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [CGI1_WINDOW.endSec + 5], null, false);
    expect(layout.taps).toEqual([{ kind: 'too-late', tap: CGI1_WINDOW.endSec + 5 }]);
  });

  test('a tap inside the padding zone but outside every band is in-range and NOT in-band', () => {
    // 17.0 sits between visibleStart (16.19) and band 5's start (18.19).
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [17.0], null, false);
    const t = layout.taps[0];
    if (t.kind !== 'in-range') throw new Error(`expected in-range, got ${t.kind}`);
    expect(t.marker.inBand).toBe(false);
  });
});

describe('computeHazardTimelineLayout — no tap at all', () => {
  test('reports noTapsAtAll and an empty taps array, but still returns the band segments', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [], null, false);
    expect(layout.noTapsAtAll).toBe(true);
    expect(layout.taps).toEqual([]);
    expect(layout.segments).toHaveLength(5);
  });
});

describe('computeHazardTimelineLayout — multiple taps, one scoring', () => {
  test('shows every tap, marking only the earliest-qualifying (scoring) one', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [18.685, 20.685], 18.685, false);
    expect(layout.taps).toHaveLength(2);
    const [first, second] = layout.taps;
    if (first.kind !== 'in-range' || second.kind !== 'in-range') throw new Error('expected both in-range');
    expect(first.marker.isScoringTap).toBe(true);
    expect(second.marker.isScoringTap).toBe(false);
  });

  test('zeroed is passed through untouched for the caller to style distinctly', () => {
    const layout = computeHazardTimelineLayout(CGI1_WINDOW, [18.685], 18.685, true);
    expect(layout.zeroed).toBe(true);
  });
});

describe('computeHazardTimelineLayout — double-hazard clip (Priority Bridge)', () => {
  test('each hazard gets its own independently-scaled timeline from the SAME shared clicks array', () => {
    const clicks = [7.54, 21.18]; // hazard 1's tap, hazard 2's tap

    const h1Layout = computeHazardTimelineLayout(BRIDGE_H1_WINDOW, clicks, 7.54, false);
    const h2Layout = computeHazardTimelineLayout(BRIDGE_H2_WINDOW, clicks, 21.18, false);

    // Hazard 1's bar: its own tap is in-range and scoring; hazard 2's tap
    // (13+ seconds later) is far outside hazard 1's padded window.
    expect(h1Layout.taps).toEqual([
      { kind: 'in-range', marker: { tap: 7.54, positionPct: expect.any(Number), isScoringTap: true, inBand: true } },
      { kind: 'too-late', tap: 21.18 },
    ]);

    // Hazard 2's bar: the reverse — its own tap in-range/scoring, hazard 1's
    // tap too early for hazard 2's window.
    expect(h2Layout.taps).toEqual([
      { kind: 'too-early', tap: 7.54 },
      { kind: 'in-range', marker: { tap: 21.18, positionPct: expect.any(Number), isScoringTap: true, inBand: true } },
    ]);

    // Neither hazard's visible span should overlap the other's — confirms
    // two independent bars, not one bar stretched across both (which would
    // crush each hazard's ~0.4-0.7s bands into unreadable slivers over the
    // ~13s gap between the two hazards).
    expect(h1Layout.visibleEnd).toBeLessThan(h2Layout.visibleStart);
  });
});
