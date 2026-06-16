import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SIGN_IMAGES from '@/src/signImages';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import {
  RoadSign,
  SignCategory,
  QuizQuestion,
  roadSigns,
  searchRoadSigns,
  generateQuiz,
} from '@clearpass/content';

type ViewMode = 'grid' | 'detail' | 'quiz';

const SIGN_RED = '#CC0000';
const SIGN_BLUE = '#003399';
const SIGN_AMBER = '#FF8C00';

const CATEGORY_CONFIGS: Array<{ label: string; value: SignCategory | 'all'; colour: string }> = [
  { label: 'All', value: 'all', colour: '#6B7280' },
  { label: 'Warning', value: SignCategory.Warning, colour: SIGN_RED },
  { label: 'Regulatory', value: SignCategory.Regulatory, colour: SIGN_RED },
  { label: 'Mandatory', value: SignCategory.Mandatory, colour: SIGN_BLUE },
  { label: 'Information', value: SignCategory.Information, colour: SIGN_BLUE },
  { label: 'Direction', value: SignCategory.Direction, colour: '#00703C' },
  { label: 'Road Works', value: SignCategory.RoadWorks, colour: SIGN_AMBER },
];

const CARD_W = 112;
const GRID_SIGN = 44;
const DETAIL_SIGN = 110;
const QUIZ_SIGN = 90;

// ── Warning sign SVG symbols ──────────────────────────────────────────────────

