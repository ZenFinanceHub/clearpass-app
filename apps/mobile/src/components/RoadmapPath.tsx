import React, { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop,
} from 'react-native-svg';
import { Pip, PipMood } from './Pip';
import type { UserProgress } from '@clearpass/core';
import { Colors } from '@/src/constants/theme';

// ─── Driver's-view roadmap ───────────────────────────────────────────────────
// The learner looks out through a windscreen at a road running to the horizon.
// Milestones are roadside landmarks: each one starts small in the distance,
// becomes the highlighted "Next" landmark as it gets close, and turns into a
// green tick in the rear-view mirror once passed. The finish arch on the
// horizon is "Test ready". Pass probability drives the dashboard gauge and the
// sky, which moves from night towards sunrise as the learner gets closer.
//
// Everything is laid out in real pixels from width/height (no stretched
// viewBox), so nothing distorts on wide screens.

// ─── Palette (scene-only colours; brand colours come from the theme) ─────────

const INK        = '#0F0D2E';   // dashboard, mirror, traffic-light housing
const INK_DEEP   = '#06051A';
const LILAC      = '#A5B4FC';
const LILAC_PALE = '#C7D2FE';
const GOLD       = '#FBBF24';
const GOLD_DEEP  = '#B45309';

// UK traffic-sign colours, sampled from the sign artwork in DfT "Know Your
// Traffic Signs" (2023 edition, GOV.UK).
const SIGN_BLUE      = '#1476C6';   // mandatory (blue circle) signs
const SIGN_BLUE_DEEP = '#0B3F6B';   // drop shadow behind the blue disc
const SIGN_RED       = '#E51636';   // warning-triangle border

// ─── Milestone progress from UserProgress ────────────────────────────────────
// 0 = nothing reached yet, 1 = Road signs, 2 = Rules, 3 = Hazards, 4 = Test ready.

function computeProgress(p: UserProgress | null): number {
  if (!p || p.totalQuestionsAnswered < 1) return 0;

  const topicAttempted = Object.values(p.topicScores).filter(s => s > 0).length;
  const totalTopics    = Math.max(Object.keys(p.topicScores).length, 14);

  if (topicAttempted < Math.ceil(totalTopics * 0.25)) return 0;
  if (topicAttempted < Math.ceil(totalTopics * 0.5))  return 1;
  if (!p.hazardPerceptionHistory.some(h => h.passed))  return 2;
  if (!p.mockTestHistory.some(h => h.passed))           return 3;
  return 4;
}

type LandmarkKind = 'sign' | 'lights' | 'hazard';

const LANDMARKS: ReadonlyArray<{ label: string; kind: LandmarkKind; side: -1 | 1 }> = [
  { label: 'Road signs', kind: 'sign',   side: -1 },
  { label: 'Rules',      kind: 'lights', side:  1 },
  { label: 'Hazards',    kind: 'hazard', side: -1 },
];
const TOTAL_MILESTONES = LANDMARKS.length + 1; // + the finish arch

