import { describe, expect, test } from 'vitest';
import { scoreClip, calculateHazardTotal } from './hazardScoring';
import { HazardClip, HazardWindow, ScoringBand } from './types/HazardClip';

// ── Fixtures: real production band data (seconds) ──────────────────────────
// Source: production Supabase `hazard_clips.scoring_windows`, supplied 2026-08-13.

const CGI1_HAZARD1_BANDS: ScoringBand[] = [
  { points: 5, startSec: 18.19, endSec: 19.18 },
  { points: 4, startSec: 19.19, endSec: 20.18 },
  { points: 3, startSec: 20.19, endSec: 21.18 },
  { points: 2, startSec: 21.19, endSec: 22.18 },
  { points: 1, startSec: 22.19, endSec: 23.18 },
];

const BRIDGE_HAZARD1_BANDS: ScoringBand[] = [
  { points: 5, startSec: 7.20, endSec: 7.88 },
  { points: 4, startSec: 7.88, endSec: 8.56 },
  { points: 3, startSec: 8.56, endSec: 9.28 },
  { points: 2, startSec: 9.28, endSec: 9.96 },
  { points: 1, startSec: 9.96, endSec: 10.60 },
];

const BRIDGE_HAZARD2_BANDS: ScoringBand[] = [
  { points: 5, startSec: 20.96, endSec: 21.40 },
  { points: 4, startSec: 21.40, endSec: 21.84 },
  { points: 3, startSec: 21.84, endSec: 22.32 },
  { points: 2, startSec: 22.32, endSec: 22.76 },
  { points: 1, startSec: 22.76, endSec: 23.16 },
];

// Mirrors apps/mobile/src/hazardVideos.ts:buildHazardClip — window bounds are
// the min band start / max band end, exactly as production derives them.
function windowFromBands(bands: ScoringBand[]): HazardWindow {
  const sorted = [...bands].sort((a, b) => a.startSec - b.startSec);
  return { startSec: sorted[0].startSec, endSec: sorted[sorted.length - 1].endSec, bands };
}

function makeClip(id: string, hazards: HazardWindow[]): HazardClip {
  return { id, title: id, description: '', videoUrl: '', durationSec: 60, hazards };
}

const CGI1_WINDOW = windowFromBands(CGI1_HAZARD1_BANDS);
const CGI1_CLIP = makeClip('cgi-clip-1', [CGI1_WINDOW]);

const BRIDGE_H1_WINDOW = windowFromBands(BRIDGE_HAZARD1_BANDS);
const BRIDGE_H2_WINDOW = windowFromBands(BRIDGE_HAZARD2_BANDS);
const BRIDGE_CLIP = makeClip('priority-bridge-cyclist', [BRIDGE_H1_WINDOW, BRIDGE_H2_WINDOW]);
const BRIDGE_H1_ONLY_CLIP = makeClip('priority-bridge-cyclist-h1-only', [BRIDGE_H1_WINDOW]);

// ── a) One tap in each of the five bands ────────────────────────────────────

describe('CGI Clip 1, hazard 1 — one tap per band', () => {
  test.each([
    ['5pt band midpoint', 18.685, 5],
    ['4pt band midpoint', 19.685, 4],
    ['3pt band midpoint', 20.685, 3],
    ['2pt band midpoint', 21.685, 2],
    ['1pt band midpoint', 22.685, 1],
  ])('%s (t=%f) scores %i', (_label, t, expected) => {
    expect(scoreClip(CGI1_CLIP, [t]).score).toBe(expected);
  });
});

// ── b) Taps on every band boundary, both sides ──────────────────────────────

describe('CGI Clip 1 — band boundaries (bands have a real 0.01s gap, unambiguous)', () => {
  test.each([
    ['band 5 start', 18.19, 5],
    ['band 5 end', 19.18, 5],
    ['band 4 start', 19.19, 4],
    ['band 4 end', 20.18, 4],
    ['band 3 start', 20.19, 3],
    ['band 3 end', 21.18, 3],
    ['band 2 start', 21.19, 2],
    ['band 2 end', 22.18, 2],
    ['band 1 start', 22.19, 1],
    ['band 1 end (= window end)', 23.18, 1],
  ])('%s (t=%f) scores %i', (_label, t, expected) => {
    expect(scoreClip(CGI1_CLIP, [t]).score).toBe(expected);
  });
});