function WarnSymbol({ id }: { id: string }) {
  const f = '#111111';
  switch (id) {
    case 'crossroads':
      return (
        <G>
          <Rect x="46" y="37" width="8" height="38" fill={f} rx="1" />
          <Rect x="27" y="52" width="46" height="8" fill={f} rx="1" />
        </G>
      );
    case 't-junction':
      return (
        <G>
          <Rect x="27" y="53" width="46" height="8" fill={f} rx="1" />
          <Rect x="46" y="38" width="8" height="23" fill={f} rx="1" />
        </G>
      );
    case 'side-road-right':
      return (
        <G>
          <Rect x="46" y="37" width="8" height="39" fill={f} rx="1" />
          <Path d="M54 58 Q54 50 62 50 L75 50" stroke={f} strokeWidth="7" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'staggered-junction':
      return (
        <G>
          <Rect x="46" y="37" width="8" height="39" fill={f} rx="1" />
          <Rect x="27" y="44" width="19" height="7" fill={f} rx="1" />
          <Rect x="54" y="62" width="19" height="7" fill={f} rx="1" />
        </G>
      );
    case 'roundabout-warning':
      return (
        <G>
          <Circle cx="50" cy="58" r="13" stroke={f} strokeWidth="6" fill="none" />
          <Path d="M50 45 L45 53 L55 53 Z" fill={f} />
          <Path d="M63 58 L55 54 L55 62 Z" fill={f} />
          <Path d="M37 58 L45 62 L45 54 Z" fill={f} />
        </G>
      );
    case 'sharp-bend-left':
      return (
        <G>
          <Path d="M58 76 L58 54 Q58 38 44 38 Q30 38 30 52" stroke={f} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 49 L30 41 L38 52" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'sharp-bend-right':
      return (
        <G>
          <Path d="M42 76 L42 54 Q42 38 56 38 Q70 38 70 52" stroke={f} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M78 49 L70 41 L62 52" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'double-bend-left':
      return (
        <G>
          <Path d="M54 76 L54 64 Q54 54 44 54 Q34 54 34 45 Q34 37 43 37 L46 37" stroke={f} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M40 30 L48 38 L40 46" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'steep-descent':
      return (
        <G>
          <Path d="M33 42 L65 70" stroke={f} strokeWidth="6" strokeLinecap="round" />
          <Path d="M54 77 L65 70 L58 59" fill={f} />
          <SvgText x="38" y="74" fontSize="13" fontWeight="bold" fill={f} textAnchor="middle">10%</SvgText>
        </G>
      );
    case 'steep-ascent':
      return (
        <G>
          <Path d="M33 70 L65 42" stroke={f} strokeWidth="6" strokeLinecap="round" />
          <Path d="M54 35 L65 42 L58 53" fill={f} />
          <SvgText x="38" y="74" fontSize="13" fontWeight="bold" fill={f} textAnchor="middle">10%</SvgText>
        </G>
      );
    case 'uneven-road':
      return (
        <G>
          <Path d="M26 64 L34 50 L42 60 L50 46 L58 58 L66 50 L74 62" stroke={f} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'road-narrows-right':
      return (
        <G>
          <Line x1="34" y1="76" x2="34" y2="38" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M66 76 L66 62 L48 38" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'road-narrows-both':
      return (
        <G>
          <Path d="M32 76 L32 62 L44 38" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M68 76 L68 62 L56 38" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'slippery-road':
      return (
        <G>
          <Rect x="34" y="44" width="26" height="14" fill={f} rx="3" />
          <Rect x="40" y="37" width="14" height="11" fill={f} rx="2" />
          <Circle cx="40" cy="59" r="5" fill={f} />
          <Circle cx="56" cy="59" r="5" fill={f} />
          <Path d="M26 70 Q34 66 42 71 Q50 66 58 71 Q66 66 74 70" stroke={f} strokeWidth="4" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'risk-of-grounding':
      return (
        <G>
          <Path d="M24 66 L37 66 Q50 78 63 66 L76 66" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Rect x="34" y="52" width="32" height="13" fill={f} rx="3" />
          <Rect x="40" y="44" width="20" height="12" fill={f} rx="2" />
        </G>
      );
    case 'pedestrians-road':
      return (
        <G>
          <Circle cx="50" cy="40" r="6" fill={f} />
          <Line x1="50" y1="46" x2="50" y2="62" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M40 54 L50 50 L60 54" stroke={f} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Line x1="50" y1="62" x2="44" y2="76" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="50" y1="62" x2="56" y2="76" stroke={f} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'school-crossing':
      return (
        <G>
          <Circle cx="40" cy="40" r="5" fill={f} />
          <Line x1="40" y1="45" x2="40" y2="60" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Path d="M32 53 L40 50 L48 53" stroke={f} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Line x1="40" y1="60" x2="35" y2="73" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="40" y1="60" x2="45" y2="73" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Circle cx="60" cy="43" r="4" fill={f} />
          <Line x1="60" y1="47" x2="60" y2="59" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M53 53 L60 51 L67 53" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Line x1="60" y1="59" x2="56" y2="70" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="60" y1="59" x2="64" y2="70" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="40" y1="45" x2="60" y2="47" stroke={f} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'children':
      return (
        <G>
          <Circle cx="38" cy="41" r="5" fill={f} />
          <Line x1="38" y1="46" x2="37" y2="60" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M30 52 L38 49 L46 53" stroke={f} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Line x1="37" y1="60" x2="33" y2="72" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="37" y1="60" x2="43" y2="72" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Circle cx="60" cy="43" r="4.5" fill={f} />
          <Line x1="60" y1="48" x2="60" y2="60" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M53 54 L60 51 L67 54" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Line x1="60" y1="60" x2="56" y2="72" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="60" y1="60" x2="64" y2="72" stroke={f} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'elderly-people':
      return (
        <G>
          <Circle cx="50" cy="39" r="6" fill={f} />
          <Path d="M50 45 L48 62" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M40 53 L50 50 L57 55" stroke={f} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Line x1="48" y1="62" x2="43" y2="75" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="48" y1="62" x2="54" y2="75" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M57 55 L63 75" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
        </G>
      );
    case 'horse-riders':
      return (
        <G>
          <Ellipse cx="49" cy="60" rx="17" ry="9" fill={f} />
          <Path d="M66 55 Q74 49 72 41 Q70 37 64 39 Q60 41 61 47 L64 55" fill={f} />
          <Line x1="36" y1="68" x2="33" y2="77" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="43" y1="69" x2="41" y2="78" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="56" y1="69" x2="54" y2="78" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="62" y1="68" x2="65" y2="77" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Ellipse cx="51" cy="49" rx="6" ry="8" fill={f} />
          <Circle cx="51" cy="40" r="5" fill={f} />
        </G>
      );
    case 'wild-animals':
      return (
        <G>
          <Ellipse cx="49" cy="62" rx="16" ry="10" fill={f} />
          <Path d="M56 53 L58 46 L62 41 L59 39 L56 42 L53 39 L53 45 L51 52" fill={f} />
          <Path d="M61 41 L63 35 L67 31" stroke={f} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M63 37 L66 34" stroke={f} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M56 42 L54 36 L51 31" stroke={f} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M54 37 L51 34" stroke={f} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Line x1="38" y1="71" x2="36" y2="79" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="44" y1="72" x2="43" y2="79" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="54" y1="72" x2="53" y2="79" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="60" y1="71" x2="62" y2="79" stroke={f} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'farm-animals':
      return (
        <G>
          <Ellipse cx="48" cy="59" rx="17" ry="11" fill={f} />
          <Ellipse cx="65" cy="54" rx="9" ry="7" fill={f} />
          <Ellipse cx="73" cy="56" rx="4" ry="3" fill={f} />
          <Path d="M64 47 L61 41 L67 44" fill={f} />
          <Line x1="36" y1="69" x2="34" y2="78" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="43" y1="70" x2="42" y2="78" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="54" y1="70" x2="53" y2="78" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="60" y1="69" x2="62" y2="78" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Path d="M31 59 Q25 54 28 47" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'falling-rocks':
      return (
        <G>
          <Path d="M30 38 L30 76" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M26 76 L36 76" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Ellipse cx="47" cy="49" rx="7" ry="6" fill={f} />
          <Ellipse cx="60" cy="62" rx="5.5" ry="5" fill={f} />
          <Ellipse cx="52" cy="73" rx="4" ry="3.5" fill={f} />
          <Line x1="47" y1="42" x2="45" y2="36" stroke={f} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="60" y1="56" x2="58" y2="50" stroke={f} strokeWidth="2.5" strokeLinecap="round" />
        </G>
      );
    case 'risk-of-ice':
      return (
        <G>
          <Line x1="50" y1="36" x2="50" y2="76" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="29" y1="46" x2="71" y2="66" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="71" y1="46" x2="29" y2="66" stroke={f} strokeWidth="4.5" strokeLinecap="round" />
          <Line x1="44" y1="38" x2="56" y2="38" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="44" y1="74" x2="56" y2="74" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="24" y1="51" x2="24" y2="60" stroke={f} strokeWidth="3" strokeLinecap="round" />
          <Line x1="76" y1="51" x2="76" y2="60" stroke={f} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'traffic-signals':
      return (
        <G>
          <Rect x="40" y="36" width="20" height="42" fill={f} rx="4" />
          <Circle cx="50" cy="45" r="5.5" fill="#CC0000" />
          <Circle cx="50" cy="57" r="5.5" fill="#FF8C00" />
          <Circle cx="50" cy="69" r="5.5" fill="#00AA00" />
          <Line x1="50" y1="78" x2="50" y2="84" stroke={f} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'level-crossing-barriers':
      return (
        <G>
          <Line x1="30" y1="70" x2="70" y2="70" stroke={f} strokeWidth="4" />
          <Line x1="37" y1="64" x2="37" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="50" y1="64" x2="50" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="63" y1="64" x2="63" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="29" y1="55" x2="29" y2="42" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="71" y1="55" x2="71" y2="42" stroke={f} strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="29" y1="55" x2="52" y2="55" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Line x1="71" y1="55" x2="48" y2="55" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Circle cx="50" cy="39" r="5" fill="#CC0000" />
        </G>
      );
    case 'level-crossing-no-barriers':
      return (
        <G>
          <Line x1="28" y1="70" x2="72" y2="70" stroke={f} strokeWidth="4" />
          <Line x1="35" y1="64" x2="35" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="50" y1="64" x2="50" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="65" y1="64" x2="65" y2="76" stroke={f} strokeWidth="3" />
          <Line x1="37" y1="38" x2="63" y2="60" stroke={f} strokeWidth="5.5" strokeLinecap="round" />
          <Line x1="63" y1="38" x2="37" y2="60" stroke={f} strokeWidth="5.5" strokeLinecap="round" />
        </G>
      );
    case 'level-crossing-countdown-3':
    case 'level-crossing-countdown-2':
    case 'level-crossing-countdown-1': {
      const count = id.endsWith('3') ? 3 : id.endsWith('2') ? 2 : 1;
      const xs = count === 3 ? [28, 42, 56] : count === 2 ? [35, 49] : [42];
      return (
        <G>
          {xs.map((x, i) => (
            <Line key={i} x1={x} y1="76" x2={x + 20} y2="38" stroke={f} strokeWidth="6.5" strokeLinecap="round" />
          ))}
        </G>
      );
    }
    case 'humpback-bridge':
      return (
        <G>
          <Line x1="24" y1="72" x2="38" y2="72" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Line x1="62" y1="72" x2="76" y2="72" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M38 72 Q50 38 62 72" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Line x1="38" y1="72" x2="38" y2="80" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="62" y1="72" x2="62" y2="80" stroke={f} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'quayside':
      return (
        <G>
          <Rect x="40" y="38" width="20" height="26" fill={f} rx="1" />
          <Rect x="32" y="63" width="36" height="6" fill={f} rx="1" />
          <Path d="M26 74 Q34 70 42 74 Q50 70 58 74 Q66 70 74 74" stroke={f} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Path d="M28 79 Q36 75 44 79 Q52 75 60 79 Q68 75 72 79" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'two-way-traffic-ahead':
      return (
        <G>
          <Line x1="41" y1="72" x2="41" y2="50" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Polygon points="34,52 41,38 48,52" fill={f} />
          <Line x1="59" y1="40" x2="59" y2="62" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Polygon points="52,60 59,74 66,60" fill={f} />
        </G>
      );
    case 'ford':
      return (
        <G>
          <SvgText x="50" y="62" fontSize="20" fontWeight="bold" fill={f} textAnchor="middle">FORD</SvgText>
          <Path d="M28 70 Q37 66 46 70 Q55 66 64 70 Q69 66 72 70" stroke={f} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'tunnel':
      return (
        <G>
          <Path d="M28 74 L28 58 Q28 38 50 38 Q72 38 72 58 L72 74" stroke={f} strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <Line x1="28" y1="74" x2="72" y2="74" stroke={f} strokeWidth="4" />
          <Line x1="45" y1="60" x2="45" y2="74" stroke={f} strokeWidth="3" />
          <Line x1="55" y1="60" x2="55" y2="74" stroke={f} strokeWidth="3" />
        </G>
      );
    case 'low-aircraft':
      return (
        <G>
          <Path d="M28 56 L72 44" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M44 52 L37 37 L53 49" fill={f} />
          <Path d="M59 48 L55 62 L69 45" fill={f} />
          <Path d="M70 44 L78 37 L73 44" fill={f} />
          <Path d="M28 56 L20 63 L29 57" fill={f} />
        </G>
      );
    case 'opening-bridge':
      return (
        <G>
          <Path d="M25 69 L41 69 L36 50" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M75 69 L59 69 L64 50" stroke={f} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="36" y1="50" x2="50" y2="42" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="64" y1="50" x2="50" y2="42" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M30 76 Q38 72 46 76 Q54 72 62 76 Q70 72 72 76" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'road-works-ahead':
      return (
        <G>
          <Circle cx="50" cy="40" r="7" fill={f} />
          <Line x1="50" y1="47" x2="50" y2="62" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M41 54 L50 51 L59 54" stroke={f} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Line x1="50" y1="62" x2="44" y2="75" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="50" y1="62" x2="56" y2="75" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M38 70 L44 60 L62 60 L68 70" stroke={f} strokeWidth="3" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'men-at-work':
      return (
        <G>
          <Circle cx="50" cy="40" r="6" fill={f} />
          <Line x1="50" y1="46" x2="50" y2="61" stroke={f} strokeWidth="5" strokeLinecap="round" />
          <Path d="M40 53 L50 50 L60 53" stroke={f} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Line x1="50" y1="61" x2="44" y2="74" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Line x1="50" y1="61" x2="56" y2="74" stroke={f} strokeWidth="4" strokeLinecap="round" />
          <Path d="M58 50 L68 56 L62 56 L66 76 L54 76" stroke={f} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'loose-chippings':
      return (
        <G>
          <Ellipse cx="40" cy="50" rx="5" ry="4" fill={f} />
          <Ellipse cx="55" cy="44" rx="4" ry="3.5" fill={f} />
          <Ellipse cx="65" cy="54" rx="4.5" ry="4" fill={f} />
          <Ellipse cx="44" cy="63" rx="3.5" ry="3" fill={f} />
          <Ellipse cx="58" cy="68" rx="4" ry="3" fill={f} />
          <Line x1="40" y1="44" x2="38" y2="37" stroke={f} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="55" y1="38" x2="53" y2="31" stroke={f} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="65" y1="48" x2="67" y2="41" stroke={f} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="30" y1="76" x2="70" y2="76" stroke={f} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'road-works-lights':
      return (
        <G>
          <Rect x="40" y="36" width="20" height="42" fill={f} rx="4" />
          <Circle cx="50" cy="45" r="5.5" fill="#CC0000" />
          <Circle cx="50" cy="57" r="5.5" fill="#FF8C00" />
          <Circle cx="50" cy="69" r="5.5" fill="#00AA00" />
        </G>
      );
    default:
      return null;
  }
}

function TriangleSignSVG({ id, size, fillColor }: { id: string; size: number; fillColor: string }) {
  return (
    <Svg width={size} height={size * 0.88} viewBox="0 0 100 88">
      <Polygon
        points="50,4 96,85 4,85"
        fill={fillColor}
        stroke="#CC0000"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <WarnSymbol id={id} />
    </Svg>
  );
}

// ── Prohibition sign SVG symbols ─────────────────────────────────────────────

function ProhibSymbol({ id }: { id: string }) {
  const BK = '#111111';
  const RD = '#CC0000';
  const GY = '#888888';

  switch (id) {
    case 'speed-20':
    case 'speed-30':
    case 'speed-40':
    case 'speed-50':
    case 'speed-60':
    case 'speed-70': {
      const num = id.split('-')[1];
      return (
        <SvgText x="50" y="67" fontSize="40" fontWeight="bold" fill={BK} textAnchor="middle">
          {num}
        </SvgText>
      );
    }
    case 'national-speed-limit':
      return (
        <Line x1="74" y1="20" x2="26" y2="80" stroke={BK} strokeWidth="9" strokeLinecap="round" />
      );
    case 'end-speed-restriction':
      return (
        <Line x1="74" y1="20" x2="26" y2="80" stroke={GY} strokeWidth="9" strokeLinecap="round" />
      );
    case 'no-entry':
      return <Rect x="14" y="43" width="72" height="14" fill="#FFFFFF" rx="2" />;
    case 'no-vehicles':
      return (
        <G>
          <Rect x="26" y="50" width="48" height="16" fill={BK} rx="5" />
          <Rect x="34" y="38" width="28" height="16" fill={BK} rx="3" />
          <Circle cx="34" cy="67" r="7" fill={BK} />
          <Circle cx="66" cy="67" r="7" fill={BK} />
          <Path d="M74,18 L26,82" stroke={RD} strokeWidth="9" strokeLinecap="round" />
        </G>
      );
    case 'no-motor-vehicles':
      return (
        <G>
          <Circle cx="30" cy="65" r="11" stroke={BK} strokeWidth="4" fill="none" />
          <Circle cx="70" cy="65" r="11" stroke={BK} strokeWidth="4" fill="none" />
          <Path d="M30,65 L46,46 L56,58 L70,65" stroke={BK} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <Path d="M46,46 L54,40 L62,46" stroke={BK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Line x1="64" y1="40" x2="70" y2="36" stroke={BK} strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="64" y1="40" x2="70" y2="44" stroke={BK} strokeWidth="3.5" strokeLinecap="round" />
          <Line x1="44" y1="58" x2="58" y2="58" stroke={BK} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'no-cycling':
      return (
        <G>
          <Circle cx="33" cy="63" r="12" stroke={BK} strokeWidth="4" fill="none" />
          <Circle cx="67" cy="63" r="12" stroke={BK} strokeWidth="4" fill="none" />
          <Path d="M33,63 L49,42 L67,63" stroke={BK} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <Line x1="33" y1="63" x2="67" y2="63" stroke={BK} strokeWidth="3" />
          <Circle cx="50" cy="63" r="4" fill={BK} />
          <Line x1="43" y1="42" x2="55" y2="42" stroke={BK} strokeWidth="4" strokeLinecap="round" />
          <Line x1="67" y1="63" x2="61" y2="44" stroke={BK} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'no-right-turn':
      return (
        <G>
          <Path d="M42,78 L42,50 Q42,28 64,28" stroke={BK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Polygon points="56,20 70,28 56,36" fill={BK} />
          <Path d="M74,18 L26,82" stroke={RD} strokeWidth="9" strokeLinecap="round" />
        </G>
      );
    case 'no-left-turn':
      return (
        <G>
          <Path d="M58,78 L58,50 Q58,28 36,28" stroke={BK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Polygon points="44,20 30,28 44,36" fill={BK} />
          <Path d="M74,18 L26,82" stroke={RD} strokeWidth="9" strokeLinecap="round" />
        </G>
      );
    case 'no-u-turns':
      return (
        <G>
          <Path d="M60,78 L60,42 Q60,22 40,22 Q22,22 22,42 L22,56" stroke={BK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Polygon points="16,52 22,64 28,52" fill={BK} />
          <Path d="M74,18 L26,82" stroke={RD} strokeWidth="9" strokeLinecap="round" />
        </G>
      );
    case 'no-overtaking':
      return (
        <G>
          <Rect x="14" y="44" width="30" height="16" fill={BK} rx="4" />
          <Rect x="20" y="34" width="16" height="14" fill={BK} rx="2" />
          <Circle cx="20" cy="61" r="6" fill={BK} />
          <Circle cx="38" cy="61" r="6" fill={BK} />
          <Rect x="48" y="48" width="30" height="14" fill={GY} rx="4" />
          <Rect x="54" y="39" width="16" height="13" fill={GY} rx="2" />
          <Circle cx="54" cy="63" r="5.5" fill={GY} />
          <Circle cx="72" cy="63" r="5.5" fill={GY} />
          <Path d="M74,18 L26,82" stroke={RD} strokeWidth="9" strokeLinecap="round" />
        </G>
      );
    default:
      return null;
  }
}

function RegCircleSVG({ id, size, fillColor, borderColor }: { id: string; size: number; fillColor: string; borderColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="44" fill={fillColor} stroke={borderColor} strokeWidth="8" />
      <ProhibSymbol id={id} />
    </Svg>
  );
}

// ── Mandatory sign SVG symbols ───────────────────────────────────────────────

function MandatorySymbol({ id }: { id: string }) {
  const W = '#FFFFFF';

  switch (id) {
    case 'turn-left-ahead':
      return (
        <G>
          <Path d="M52,82 L52,46 Q52,26 32,26" stroke={W} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Polygon points="20,26 34,17 34,35" fill={W} />
        </G>
      );
    case 'turn-right-ahead':
      return (
        <G>
          <Path d="M48,82 L48,46 Q48,26 68,26" stroke={W} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Polygon points="80,26 66,17 66,35" fill={W} />
        </G>
      );
    case 'keep-left':
      return (
        <G>
          {/* bollard hint */}
          <Circle cx="50" cy="42" r="5" fill={W} />
          {/* arrow swinging right-to-left around bollard, ending downward */}
          <Path d="M70,22 Q76,44 58,60 Q52,66 52,80" stroke={W} strokeWidth="8" fill="none" strokeLinecap="round" />
          <Polygon points="44,74 52,84 60,74" fill={W} />
        </G>
      );
    case 'keep-right':
      return (
        <G>
          <Circle cx="50" cy="42" r="5" fill={W} />
          <Path d="M30,22 Q24,44 42,60 Q48,66 48,80" stroke={W} strokeWidth="8" fill="none" strokeLinecap="round" />
          <Polygon points="56,74 48,84 40,74" fill={W} />
        </G>
      );
    case 'mini-roundabout':
      return (
        <G>
          <Circle cx="50" cy="54" r="18" stroke={W} strokeWidth="6" fill="none" />
          {/* Three arrowheads showing clockwise flow */}
          <Polygon points="50,36 44,46 56,46" fill={W} />
          <Polygon points="68,54 58,48 58,60" fill={W} />
          <Polygon points="32,54 42,60 42,48" fill={W} />
        </G>
      );
    case 'cycles-only':
      return (
        <G>
          <Circle cx="33" cy="64" r="12" stroke={W} strokeWidth="4" fill="none" />
          <Circle cx="67" cy="64" r="12" stroke={W} strokeWidth="4" fill="none" />
          <Path d="M33,64 L49,43 L67,64" stroke={W} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <Line x1="33" y1="64" x2="67" y2="64" stroke={W} strokeWidth="3" />
          <Circle cx="50" cy="64" r="4" fill={W} />
          <Line x1="43" y1="43" x2="55" y2="43" stroke={W} strokeWidth="4" strokeLinecap="round" />
          <Line x1="67" y1="64" x2="61" y2="45" stroke={W} strokeWidth="4" strokeLinecap="round" />
        </G>
      );
    case 'pedestrians-only':
      return (
        <G>
          <Circle cx="50" cy="29" r="8" fill={W} />
          <Line x1="50" y1="37" x2="50" y2="59" stroke={W} strokeWidth="7" strokeLinecap="round" />
          <Path d="M38,50 L50,46 L62,50" stroke={W} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Line x1="50" y1="59" x2="43" y2="77" stroke={W} strokeWidth="6" strokeLinecap="round" />
          <Line x1="50" y1="59" x2="57" y2="77" stroke={W} strokeWidth="6" strokeLinecap="round" />
        </G>
      );
    case 'min-speed-30':
      return (
        <SvgText x="50" y="67" fontSize="40" fontWeight="bold" fill={W} textAnchor="middle">
          30
        </SvgText>
      );
    default:
      return null;
  }
}

function MandatoryCircleSVG({ id, size }: { id: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="#003399" />
      <MandatorySymbol id={id} />
    </Svg>
  );
}

// ── Give Way sign ────────────────────────────────────────────────────────────

function GiveWaySVG({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.88} viewBox="0 0 100 88">
      <Polygon
        points="4,4 96,4 50,85"
        fill="#FFFFFF"
        stroke="#CC0000"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <SvgText x="50" y="42" fontSize="13" fontWeight="bold" fill="#CC0000" textAnchor="middle" letterSpacing="1">
        GIVE
      </SvgText>
      <SvgText x="50" y="58" fontSize="13" fontWeight="bold" fill="#CC0000" textAnchor="middle" letterSpacing="1">
        WAY
      </SvgText>
    </Svg>
  );
}

// ── Stop sign ─────────────────────────────────────────────────────────────────

function StopSignSVG({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="29,4 71,4 96,29 96,71 71,96 29,96 4,71 4,29" fill="#CC0000" />
      <Polygon
        points="30,9 70,9 91,30 91,70 70,91 30,91 9,70 9,30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
      />
      <SvgText x="50" y="61" fontSize="22" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" letterSpacing="-0.5">
        STOP
      </SvgText>
    </Svg>
  );
}

// ── Rectangle sign SVGs (Information, Direction, Mandatory, Road Works rects) ─

function RectSignSymbol({ id }: { id: string }) {
  const W = '#FFFFFF';
  const BK = '#111111';
  const RD = '#CC0000';

  switch (id) {

    // ── Information ──────────────────────────────────────────────────────────
    case 'motorway-start':
      return (
        <G>
          <SvgText x="65" y="28" fontSize="12" fontWeight="bold" fill={W} textAnchor="middle" letterSpacing="1">
            MOTORWAY
          </SvgText>
          <SvgText x="65" y="60" fontSize="34" fontWeight="bold" fill={W} textAnchor="middle">M</SvgText>
          <Line x1="20" y1="46" x2="20" y2="66" stroke={W} strokeWidth="3" strokeLinecap="round" />
          <Line x1="12" y1="56" x2="28" y2="56" stroke={W} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'end-motorway':
      return (
        <G>
          <SvgText x="65" y="32" fontSize="13" fontWeight="bold" fill={W} textAnchor="middle">END OF</SvgText>
          <SvgText x="65" y="52" fontSize="13" fontWeight="bold" fill={W} textAnchor="middle">MOTORWAY</SvgText>
          <Line x1="36" y1="62" x2="94" y2="62" stroke={W} strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'lane-closed-overhead':
      return (
        <G>
          <Path d="M22,10 L108,64" stroke={RD} strokeWidth="12" strokeLinecap="round" />
          <Path d="M108,10 L22,64" stroke={RD} strokeWidth="12" strokeLinecap="round" />
        </G>
      );
    case 'parking-place':
      return (
        <SvgText x="65" y="62" fontSize="58" fontWeight="bold" fill={W} textAnchor="middle">P</SvgText>
      );
    case 'no-through-road':
      return (
        <G>
          <Rect x="57" y="26" width="16" height="38" fill={BK} rx="1" />
          <Rect x="43" y="16" width="44" height="12" fill={BK} rx="1" />
        </G>
      );
    case 'tourist-attraction':
      return (
        <SvgText x="65" y="66" fontSize="54" fontStyle="italic" fontWeight="bold" fill={W} textAnchor="middle">
          i
        </SvgText>
      );
    case 'hospital':
      return (
        <G>
          <Rect x="59" y="12" width="12" height="50" fill={W} rx="2" />
          <Rect x="44" y="27" width="42" height="12" fill={W} rx="2" />
        </G>
      );
    case 'camera-ahead':
      return (
        <G>
          <Rect x="24" y="20" width="56" height="30" fill={BK} rx="4" />
          <Circle cx="52" cy="35" r="11" fill={W} />
          <Circle cx="52" cy="35" r="6" fill={BK} />
          <Circle cx="52" cy="35" r="2.5" fill={W} />
          <Rect x="72" y="12" width="12" height="12" fill={BK} rx="2" />
        </G>
      );
    case 'zone-30-entry':
      return (
        <G>
          <SvgText x="65" y="32" fontSize="14" fontWeight="bold" fill={RD} textAnchor="middle" letterSpacing="1">
            ZONE
          </SvgText>
          <SvgText x="65" y="62" fontSize="30" fontWeight="bold" fill={RD} textAnchor="middle">30</SvgText>
        </G>
      );
    case 'red-route':
      return (
        <G>
          <Rect x="18" y="14" width="9" height="48" fill={RD} rx="2" />
          <Rect x="34" y="14" width="9" height="48" fill={RD} rx="2" />
          <SvgText x="82" y="34" fontSize="13" fontWeight="bold" fill={RD} textAnchor="middle">NO</SvgText>
          <SvgText x="82" y="50" fontSize="11" fontWeight="bold" fill={RD} textAnchor="middle">STOPPING</SvgText>
        </G>
      );

    // ── Direction ─────────────────────────────────────────────────────────────
    case 'motorway-direction':
      return (
        <G>
          <SvgText x="52" y="50" fontSize="26" fontWeight="bold" fill={W} textAnchor="middle">M1</SvgText>
          <Line x1="86" y1="56" x2="86" y2="22" stroke={W} strokeWidth="6" strokeLinecap="round" />
          <Polygon points="78,30 86,18 94,30" fill={W} />
        </G>
      );
    case 'primary-route-direction':
      return (
        <G>
          <SvgText x="52" y="50" fontSize="26" fontWeight="bold" fill={W} textAnchor="middle">A1</SvgText>
          <Line x1="86" y1="56" x2="86" y2="22" stroke={W} strokeWidth="6" strokeLinecap="round" />
          <Polygon points="78,30 86,18 94,30" fill={W} />
        </G>
      );
    case 'local-route-direction':
      return (
        <G>
          <SvgText x="52" y="48" fontSize="20" fontWeight="bold" fill={BK} textAnchor="middle">B2345</SvgText>
          <Line x1="86" y1="56" x2="86" y2="22" stroke={BK} strokeWidth="6" strokeLinecap="round" />
          <Polygon points="78,30 86,18 94,30" fill={BK} />
        </G>
      );
    case 'countdown-300':
    case 'countdown-200':
    case 'countdown-100': {
      const n = id === 'countdown-300' ? 3 : id === 'countdown-200' ? 2 : 1;
      const startX = n === 3 ? 14 : n === 2 ? 28 : 44;
      const gap = 36;
      return (
        <G>
          {Array.from({ length: n }, (_, i) => (
            <Line
              key={i}
              x1={startX + i * gap}
              y1="68"
              x2={startX + i * gap + 26}
              y2="8"
              stroke={BK}
              strokeWidth="9"
              strokeLinecap="round"
            />
          ))}
        </G>
      );
    }

    // ── Mandatory rectangles ──────────────────────────────────────────────────
    case 'one-way-traffic':
      return (
        <Path
          d="M14,37 L100,37 M84,24 L100,37 L84,50"
          stroke={W}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'buses-cycles-only':
      return (
        <G>
          <SvgText x="65" y="28" fontSize="13" fontWeight="bold" fill={W} textAnchor="middle">BUSES</SvgText>
          <SvgText x="65" y="46" fontSize="12" fontWeight="bold" fill={W} textAnchor="middle">AND CYCLES</SvgText>
          <SvgText x="65" y="64" fontSize="12" fontWeight="bold" fill={W} textAnchor="middle">ONLY</SvgText>
        </G>
      );
    case 'cycles-pedestrians-segregated':
      return (
        <G>
          <Line x1="65" y1="10" x2="65" y2="66" stroke={W} strokeWidth="2" />
          {/* Bicycle left */}
          <Circle cx="29" cy="52" r="9" stroke={W} strokeWidth="3" fill="none" />
          <Circle cx="51" cy="52" r="9" stroke={W} strokeWidth="3" fill="none" />
          <Path d="M29,52 L40,34 L51,52" stroke={W} strokeWidth="3" fill="none" strokeLinejoin="round" />
          <Line x1="34" y1="34" x2="46" y2="34" stroke={W} strokeWidth="3" strokeLinecap="round" />
          <Line x1="51" y1="52" x2="45" y2="35" stroke={W} strokeWidth="3" strokeLinecap="round" />
          {/* Pedestrian right */}
          <Circle cx="91" cy="20" r="6" fill={W} />
          <Line x1="91" y1="26" x2="91" y2="46" stroke={W} strokeWidth="5" strokeLinecap="round" />
          <Path d="M84,36 L91,33 L98,36" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Line x1="91" y1="46" x2="86" y2="60" stroke={W} strokeWidth="4" strokeLinecap="round" />
          <Line x1="91" y1="46" x2="96" y2="60" stroke={W} strokeWidth="4" strokeLinecap="round" />
        </G>
      );

    // ── Road Works rectangles ─────────────────────────────────────────────────
    case 'contra-flow':
      return (
        <G>
          <Path d="M14,24 L70,24 M58,14 L70,24 L58,34" stroke={BK} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="14" y1="37" x2="116" y2="37" stroke={BK} strokeWidth="2.5" strokeDasharray="6,4" />
          <Path d="M116,50 L60,50 M72,40 L60,50 L72,60" stroke={BK} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'width-restriction-works':
      return (
        <G>
          <SvgText x="65" y="32" fontSize="13" fontWeight="bold" fill={BK} textAnchor="middle">MAX WIDTH</SvgText>
          <SvgText x="65" y="60" fontSize="24" fontWeight="bold" fill={BK} textAnchor="middle">6'6"</SvgText>
        </G>
      );

    default:
      return null;
  }
}

function RectSignSVG({
  id,
  size,
  fillColor,
  borderColor,
}: {
  id: string;
  size: number;
  fillColor: string;
  borderColor: string;
}) {
  const w = Math.round(size * 1.5);
  const h = Math.round(size * 0.85);
  const hasBorder = borderColor !== fillColor;
  return (
    <Svg width={w} height={h} viewBox="0 0 130 74">
      <Rect
        x="0"
        y="0"
        width="130"
        height="74"
        fill={fillColor}
        rx="3"
        stroke={hasBorder ? borderColor : undefined}
        strokeWidth={hasBorder ? '3' : undefined}
      />
      <RectSignSymbol id={id} />
    </Svg>
  );
}

// ── Non-triangle shape renderers (kept for other categories) ──────────────────

function InvTriangleVis({ size, bc, fc, tc, dt }: { size: number; bc: string; fc: string; tc: string; dt?: string }) {
  const bw = Math.max(3, Math.round(size * 0.07));
  const half = Math.floor(size / 2);
  const height = Math.round(size * 0.866);
  const innerHalf = Math.max(2, half - Math.round(bw * 1.2));
  const innerH = Math.max(4, height - Math.round(bw * 2.4));
  return (
    <View style={{ width: size, height: height + 2, alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: half, borderRightWidth: half, borderTopWidth: height, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: bc }} />
      <View style={{ position: 'absolute', bottom: Math.round(bw * 0.7), width: 0, height: 0, borderLeftWidth: innerHalf, borderRightWidth: innerHalf, borderTopWidth: innerH, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: fc }} />
      {dt ? <Text style={{ position: 'absolute', top: bw * 2, fontSize: size * 0.18, fontWeight: '900', color: tc, textAlign: 'center', width: size }} numberOfLines={2}>{dt}</Text> : null}
    </View>
  );
}

function CircleVis({ size, bc, fc, tc, dt }: { size: number; bc: string; fc: string; tc: string; dt?: string }) {
  const bw = Math.max(3, Math.round(size * 0.06));
  const rawLen = dt ? dt.length : 0;
  const fontSize = rawLen > 4 ? size * 0.18 : rawLen > 3 ? size * 0.21 : rawLen > 2 ? size * 0.26 : size * 0.34;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fc, borderWidth: bw, borderColor: bc, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {dt ? <Text style={{ fontSize, fontWeight: '900', color: tc, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{dt}</Text> : null}
    </View>
  );
}

function OctagonVis({ size, bc, fc, tc, dt }: { size: number; bc: string; fc: string; tc: string; dt?: string }) {
  const bw = Math.max(2, Math.round(size * 0.04));
  return (
    <View style={{ width: size, height: size, backgroundColor: fc, borderRadius: size * 0.15, borderWidth: bw, borderColor: bc, alignItems: 'center', justifyContent: 'center' }}>
      {dt ? <Text style={{ fontSize: size * 0.28, fontWeight: '900', color: tc, letterSpacing: -1, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{dt}</Text> : null}
    </View>
  );
}

function RectVis({ size, bc, fc, tc, dt }: { size: number; bc: string; fc: string; tc: string; dt?: string }) {
  const bordered = bc !== fc;
  return (
    <View style={{ width: Math.round(size * 1.5), height: Math.round(size * 0.85), backgroundColor: fc, borderRadius: 4, borderWidth: bordered ? 2 : 0, borderColor: bc, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
      {dt ? <Text style={{ fontSize: size * 0.22, fontWeight: '800', color: tc, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{dt}</Text> : null}
    </View>
  );
}

function SignVisual({ sign, size }: { sign: RoadSign; size: number }) {
  const imgSrc = SIGN_IMAGES[sign.id];
  if (imgSrc) {
    const isRect = sign.shape === 'rectangle';
    const isTriangle = sign.shape === 'triangle';
    const w = isRect ? Math.round(size * 1.5) : size;
    const h = isTriangle ? Math.round(size * 0.88) : isRect ? Math.round(size * 0.85) : size;
    return <Image source={imgSrc} style={{ width: w, height: h }} resizeMode="contain" />;
  }
  const { shape, borderColor: bc, fillColor: fc, textColor: tc, displayText: dt } = sign;
  if (shape === 'triangle')
    return <TriangleSignSVG id={sign.id} size={size} fillColor={fc} />;
  if (sign.category === SignCategory.Regulatory && shape === 'circle')
    return <RegCircleSVG id={sign.id} size={size} fillColor={fc} borderColor={bc} />;
  if (sign.category === SignCategory.Mandatory && shape === 'circle')
    return <MandatoryCircleSVG id={sign.id} size={size} />;
  if (sign.id === 'give-way')
    return <GiveWaySVG size={size} />;
  if (sign.id === 'stop-sign')
    return <StopSignSVG size={size} />;
  if (shape === 'rectangle')
    return <RectSignSVG id={sign.id} size={size} fillColor={fc} borderColor={bc} />;
  if (shape === 'circle')
    return <CircleVis size={size} bc={bc} fc={fc} tc={tc} dt={dt} />;
  return <RectVis size={size} bc={bc} fc={fc} tc={tc} dt={dt} />;
}

// ── Category badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: SignCategory }) {
  const cfg = CATEGORY_CONFIGS.find((c) => c.value === category)!;
  return (
    <View style={[styles.categoryBadge, { backgroundColor: cfg.colour }]}>
      <Text style={styles.categoryBadgeText}>{category.toUpperCase()}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RoadSignsScreen() {
  const theme = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedSign, setSelectedSign] = useState<RoadSign | null>(null);
  const [activeCategory, setActiveCategory] = useState<SignCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizReturnSign, setQuizReturnSign] = useState<RoadSign | null>(null);

  const filteredSigns = useMemo<RoadSign[]>(() => {
    if (searchQuery.trim()) return searchRoadSigns(searchQuery);
    if (activeCategory === 'all') return roadSigns;
    return roadSigns.filter((s) => s.category === activeCategory);
  }, [searchQuery, activeCategory]);

  const openDetail = useCallback((sign: RoadSign) => {
    setSelectedSign(sign);
    setViewMode('detail');
  }, []);

  const startQuiz = useCallback(
    (source: RoadSign[], count: number, returnSign: RoadSign | null) => {
      const questions = generateQuiz(source, count);
      if (questions.length === 0) return;
      setQuizQuestions(questions);
      setQuizIndex(0);
      setQuizSelected(null);
      setQuizScore(0);
      setQuizDone(false);
      setQuizReturnSign(returnSign);
      setViewMode('quiz');
    },
    [],
  );

  const handleQuizAnswer = useCallback(
    (optionIndex: number) => {
      if (quizSelected !== null) return;
      setQuizSelected(optionIndex);
      if (optionIndex === quizQuestions[quizIndex].correctIndex) {
        setQuizScore((s) => s + 1);
      }
    },
    [quizSelected, quizIndex, quizQuestions],
  );

  const handleQuizNext = useCallback(() => {
    if (quizIndex + 1 >= quizQuestions.length) {
      setQuizDone(true);
    } else {
      setQuizIndex((i) => i + 1);
      setQuizSelected(null);
    }
  }, [quizIndex, quizQuestions.length]);

  const goBackFromQuiz = useCallback(() => {
    if (quizReturnSign) {
      setSelectedSign(quizReturnSign);
      setViewMode('detail');
    } else {
      setViewMode('grid');
    }
    setQuizDone(false);
  }, [quizReturnSign]);

  const goBackFromDetail = useCallback(() => {
    setViewMode('grid');
    setSelectedSign(null);
  }, []);

  // ── Quiz view ───────────────────────────────────────────────────────────────
  if (viewMode === 'quiz') {
    if (quizDone) {
      const pct = Math.round((quizScore / quizQuestions.length) * 100);
      const passed = pct >= 70;
      return (
        <ScrollView
          style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
          contentContainerStyle={styles.content}
        >
          <TouchableOpacity style={styles.backBtn} onPress={goBackFromQuiz} activeOpacity={0.7}>
            <Text style={[styles.backBtnText, { color: SIGN_RED }]}>
              {'<- '}
              {quizReturnSign ? quizReturnSign.name : 'Road Signs'}
            </Text>
          </TouchableOpacity>

          <View style={styles.scoreCentreWrapper}>
            <View style={[styles.scoreCircle, { borderColor: passed ? '#16A34A' : SIGN_RED }]}>
              <Text style={[styles.scoreCirclePct, { color: passed ? '#16A34A' : SIGN_RED }]}>
                {pct}%
              </Text>
              <Text style={styles.scoreCircleLabel}>
                {quizScore}/{quizQuestions.length}
              </Text>
            </View>
            <Text style={[styles.scoreHeading, { color: theme.textColor }]}>
              {passed ? 'Great work!' : 'Keep practising'}
            </Text>
            <Text style={[styles.scoreSub, { color: theme.subTextColor }]}>
              {passed
                ? 'You correctly identified most signs.'
                : 'Review the signs below and try again.'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              const src = quizReturnSign
                ? roadSigns.filter((s) => s.category === quizReturnSign.category)
                : filteredSigns;
              startQuiz(src, quizReturnSign ? 5 : 10, quizReturnSign);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: SIGN_RED }]}
            onPress={goBackFromQuiz}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryBtnText, { color: SIGN_RED }]}>Back to signs</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    const q = quizQuestions[quizIndex];
    const answered = quizSelected !== null;
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.quizTopRow}>
          <TouchableOpacity onPress={goBackFromQuiz} activeOpacity={0.7}>
            <Text style={[styles.backBtnText, { color: SIGN_RED }]}>{'<- Exit'}</Text>
          </TouchableOpacity>
          <Text style={[styles.quizProgress, { color: theme.subTextColor }]}>
            {quizIndex + 1} / {quizQuestions.length}
          </Text>
        </View>

        <View style={styles.quizProgressBar}>
          <View
            style={[
              styles.quizProgressFill,
              { width: `${((quizIndex + (answered ? 1 : 0)) / quizQuestions.length) * 100}%` },
            ]}
          />
        </View>

        <View style={styles.quizSignWrapper}>
          <SignVisual sign={q.sign} size={QUIZ_SIGN} />
        </View>

        <Text style={[styles.quizQuestion, { color: theme.textColor }]}>
          What does this sign mean?
        </Text>

        <View style={{ gap: 10, marginBottom: 20 }}>
          {q.options.map((option, i) => {
            let bgColor: string = '#FFFFFF';
            let borderColor: string = theme.borderColor as string;
            let textColor: string = theme.textColor as string;
            if (answered) {
              if (i === q.correctIndex) {
                bgColor = '#F0FDF4';
                borderColor = '#16A34A';
                textColor = '#15803D';
              } else if (i === quizSelected) {
                bgColor = '#FEF2F2';
                borderColor = SIGN_RED;
                textColor = SIGN_RED;
              }
            }
            return (
              <TouchableOpacity
                key={i}
                style={[styles.quizOption, { backgroundColor: bgColor, borderColor }]}
                onPress={() => handleQuizAnswer(i)}
                activeOpacity={answered ? 1 : 0.85}
              >
                <View style={[styles.quizOptionBadge, answered ? { backgroundColor: borderColor } : undefined]}>
                  <Text style={styles.quizOptionBadgeText}>
                    {['A', 'B', 'C', 'D'][i]}
                  </Text>
                </View>
                <Text style={[styles.quizOptionText, { color: textColor, flex: 1 }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {answered ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleQuizNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>
              {quizIndex + 1 >= quizQuestions.length ? 'See results' : 'Next sign'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (viewMode === 'detail' && selectedSign) {
    const categorySigns = roadSigns.filter((s) => s.category === selectedSign.category);
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity style={styles.backBtn} onPress={goBackFromDetail} activeOpacity={0.7}>
          <Text style={[styles.backBtnText, { color: SIGN_RED }]}>{'<- Road Signs'}</Text>
        </TouchableOpacity>

        <View style={styles.detailSignWrapper}>
          <SignVisual sign={selectedSign} size={DETAIL_SIGN} />
        </View>

        <CategoryBadge category={selectedSign.category} />
        <Text style={[styles.detailName, { color: theme.textColor }]}>{selectedSign.name}</Text>

        <View style={[styles.infoCard, { borderColor: theme.borderColor }]}>
          <Text style={[styles.infoCardLabel, { color: SIGN_BLUE }]}>MEANING</Text>
          <Text style={[styles.infoCardBody, { color: theme.textColor }]}>
            {selectedSign.meaning}
          </Text>
        </View>

        <View style={[styles.infoCard, { borderColor: theme.borderColor }]}>
          <Text style={[styles.infoCardLabel, { color: '#16A34A' }]}>WHAT TO DO</Text>
          <Text style={[styles.infoCardBody, { color: theme.textColor }]}>
            {selectedSign.whatToDo}
          </Text>
        </View>

        <View style={[styles.mistakeCard, { borderColor: SIGN_AMBER }]}>
          <Text style={[styles.infoCardLabel, { color: SIGN_AMBER }]}>COMMON MISTAKE</Text>
          <Text style={[styles.infoCardBody, { color: theme.textColor }]}>
            {selectedSign.commonMistake}
          </Text>
        </View>

        {selectedSign.relatedRuleNumber ? (
          <TouchableOpacity
            style={[styles.ruleLink, { borderColor: theme.borderColor }]}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/highwaycode',
                params: { ruleNumber: String(selectedSign.relatedRuleNumber) },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.ruleLinkLabel, { color: theme.subTextColor }]}>
              Related Highway Code rule
            </Text>
            <Text style={[styles.ruleLinkValue, { color: SIGN_BLUE }]}>
              {'Rule '}{selectedSign.relatedRuleNumber}{' ->'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: '#0D9488' }]}
          onPress={() => startQuiz(categorySigns, 5, selectedSign)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {'Test yourself on '}{selectedSign.category}{' signs'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Grid view ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <OfflineBanner />
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundColor }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.gridHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenTitle, { color: theme.textColor }]}>Road Signs</Text>
          <Text style={[styles.screenSub, { color: theme.subTextColor }]}>
            {roadSigns.length}{'  UK signs — tap to learn, quiz to test'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.quizLaunchBtn, { backgroundColor: SIGN_RED }]}
          onPress={() => startQuiz(filteredSigns.length > 0 ? filteredSigns : roadSigns, 10, null)}
          activeOpacity={0.85}
        >
          <Text style={styles.quizLaunchText}>Quiz</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { borderColor: theme.borderColor }]}>
        <Text style={{ fontSize: 16, color: SIGN_RED, fontWeight: '700' }}>{'[?]'}</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.textColor }]}
          placeholder="Search signs..."
          placeholderTextColor={theme.subTextColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Text style={{ color: theme.subTextColor, fontSize: 18 }}>x</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {searchQuery.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORY_CONFIGS.map((cfg) => {
            const active = activeCategory === cfg.value;
            return (
              <TouchableOpacity
                key={String(cfg.value)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? cfg.colour : '#FFFFFF',
                    borderColor: active ? cfg.colour : theme.borderColor,
                  },
                ]}
                onPress={() => setActiveCategory(cfg.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: active ? '#FFFFFF' : theme.subTextColor },
                  ]}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={[styles.countLabel, { color: theme.subTextColor }]}>
        {filteredSigns.length === roadSigns.length
          ? `All ${roadSigns.length} signs`
          : `${filteredSigns.length} sign${filteredSigns.length === 1 ? '' : 's'}`}
      </Text>

      <View style={styles.signGrid}>
        {filteredSigns.map((sign) => (
          <TouchableOpacity
            key={sign.id}
            style={[styles.signCard, { borderColor: theme.borderColor }]}
            onPress={() => openDetail(sign)}
            activeOpacity={0.8}
          >
            <View style={styles.signCardShape}>
              <SignVisual sign={sign} size={GRID_SIGN} />
            </View>
            <Text
              style={[styles.signCardName, { color: theme.textColor }]}
              numberOfLines={2}
            >
              {sign.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 14, fontWeight: '600' },

  // Grid
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  screenSub: { fontSize: 13, lineHeight: 18 },
  quizLaunchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  quizLaunchText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },

  categoryScroll: { marginBottom: 10 },
  categoryScrollContent: { gap: 8, paddingRight: 4 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontWeight: '700' },

  countLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  signGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  signCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    width: CARD_W,
  },
  signCardShape: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  signCardName: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },

  // Detail
  detailSignWrapper: {
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    minHeight: DETAIL_SIGN + 10,
    justifyContent: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  detailName: { fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 16 },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  infoCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoCardBody: { fontSize: 14, lineHeight: 22 },

  mistakeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  ruleLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  ruleLinkLabel: { fontSize: 13 },
  ruleLinkValue: { fontSize: 13, fontWeight: '700' },

  primaryBtn: {
    backgroundColor: SIGN_RED,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 15 },

  // Quiz
  quizTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizProgress: { fontSize: 13, fontWeight: '600' },
  quizProgressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  quizProgressFill: { height: 4, backgroundColor: SIGN_RED, borderRadius: 2 },
  quizSignWrapper: {
    alignItems: 'center',
    marginBottom: 20,
    minHeight: QUIZ_SIGN + 10,
    justifyContent: 'center',
  },
  quizQuestion: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  quizOptionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: '#6B7280',
  },
  quizOptionBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  quizOptionText: { fontSize: 14, lineHeight: 20 },

  // Score
  scoreCentreWrapper: { alignItems: 'center', marginVertical: 32 },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scoreCirclePct: { fontSize: 28, fontWeight: '900' },
  scoreCircleLabel: { fontSize: 13, color: '#6B7280' },
  scoreHeading: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  scoreSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