// How far ahead the next, second and third roadside landmarks sit.
const AHEAD_Z = [1, 2.4, 4.4] as const;

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Perspective: distance ahead (0 = at the bonnet) → on-screen scale (1 → 0). */
const depthScale = (z: number) => 1 / (1 + 0.55 * z);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (alive) setReduce(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

// ─── Centre-line dashes (the only part that re-renders on a timer) ───────────

const DASH_SPACING = 0.9;
const DASH_LENGTH  = 0.35;
const DASH_COUNT   = 8;

const CentreDashes = React.memo(function CentreDashes({
  cx, horizonY, nearY, width, height, hwFar, hwNear, animate,
}: {
  cx: number; horizonY: number; nearY: number; width: number; height: number;
  hwFar: number; hwNear: number; animate: boolean;
}) {
  const [phase, setPhase] = useState(0.5);

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setPhase(p => (p - 0.05 + 1) % 1), 90);
    return () => clearInterval(id);
  }, [animate]);

  const dashes = [];
  for (let k = 0; k < DASH_COUNT; k++) {
    const z     = (k + phase) * DASH_SPACING;
    const sNear = depthScale(z);
    const sFar  = depthScale(z + DASH_LENGTH);
    const yN    = lerp(horizonY, nearY, sNear);
    const yF    = lerp(horizonY, nearY, sFar);
    const wN    = sNear * width * 0.011;
    const wF    = sFar  * width * 0.011;
    dashes.push(
      <Polygon
        key={k}
        points={`${cx - wF},${yF} ${cx + wF},${yF} ${cx + wN},${yN} ${cx - wN},${yN}`}
        fill="#FFFFFF"
        opacity={Math.min(1, sNear * 2.2)}
      />,
    );

    // Roadside marker posts move with the dashes, which is what sells the motion.
    const edge  = lerp(hwFar, hwNear, sNear) + width * 0.025 * sNear;
    const postH = sNear * height * 0.075;
    const postW = Math.max(1, sNear * width * 0.012);
    for (const side of [-1, 1]) {
      const px = cx + side * edge;
      dashes.push(
        <G key={`${k}-${side}`} opacity={Math.min(1, sNear * 2.6)}>
          <Rect x={px - postW / 2} y={yN - postH} width={postW} height={postH} rx={postW / 2} fill={LILAC_PALE} />
          <Rect x={px - postW / 2} y={yN - postH} width={postW} height={postH * 0.28} rx={postW / 2} fill={side < 0 ? Colors.red : '#FFFFFF'} />
        </G>,
      );
    }
  }
  return <G>{dashes}</G>;
});

// ─── Landmark drawings ───────────────────────────────────────────────────────
// (bx, by) is where the landmark meets the ground; u is its full height in px.

function Landmark({ kind, bx, by, u, dim, uid }: { kind: LandmarkKind; bx: number; by: number; u: number; dim: boolean; uid: string }) {
  const pole = (topFrac: number) => (
    <Rect x={bx - u * 0.022} y={by - u * topFrac} width={u * 0.044} height={u * topFrac} rx={u * 0.01} fill={`url(#${uid}Pole)`} />
  );

  return (
    <G opacity={dim ? 0.72 : 1}>
      <Ellipse cx={bx} cy={by} rx={u * 0.17} ry={u * 0.035} fill={INK_DEEP} opacity={0.55} />

      {/* "Ahead only": blue disc, thin white rim, white upward arrow (Highway Code, signs giving orders). */}
      {kind === 'sign' && (() => {
        const cy = by - u * 0.78;
        const r  = u * 0.215;   // blue field inside the white rim
        const arrow = [
          [0, -0.74], [0.44, -0.24], [0.14, -0.24], [0.14, 0.74],
          [-0.14, 0.74], [-0.14, -0.24], [-0.44, -0.24],
        ].map(([x, y]) => `${bx + x * r},${cy + y * r}`).join(' ');
        return (
          <G>
            {pole(0.6)}
            <Circle cx={bx + u * 0.02} cy={by - u * 0.76} r={u * 0.235} fill={SIGN_BLUE_DEEP} />
            <Circle cx={bx} cy={cy} r={u * 0.235} fill="#FFFFFF" />
            <Circle cx={bx} cy={cy} r={r} fill={SIGN_BLUE} />
            <Polygon points={arrow} fill="#FFFFFF" />
          </G>
        );
      })()}

      {kind === 'lights' && (
        <G>
          {pole(0.52)}
          <Rect x={bx - u * 0.1} y={by - u * 0.985} width={u * 0.25} height={u * 0.5} rx={u * 0.06} fill={INK_DEEP} />
          <Rect
            x={bx - u * 0.125} y={by - u} width={u * 0.25} height={u * 0.5} rx={u * 0.06}
            fill={INK} stroke="#4B4F7A" strokeWidth={Math.max(1, u * 0.015)}
          />
          {/* A real signal never shows all three: show GREEN alone ("you may go on if the
              way is clear"), with red and amber present but unlit. */}
          {[Colors.red, Colors.amber, Colors.emerald].map((c, i) => {
            const cy  = by - u * (0.91 - i * 0.16);
            const lit = i === 2;
            return (
              <G key={c}>
                <Circle cx={bx} cy={cy} r={u * 0.062} fill={lit ? c : mix(c, INK, 0.72)} />
                {lit && <Circle cx={bx - u * 0.02} cy={cy - u * 0.02} r={u * 0.018} fill="#FFFFFF" opacity={0.6} />}
              </G>
            );
          })}
        </G>
      )}

      {kind === 'hazard' && (
        <G>
          {pole(0.58)}
          <Polygon
            points={`${bx + u * 0.02},${by - u * 0.98} ${bx - u * 0.23},${by - u * 0.54} ${bx + u * 0.27},${by - u * 0.54}`}
            fill="#7F1D1D"
          />
          <Polygon
            points={`${bx},${by - u} ${bx - u * 0.25},${by - u * 0.56} ${bx + u * 0.25},${by - u * 0.56}`}
            fill="#FFFFFF"
            stroke={SIGN_RED}
            strokeWidth={Math.max(2, u * 0.05)}
            strokeLinejoin="round"
          />
          <Line
            x1={bx} y1={by - u * 0.84} x2={bx} y2={by - u * 0.71}
            stroke={Colors.textPrimary} strokeWidth={Math.max(1.5, u * 0.045)} strokeLinecap="round"
          />
          <Circle cx={bx} cy={by - u * 0.64} r={Math.max(1, u * 0.026)} fill={Colors.textPrimary} />
        </G>
      )}
    </G>
  );
}

