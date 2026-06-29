import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

export type PipMood = 'happy' | 'celebrate' | 'sympathetic' | 'curious' | 'wave';

interface PipProps {
  size?: number;
  mood?: PipMood;
}

const SPINE_DARK = '#312E81';
const SPINE_TIP  = '#F59E0B';
const BODY       = '#4F46E5';
const FACE       = '#EEF2FF';
const EYE_AMBER  = '#F59E0B';
const PUPIL      = '#111827';
const BELLY      = '#818CF8';
const FOOT       = '#312E81';
const MOUTH_COL  = '#374151';

export function Pip({ size = 100, mood = 'happy' }: PipProps) {
  // viewBox is 100 × 120; height is proportionally taller than width
  const h = Math.round(size * 1.2);

  function renderEye(cx: number, cy: number) {
    if (mood === 'celebrate') {
      // Sparkle / star eye
      return (
        <G>
          <Circle cx={cx} cy={cy} r={5.5} fill={EYE_AMBER} />
          <Path
            d={`M${cx},${cy - 4.5} L${cx},${cy + 4.5} M${cx - 4.5},${cy} L${cx + 4.5},${cy}`}
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </G>
      );
    }
    if (mood === 'sympathetic') {
      // Soft, slightly droopy eye
      return (
        <G>
          <Circle cx={cx} cy={cy} r={5.5} fill={EYE_AMBER} />
          <Circle cx={cx} cy={cy} r={3.2} fill={PUPIL} />
          <Circle cx={cx + 1} cy={cy - 1.5} r={1.2} fill="#FFFFFF" />
          {/* Droopy eyelid line */}
          <Path
            d={`M${cx - 5},${cy - 2} Q${cx},${cy - 5} ${cx + 5},${cy - 2}`}
            stroke={FACE}
            strokeWidth="2.5"
            fill="none"
          />
        </G>
      );
    }
    return (
      <G>
        <Circle cx={cx} cy={cy} r={5.5} fill={EYE_AMBER} />
        <Circle cx={cx} cy={cy} r={3.2} fill={PUPIL} />
        <Circle cx={cx + 1} cy={cy - 1.5} r={1.2} fill="#FFFFFF" />
      </G>
    );
  }

  function renderMouth() {
    switch (mood) {
      case 'celebrate':
        return <Path d="M42,68 Q50,76 58,68" stroke={MOUTH_COL} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
      case 'sympathetic':
        return <Path d="M44,72 Q50,68 56,72" stroke={MOUTH_COL} strokeWidth="2" fill="none" strokeLinecap="round" />;
      case 'curious':
        return <Path d="M45,69 Q51,73 55,69" stroke={MOUTH_COL} strokeWidth="2" fill="none" strokeLinecap="round" />;
      default: // happy, wave
        return <Path d="M44,68 Q50,74 56,68" stroke={MOUTH_COL} strokeWidth="2" fill="none" strokeLinecap="round" />;
    }
  }

  return (
    <Svg width={size} height={h} viewBox="0 0 100 120">
      {/* ── Spines (behind head) ───────────────────────────────────────────── */}
      <Polygon points="24,44 33,38 16,12"  fill={SPINE_DARK} />
      <Polygon points="20,26 25,20 16,12"  fill={SPINE_TIP} />

      <Polygon points="35,32 43,30 36,4"   fill={SPINE_DARK} />
      <Polygon points="37,16 42,14 36,4"   fill={SPINE_TIP} />

      <Polygon points="46,30 54,30 50,2"   fill={SPINE_DARK} />
      <Polygon points="47,13 53,13 50,2"   fill={SPINE_TIP} />

      <Polygon points="57,30 65,32 64,4"   fill={SPINE_DARK} />
      <Polygon points="58,14 63,16 64,4"   fill={SPINE_TIP} />

      <Polygon points="67,38 76,44 84,12"  fill={SPINE_DARK} />
      <Polygon points="75,26 80,20 84,12"  fill={SPINE_TIP} />

      {/* ── Arms (wave / celebrate) ────────────────────────────────────────── */}
      {mood === 'celebrate' && (
        <Path d="M34,86 Q22,76 18,64" stroke={BODY} strokeWidth="9" strokeLinecap="round" fill="none" />
      )}
      {(mood === 'wave' || mood === 'celebrate') && (
        <Path d="M66,86 Q78,76 82,64" stroke={BODY} strokeWidth="9" strokeLinecap="round" fill="none" />
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <Ellipse cx="50" cy="92" rx="22" ry="18" fill={BODY} />
      <Ellipse cx="50" cy="93" rx="13" ry="11" fill={BELLY} />

      {/* ── Head ──────────────────────────────────────────────────────────── */}
      <Circle cx="50" cy="54" r="28" fill={BODY} />

      {/* Ear bumps */}
      <Circle cx="25" cy="46" r="7" fill={BODY} />
      <Circle cx="75" cy="46" r="7" fill={BODY} />

      {/* Face plate */}
      <Circle cx="50" cy="56" r="20" fill={FACE} />

      {/* ── Eyes ──────────────────────────────────────────────────────────── */}
      {renderEye(43, 53)}
      {renderEye(57, 53)}

      {/* ── Nose ──────────────────────────────────────────────────────────── */}
      <Ellipse cx="50" cy="61" rx="3" ry="2.5" fill={PUPIL} />
      <Circle cx="49" cy="60.2" r="0.8" fill="#FFFFFF" />

      {/* ── Mouth ─────────────────────────────────────────────────────────── */}
      {renderMouth()}

      {/* ── Feet ──────────────────────────────────────────────────────────── */}
      <Ellipse cx="38" cy="108" rx="11" ry="5.5" fill={FOOT} />
      <Ellipse cx="62" cy="108" rx="11" ry="5.5" fill={FOOT} />
    </Svg>
  );
}
