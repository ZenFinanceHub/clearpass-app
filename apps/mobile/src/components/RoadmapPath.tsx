import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Pip, PipMood } from './Pip';
import type { UserProgress } from '@clearpass/core';
import { Colors } from '@/src/constants/theme';

// ─── Viewbox & geometry ──────────────────────────────────────────────────────

// Extra horizontal margin (beyond the 200-wide road layout) so side labels
// like "HAZARD" have room to render without clipping against the SVG edge.
const LABEL_MARGIN = 14;
const VBOX_W = 200 + LABEL_MARGIN * 2;
const VBOX_H = 300;
const ROAD_W = 18;
const NODE_R = 18;
const CENTER_X = VBOX_W / 2;

// Five milestones in viewbox coordinates (x, y) — bottom to top
const NODES = [
  { x: 100 + LABEL_MARGIN, y: 275, label: 'Start',            emoji: '🚗', short: 'START' },
  { x:  52 + LABEL_MARGIN, y: 215, label: 'Road Signs',        emoji: '🚦', short: 'SIGNS' },
  { x: 148 + LABEL_MARGIN, y: 155, label: 'Rules of the Road', emoji: '📋', short: 'RULES' },
  { x:  52 + LABEL_MARGIN, y:  95, label: 'Hazard Aware',      emoji: '⚠️', short: 'HAZARD' },
  { x: 100 + LABEL_MARGIN, y:  28, label: 'Test Ready',        emoji: '🏆', short: 'READY' },
] as const;

// Smooth cubic-bezier road path connecting the 5 nodes
const ROAD_PATH =
  `M ${100 + LABEL_MARGIN} 275 C ${100 + LABEL_MARGIN} 252 ${52 + LABEL_MARGIN} 238 ${52 + LABEL_MARGIN} 215 ` +
  `C ${52 + LABEL_MARGIN} 192 ${148 + LABEL_MARGIN} 172 ${148 + LABEL_MARGIN} 155 ` +
  `C ${148 + LABEL_MARGIN} 132 ${52 + LABEL_MARGIN} 115 ${52 + LABEL_MARGIN} 95 ` +
  `C ${52 + LABEL_MARGIN} 72 ${100 + LABEL_MARGIN} 52 ${100 + LABEL_MARGIN} 28`;

// ─── Milestone progress from UserProgress ────────────────────────────────────
// Drives the node badges (complete/current/upcoming) and the road highlight —
// NOT Pip's position, which tracks pass probability instead (see below).

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

// ─── Pip's position from pass probability ────────────────────────────────────
// Pip walks continuously along the same cubic-bezier segments used for
// ROAD_PATH, so 0% sits exactly at the Start node and 100% at Test Ready.

function cubicBezierPoint(
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y,
  };
}

const ROAD_CURVES = [
  { p0: NODES[0], c1: { x: 100 + LABEL_MARGIN, y: 252 }, c2: { x: 52 + LABEL_MARGIN, y: 238 }, p1: NODES[1] },
  { p0: NODES[1], c1: { x:  52 + LABEL_MARGIN, y: 192 }, c2: { x: 148 + LABEL_MARGIN, y: 172 }, p1: NODES[2] },
  { p0: NODES[2], c1: { x: 148 + LABEL_MARGIN, y: 132 }, c2: { x:  52 + LABEL_MARGIN, y: 115 }, p1: NODES[3] },
  { p0: NODES[3], c1: { x:  52 + LABEL_MARGIN, y:  72 }, c2: { x: 100 + LABEL_MARGIN, y:  52 }, p1: NODES[4] },
] as const;

function pointAtPassProbability(pct: number): { x: number; y: number } {
  const clamped  = Math.max(0, Math.min(100, pct));
  const scaled   = (clamped / 100) * ROAD_CURVES.length;
  const segIndex = Math.min(ROAD_CURVES.length - 1, Math.floor(scaled));
  const t        = scaled - segIndex;
  const seg      = ROAD_CURVES[segIndex]!;
  return cubicBezierPoint(seg.p0, seg.c1, seg.c2, seg.p1, t);
}