function FinishArch({ cx, by, half, postH, uid }: { cx: number; by: number; half: number; postH: number; uid: string }) {
  const postW   = Math.max(2, postH * 0.07);
  const bannerH = Math.max(5, postH * 0.3);
  const cols    = 8;
  const cellW   = (half * 2) / cols;
  const cellH   = bannerH / 2;
  const top     = by - postH;

  const checks = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) {
        checks.push(
          <Rect key={`${r}-${c}`} x={cx - half + c * cellW} y={top + r * cellH} width={cellW} height={cellH} fill={Colors.textPrimary} />,
        );
      }
    }
  }

  return (
    <G>
      <Rect x={cx - half - postW / 2} y={top} width={postW} height={postH} fill={`url(#${uid}Gold)`} />
      <Rect x={cx + half - postW / 2} y={top} width={postW} height={postH} fill={`url(#${uid}Gold)`} />
      <Rect x={cx - half} y={top} width={half * 2} height={bannerH} fill="#FFFFFF" />
      {checks}
      <Rect
        x={cx - half} y={top} width={half * 2} height={bannerH}
        fill="none" stroke={GOLD} strokeWidth={Math.max(1, postH * 0.03)}
      />
    </G>
  );
}

// ─── RoadmapPath ─────────────────────────────────────────────────────────────

interface RoadmapPathProps {
  progress: UserProgress | null;
  passProbability: number;
  pipMood?: PipMood;
  width: number;
  height?: number;
}

const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [0.08, 0.22, 1.4], [0.2, 0.1, 1], [0.31, 0.3, 1.2], [0.69, 0.12, 1.2],
  [0.78, 0.27, 1.5], [0.9, 0.16, 1], [0.94, 0.34, 1.2], [0.05, 0.38, 1],
];

const LABEL_W = 150;