describe('Priority Bridge hazard 1 — band boundaries (bands touch exactly, no gap)', () => {
  // Touching boundary is a genuine tie in the data. scoreWindow sorts bands
  // descending by points and returns the first match, so a tap on a shared
  // edge deterministically resolves to the HIGHER-point band.
  test.each([
    ['window start / band 5 start', 7.20, 5],
    ['band5/4 shared edge', 7.88, 5],
    ['band4/3 shared edge', 8.56, 4],
    ['band3/2 shared edge', 9.28, 3],
    ['band2/1 shared edge', 9.96, 2],
    ['band 1 end (= window end)', 10.60, 1],
  ])('%s (t=%f) scores %i', (_label, t, expected) => {
    expect(scoreClip(BRIDGE_H1_ONLY_CLIP, [t]).score).toBe(expected);
  });
});

// ── c) Taps in inter-band gaps ───────────────────────────────────────────────
// CGI Clip 1's bands leave a real 0.01s hole between each pair (band N ends
// 19.18, band N-1 starts 19.19). A tap landing in that hole today matches no
// band and silently scores 0 — the bug fix 3 targets: match the LAST band
// whose startSec <= tap, provided the tap is within the overall window. That
// means a gap tap is credited to the band that most recently opened.

describe('CGI Clip 1 — taps in the inter-band gaps score the band that most recently opened', () => {
  test.each([
    ['gap after band 5 (given example)', 19.185, 5],
    ['gap after band 4', 20.185, 4],
    ['gap after band 3', 21.185, 3],
    ['gap after band 2', 22.185, 2],
  ])('%s (t=%f) scores %i', (_label, t, expected) => {
    expect(scoreClip(CGI1_CLIP, [t]).score).toBe(expected);
  });
});

// ── d) Just before window open / just after window close ────────────────────

describe('CGI Clip 1 — outside the window entirely', () => {
  test('tap well before window open scores 0', () => {
    expect(scoreClip(CGI1_CLIP, [CGI1_WINDOW.startSec - 0.5]).score).toBe(0);
  });

  test('tap well after window close scores 0', () => {
    expect(scoreClip(CGI1_CLIP, [CGI1_WINDOW.endSec + 0.5]).score).toBe(0);
  });
});

// ── e) No tap at all ──────────────────────────────────────────────────────

describe('CGI Clip 1 — no tap', () => {
  test('scores 0 with maxScore still reported', () => {
    const result = scoreClip(CGI1_CLIP, []);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.countedTaps).toBe(0);
  });
});

// ── f) Two taps both inside one hazard's window ──────────────────────────────
// Authorised behaviour change (task 2): the earliest qualifying click in a
// band scores; a second, later in-window tap no longer zeroes the hazard.
// Zeroing is now the clip-wide excessive-clicking rule's job only (see i/j).

describe('CGI Clip 1 — two taps inside the same hazard window', () => {
  test('scores the EARLIEST qualifying tap, not zero', () => {
    // 18.685 (band 5) happens first, 20.685 (band 3) is a later duplicate tap.
    expect(scoreClip(CGI1_CLIP, [18.685, 20.685]).score).toBe(5);
  });

  test('earliest-wins is by tap TIME, not array order', () => {
    // Later band's tap appears first in the array; the earlier-in-time tap
    // (band 5) must still win.
    expect(scoreClip(CGI1_CLIP, [22.685, 18.685]).score).toBe(5);
  });
});

// ── g) Priority Bridge — both hazards / one hazard / neither ────────────────