// ─── RoadmapPath ─────────────────────────────────────────────────────────────

interface RoadmapPathProps {
  progress: UserProgress | null;
  passProbability: number;
  pipMood?: PipMood;
  width: number;
  height?: number;
}

export default function RoadmapPath({ progress, passProbability, pipMood = 'happy', width, height: heightProp }: RoadmapPathProps) {
  const current    = computeProgress(progress);
  const height     = heightProp ?? Math.round(width * VBOX_H / VBOX_W);
  const scaleX     = width  / VBOX_W;
  const scaleY     = height / VBOX_H;

  // Pulsing glow for current node
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] });
  const glowScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.35] });

  const pipPoint    = pointAtPassProbability(passProbability);
  const pipPixelX   = pipPoint.x * scaleX;
  const pipPixelY   = pipPoint.y * scaleY;
  const pipSize     = 28;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VBOX_W} ${VBOX_H}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.navy} stopOpacity="1" />
            <Stop offset="100%" stopColor="#1E1B4B" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Road tarmac */}
        <Path
          d={ROAD_PATH}
          stroke="url(#roadGrad)"
          strokeWidth={ROAD_W}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Road centre line — dashed amber */}
        <Path
          d={ROAD_PATH}
          stroke={Colors.amber}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="8 6"
          fill="none"
          opacity={0.7}
        />

        {/* Completed road segment highlight */}
        {current > 0 && (
          <Path
            d={ROAD_PATH}
            stroke={Colors.indigo}
            strokeWidth={ROAD_W * 0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${current * 60} 999`}
            opacity={0.35}
          />
        )}

        {/* Milestone nodes */}
        {NODES.map((node, i) => {
          const state = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
          const fill  = state === 'complete' ? Colors.indigo : state === 'current' ? '#FFFFFF' : '#F3F4F6';
          const stroke = state === 'complete' ? Colors.indigo : state === 'current' ? Colors.indigo : Colors.border;
          const opacity = state === 'upcoming' ? 0.55 : 1;

          return (
            <G key={i} opacity={opacity}>
              {/* Node circle */}
              <Circle
                cx={node.x}
                cy={node.y}
                r={NODE_R}
                fill={fill}
                stroke={stroke}
                strokeWidth={state === 'current' ? 2.5 : 1.5}
              />
              {/* Emoji / checkmark */}
              <SvgText
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fontSize={state === 'complete' ? 11 : 14}
                fill={state === 'complete' ? '#FFFFFF' : '#111827'}
              >
                {state === 'complete' ? '✓' : node.emoji}
              </SvgText>
              {/* Label — always offset to a side so it never sits on top of the icon */}
              <SvgText
                x={node.x >= CENTER_X ? node.x + NODE_R + 4 : node.x - NODE_R - 4}
                y={node.y + 4}
                textAnchor={node.x >= CENTER_X ? 'start' : 'end'}
                fontSize={7.5}
                fontWeight="700"
                fill={state === 'current' ? Colors.indigo : state === 'complete' ? Colors.indigo : Colors.mutedText}
                letterSpacing={0.3}
              >
                {node.short}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Pulsing glow ring around current node (native Animated, overlaid) */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            left:    pipPixelX - NODE_R * scaleX * 0.8,
            top:     pipPixelY - NODE_R * scaleY * 0.8,
            width:   NODE_R * scaleX * 1.6,
            height:  NODE_R * scaleY * 1.6,
            borderRadius: NODE_R * scaleX * 0.8,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Pip avatar at current position */}
      <View
        style={[
          styles.pipWrap,
          {
            left: pipPixelX - pipSize / 2,
            top:  pipPixelY - Math.round(pipSize * 1.2) / 2 - 2,
          },
        ]}
      >
        <Pip size={pipSize} mood={pipMood} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: Colors.indigo,
  },
  pipWrap: {
    position: 'absolute',
  },
});