export default function RoadmapPath({ progress, passProbability, pipMood = 'happy', width, height: heightProp }: RoadmapPathProps) {
  const current = computeProgress(progress);
  const height  = heightProp ?? Math.round(width * 0.82);
  const pct     = Math.round(Math.max(0, Math.min(100, passProbability)));
  const f       = pct / 100;

  const reduceMotion = useReduceMotion();
  // Gradient ids must be unique per instance or two roadmaps on one page share them (web).
  const uid = `rd${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // ── Scene geometry ──
  const cx       = width / 2;
  const horizonY = height * 0.44;
  const nearY    = height * 0.9;
  const hwFar    = width * 0.035;
  const hwNear   = width * 0.37;
  const groundY  = (s: number) => lerp(horizonY, nearY, s);
  const roadHalf = (s: number) => lerp(hwFar, hwNear, s);
  const unitMax  = height * 0.6;

  const dashSideY = height * 0.87;
  const dashMidY  = height * 0.81;

  // ── Roadside landmarks still ahead, far → near ──
  const ahead = LANDMARKS
    .map((lm, i) => ({ ...lm, i }))
    .filter(lm => lm.i >= current)
    .map((lm, n) => {
      const s  = depthScale(AHEAD_Z[n] ?? 6);
      const u  = s * unitMax;
      const raw = cx + lm.side * (roadHalf(s) + width * 0.09 * s + u * 0.2);
      const bx  = Math.max(u * 0.3, Math.min(width - u * 0.3, raw));
      return { ...lm, n, s, u, bx, by: groundY(s) };
    });
  const next = ahead[0];

  // ── Finish arch: on the horizon until it's the next thing, then it looms ──
  const arrived      = current >= TOTAL_MILESTONES;
  const finishIsNext = current === LANDMARKS.length;
  const finishS      = arrived ? depthScale(0.9) : finishIsNext ? depthScale(1.7) : 0.1;
  const finishBy     = groundY(finishS);
  const finishPostH  = Math.max(14, finishS * height * 0.62);
  const finishHalf   = roadHalf(finishS) * 1.08;
  const finishLabel  = arrived ? "You're test ready" : finishIsNext ? 'Next: Test ready' : 'Test ready';

  // ── Ambient motion ──
  const pulse = useRef(new Animated.Value(0)).current;
  const bob   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const mk = (v: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const a = mk(pulse, 1000);
    const b = mk(bob, 1400);
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [pulse, bob, reduceMotion]);

  // Glow sits behind whatever is next: a roadside landmark, or the finish arch.
  const glow = next
    ? { x: next.bx, y: next.by - next.u * 0.76, r: next.u * 0.5 }
    : { x: cx, y: finishBy - finishPostH * 0.85, r: Math.max(26, finishPostH * 0.55) };

  // ── Dashboard ──
  const pipSize = Math.round(height * 0.13);
  const pipH    = Math.round(pipSize * 1.2);
  const gaugeR  = Math.min(height * 0.1, 30);
  const gaugeX  = width * 0.76;
  const gaugeY  = height - 8;
  const theta   = Math.PI * f;
  const gaugeEnd = { x: gaugeX - gaugeR * Math.cos(theta), y: gaugeY - gaugeR * Math.sin(theta) };

  const labelLeft = (x: number) => Math.max(0, Math.min(width - LABEL_W, x - LABEL_W / 2));
  const labelTop  = (y: number) => Math.max(42, y - 26);

  const passed = Math.min(current, TOTAL_MILESTONES);
  const a11y =
    `Your progress. ${pct} percent ready. ${passed} of ${TOTAL_MILESTONES} milestones passed. ` +
    (arrived ? 'You are test ready.' : `Next: ${next ? next.label : 'Test ready'}.`);

  return (
    <View
      style={[styles.container, { width, height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      {/* ── Layer 1: sky, ground, road ── */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${uid}Sky`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={mix('#14123A', '#3730A3', f)} />
            <Stop offset="60%"  stopColor={mix('#1E1B4B', '#6D5BD0', f)} />
            <Stop offset="100%" stopColor={mix('#3B348F', '#FDBA74', f)} />
          </LinearGradient>
          <RadialGradient id={`${uid}Glow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={GOLD}              stopOpacity={0.55 + 0.4 * f} />
            <Stop offset="45%"  stopColor={Colors.indigoDark} stopOpacity={0.45} />
            <Stop offset="100%" stopColor={Colors.indigo}     stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${uid}Ground`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#1F1B57" />
            <Stop offset="100%" stopColor="#0E0C2B" />
          </LinearGradient>
          <LinearGradient id={`${uid}Road`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#565A8C" />
            <Stop offset="100%" stopColor="#2A2D4D" />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={horizonY + 1} fill={`url(#${uid}Sky)`} />

        {STARS.map(([sx, sy, sr], i) => (
          <Circle key={i} cx={sx * width} cy={sy * height} r={sr} fill={LILAC_PALE} opacity={0.85 * (1 - f * 0.9)} />
        ))}

        <Ellipse
          cx={cx} cy={horizonY}
          rx={width * (0.24 + 0.2 * f)} ry={height * (0.13 + 0.1 * f)}
          fill={`url(#${uid}Glow)`}
        />

        {/* Distant hills */}
        <Path
          d={
            `M 0 ${horizonY} Q ${width * 0.16} ${horizonY - height * 0.075} ${width * 0.36} ${horizonY} Z ` +
            `M ${width * 0.6} ${horizonY} Q ${width * 0.84} ${horizonY - height * 0.06} ${width} ${horizonY - height * 0.01} L ${width} ${horizonY} Z`
          }
          fill={mix('#27236B', '#4338CA', f * 0.5)}
        />

        <Rect x={0} y={horizonY} width={width} height={height - horizonY} fill={`url(#${uid}Ground)`} />

        {/* Road */}
        <Polygon
          points={`${cx - hwFar},${horizonY} ${cx + hwFar},${horizonY} ${cx + hwNear},${nearY} ${cx - hwNear},${nearY}`}
          fill={`url(#${uid}Road)`}
        />
        {[-1, 1].map(side => (
          <G key={side}>
            <Line
              x1={cx + side * hwFar} y1={horizonY} x2={cx + side * hwNear} y2={nearY}
              stroke={Colors.indigoDark} strokeWidth={7} opacity={0.22}
            />
            <Line
              x1={cx + side * hwFar} y1={horizonY} x2={cx + side * hwNear} y2={nearY}
              stroke={LILAC} strokeWidth={2}
            />
          </G>
        ))}

        <CentreDashes
          cx={cx} horizonY={horizonY} nearY={nearY} width={width} height={height}
          hwFar={hwFar} hwNear={hwNear} animate={!reduceMotion}
        />
      </Svg>

      {/* ── Pulsing glow behind the next landmark ── */}
      {!arrived && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              left: glow.x - glow.r,
              top: glow.y - glow.r,
              width: glow.r * 2,
              height: glow.r * 2,
              opacity: reduceMotion ? 0.6 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }),
              transform: [{ scale: reduceMotion ? 1.1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
            },
          ]}
        >
          <Svg width={glow.r * 2} height={glow.r * 2}>
            <Defs>
              <RadialGradient id={`${uid}Halo`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor={GOLD} stopOpacity={0.95} />
                <Stop offset="55%"  stopColor={GOLD} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={glow.r} cy={glow.r} r={glow.r} fill={`url(#${uid}Halo)`} />
          </Svg>
        </Animated.View>
      )}

      {/* ── Layer 2: landmarks, finish arch, dashboard ── */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${uid}Pole`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={LILAC_PALE} />
            <Stop offset="100%" stopColor="#6B6FA0" />
          </LinearGradient>
          <LinearGradient id={`${uid}Gold`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={GOLD} />
            <Stop offset="100%" stopColor={GOLD_DEEP} />
          </LinearGradient>
          <LinearGradient id={`${uid}Dash`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#1B1846" />
            <Stop offset="100%" stopColor={INK_DEEP} />
          </LinearGradient>
        </Defs>

        <FinishArch cx={cx} by={finishBy} half={finishHalf} postH={finishPostH} uid={uid} />

        {[...ahead].reverse().map(lm => (
          <Landmark key={lm.label} kind={lm.kind} bx={lm.bx} by={lm.by} u={lm.u} dim={lm.n > 0} uid={uid} />
        ))}

        {/* Dashboard */}
        <Path
          d={`M 0 ${dashSideY} Q ${cx} ${2 * dashMidY - dashSideY} ${width} ${dashSideY} V ${height} H 0 Z`}
          fill={`url(#${uid}Dash)`}
        />
        <Path
          d={`M 0 ${dashSideY} Q ${cx} ${2 * dashMidY - dashSideY} ${width} ${dashSideY}`}
          stroke={Colors.indigoDark} strokeWidth={1.5} opacity={0.5} fill="none"
        />

        {/* Steering wheel */}
        <Circle cx={width * 0.24} cy={height * 1.13} r={height * 0.24} stroke="#2E3158" strokeWidth={height * 0.036} fill="none" />
        <Circle cx={width * 0.24} cy={height * 1.13} r={height * 0.252} stroke="#4B4F7A" strokeWidth={1.5} fill="none" />

        {/* Readiness gauge */}
        <Path
          d={`M ${gaugeX - gaugeR} ${gaugeY} A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeX + gaugeR} ${gaugeY}`}
          stroke="#2E3158" strokeWidth={6} strokeLinecap="round" fill="none"
        />
        {f > 0.01 && (
          <Path
            d={`M ${gaugeX - gaugeR} ${gaugeY} A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeEnd.x} ${gaugeEnd.y}`}
            stroke={f >= 0.8 ? Colors.emerald : Colors.indigoDark}
            strokeWidth={6} strokeLinecap="round" fill="none"
          />
        )}
      </Svg>

      {/* ── Labels ── */}
      <View pointerEvents="none" style={[styles.labelWrap, { left: labelLeft(cx), top: labelTop(finishBy - finishPostH) }]}>
        <View style={[styles.pill, styles.pillGold]}>
          <Text style={[styles.pillText, styles.pillTextGold]}>{finishLabel}</Text>
        </View>
      </View>

      {ahead.filter(lm => lm.n < 2).map(lm => (
        <View key={lm.label} pointerEvents="none" style={[styles.labelWrap, { left: labelLeft(lm.bx), top: labelTop(lm.by - lm.u) }]}>
          <View style={[styles.pill, lm.n === 0 ? styles.pillNext : styles.pillLater]}>
            <Text style={[styles.pillText, lm.n === 0 ? styles.pillTextNext : styles.pillTextLater]}>
              {lm.n === 0 ? `Next: ${lm.label}` : lm.label}
            </Text>
          </View>
        </View>
      ))}

      {/* ── Rear-view mirror: milestones already passed ── */}
      <View pointerEvents="none" style={[styles.mirrorStem, { left: cx - 2 }]} />
      <View pointerEvents="none" style={[styles.mirrorWrap, { width }]}>
        <View style={styles.mirror}>
          {Array.from({ length: passed }).map((_, i) => (
            <View key={i} style={styles.tick}>
              <Svg width={8} height={8} viewBox="0 0 8 8">
                <Path d="M 1 4.2 L 3.2 6.4 L 7 1.8" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          ))}
          <Text style={[styles.mirrorText, passed === 0 && styles.mirrorTextIdle]}>
            {`${passed}/${TOTAL_MILESTONES} passed`}
          </Text>
        </View>
      </View>

      {/* ── Gauge readout ── */}
      <Text style={[styles.gaugeValue, { left: gaugeX - gaugeR, width: gaugeR * 2, top: gaugeY - gaugeR * 0.68 }]}>
        {`${pct}%`}
      </Text>
      <Text style={[styles.gaugeCaption, { left: gaugeX + gaugeR + 7, top: gaugeY - 15 }]}>{'ready'}</Text>

      {/* ── Pip rides on the dashboard ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pip,
          {
            left: cx - pipSize / 2,
            top: dashMidY + 9 - pipH,
            transform: [{ translateY: reduceMotion ? 0 : bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          },
        ]}
      >
        <Pip size={pipSize} mood={pipMood} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E1B4B',
  },
  glow: {
    position: 'absolute',
  },
  labelWrap: {
    position: 'absolute',
    width: LABEL_W,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillNext:  { backgroundColor: '#FFFFFF' },
  pillLater: { backgroundColor: '#2E2B6B' },
  pillGold:  { backgroundColor: '#78350F' },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextNext:  { color: '#312E81' },
  pillTextLater: { color: LILAC_PALE },
  pillTextGold:  { color: '#FDE68A' },
  mirrorStem: {
    position: 'absolute',
    top: 0,
    width: 4,
    height: 10,
    backgroundColor: INK,
  },
  mirrorWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    alignItems: 'center',
  },
  mirror: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: INK,
    borderWidth: 1.5,
    borderColor: '#6B6FA0',
  },
  tick: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A7F3D0',
    marginLeft: 2,
  },
  mirrorTextIdle: { color: LILAC },
  gaugeValue: {
    position: 'absolute',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gaugeCaption: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: LILAC,
  },
  pip: {
    position: 'absolute',
  },
});