describe('Priority Bridge & Cyclist — two independent hazards', () => {
  test('a tap in each hazard scores both', () => {
    const result = scoreClip(BRIDGE_CLIP, [7.54, 21.18]); // both band-5 midpoints
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
  });

  test('a tap in only hazard 1 scores just that hazard', () => {
    const result = scoreClip(BRIDGE_CLIP, [7.54]);
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(10);
  });

  test('a tap in neither hazard window scores 0', () => {
    // 15.0s sits well between hazard 1's end (10.60) and hazard 2's start (20.96).
    const result = scoreClip(BRIDGE_CLIP, [15.0]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(10);
  });
});

// ── h) Priority Bridge — hazard independence ─────────────────────────────────

describe('Priority Bridge & Cyclist — a hazard 1 tap must not touch hazard 2', () => {
  test('adding hazard 2 to the clip does not change the score a hazard-1-only tap produces', () => {
    const tap = 8.92; // hazard 1, band 3 midpoint
    const withBothHazards = scoreClip(BRIDGE_CLIP, [tap]).score;
    const withHazard1Only = scoreClip(BRIDGE_H1_ONLY_CLIP, [tap]).score;
    expect(withBothHazards).toBe(3);
    expect(withHazard1Only).toBe(3);
    expect(withBothHazards).toBe(withHazard1Only);
  });
});

// ── i) Rhythmic tapping trips the clip-wide anti-cheat rule ──────────────────

describe('Priority Bridge & Cyclist — clip-wide anti-cheat', () => {
  test('8+ taps in the same second zeroes the WHOLE clip, including an otherwise-valid tap elsewhere', () => {
    const spamTaps = [7.20, 7.21, 7.22, 7.23, 7.24, 7.25, 7.26, 7.27]; // 8 taps, all floor(t) === 7
    const legitimateHazard2Tap = 21.18; // would score 5 on its own
    const result = scoreClip(BRIDGE_CLIP, [...spamTaps, legitimateHazard2Tap]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(10); // maxScore is unaffected by clicks
  });

  // ── j) Just below the threshold must still score normally ─────────────────

  test('7 taps in the same second does NOT trip anti-cheat, and a separate legitimate tap still scores', () => {
    const nearSpamTaps = [1.00, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06]; // 7 taps, floor(t) === 1, outside any window
    const legitimateHazard1Tap = 7.54; // band 5 midpoint
    const result = scoreClip(BRIDGE_CLIP, [...nearSpamTaps, legitimateHazard1Tap]);
    expect(result.score).toBe(5);
  });
});

// ── k) Full 14-clip session — computed maximum ───────────────────────────────
// Production: 38 active clips, 39 hazards total — exactly ONE clip (Priority
// Bridge & Cyclist) has two hazards; every other clip has one. A session
// draws 14 clips. Whether that session's theoretical max is 75 or 70 depends
// entirely on whether the two-hazard clip happens to be included.

describe('Full session — theoretical maximum depends on session composition', () => {
  // Filler clips: single hazard each, band content is irrelevant to a
  // maxScore/perfect-score computation, so these are synthetic (not
  // production data) — only CGI Clip 1 and Priority Bridge above are real.
  function makeFillerClip(n: number): HazardClip {
    return makeClip(`filler-${n}`, [{ startSec: 10, endSec: 15, bands: [{ points: 5, startSec: 10, endSec: 15 }] }]);
  }

  test('14 clips INCLUDING the two-hazard clip max out at 75, and a perfect run achieves it', () => {
    const clips = [...Array.from({ length: 13 }, (_, i) => makeFillerClip(i)), BRIDGE_CLIP];
    const results = clips.map((clip) =>
      clip === BRIDGE_CLIP ? scoreClip(clip, [7.54, 21.18]) : scoreClip(clip, [12.5]),
    );
    const total = calculateHazardTotal(results);
    expect(total.maxScore).toBe(75);
    expect(total.score).toBe(75);
    expect(total.passed).toBe(true);
  });

  test('14 clips EXCLUDING the two-hazard clip max out at 70, not 75', () => {
    const clips = Array.from({ length: 14 }, (_, i) => makeFillerClip(i));
    const results = clips.map((clip) => scoreClip(clip, [12.5]));
    const total = calculateHazardTotal(results);
    expect(total.maxScore).toBe(70);
    expect(total.score).toBe(70);
  });
});

// ── l) Fail closed on an unbanded clip ───────────────────────────────────────
// A clip with no bands can only be scored via the thirds fallback (max 5/4/3,
// never 2 or 1) — an inflated, plausible-looking approximation of the DVSA
// model this app is licensed to mirror. Refuse to score it at all instead:
// 0 score, 0 maxScore, excluded from the session, rather than guessing.

describe('A clip with any unbanded hazard fails closed', () => {
  const unbandedClip = makeClip('unbanded', [{ startSec: 5, endSec: 10 }]); // no bands

  test('is not scored even when a tap would have landed in-window', () => {
    const result = scoreClip(unbandedClip, [7]); // thirds fallback would have scored 5
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.scorable).toBe(false);
  });

  test('a mixed clip (one hazard banded, one not) fails closed entirely — not partially scored', () => {
    const mixedClip = makeClip('mixed', [BRIDGE_H1_WINDOW, { startSec: 20.96, endSec: 23.16 }]);
    // 7.54 would score hazard 1's band 5 (5pts) if hazard 1 were scored alone.
    const result = scoreClip(mixedClip, [7.54]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.scorable).toBe(false);
  });

  test('a fully-banded clip is unaffected: scorable stays true', () => {
    expect(scoreClip(CGI1_CLIP, [18.685]).scorable).toBe(true);
    expect(scoreClip(BRIDGE_CLIP, [7.54, 21.18]).scorable).toBe(true);
  });

  test('an excluded clip contributes nothing to the session total, alongside a normally-scored clip', () => {
    const results = [scoreClip(unbandedClip, [7]), scoreClip(CGI1_CLIP, [18.685])];
    const total = calculateHazardTotal(results);
    expect(total.score).toBe(5); // only CGI1's band-5 tap
    expect(total.maxScore).toBe(5); // unbanded clip contributes 0, not 5
  });
});