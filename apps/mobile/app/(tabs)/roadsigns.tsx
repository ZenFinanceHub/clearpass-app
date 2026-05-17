import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

// ── Shape renderers ───────────────────────────────────────────────────────────

function TriangleVis({
  size,
  bc,
  fc,
  tc,
  dt,
}: {
  size: number;
  bc: string;
  fc: string;
  tc: string;
  dt?: string;
}) {
  const bw = Math.max(3, Math.round(size * 0.07));
  const half = Math.floor(size / 2);
  const height = Math.round(size * 0.866);
  const innerHalf = Math.max(2, half - Math.round(bw * 1.2));
  const innerH = Math.max(4, height - Math.round(bw * 2.4));
  return (
    <View style={{ width: size, height: height + 2, alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: half,
          borderRightWidth: half,
          borderBottomWidth: height,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: bc,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: Math.round(bw * 0.7),
          width: 0,
          height: 0,
          borderLeftWidth: innerHalf,
          borderRightWidth: innerHalf,
          borderBottomWidth: innerH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: fc,
        }}
      />
      {dt ? (
        <Text
          style={{
            position: 'absolute',
            bottom: bw * 2,
            fontSize: size * 0.22,
            fontWeight: '900',
            color: tc,
            textAlign: 'center',
            width: size,
          }}
          numberOfLines={1}
        >
          {dt}
        </Text>
      ) : null}
    </View>
  );
}

function InvTriangleVis({
  size,
  bc,
  fc,
  tc,
  dt,
}: {
  size: number;
  bc: string;
  fc: string;
  tc: string;
  dt?: string;
}) {
  const bw = Math.max(3, Math.round(size * 0.07));
  const half = Math.floor(size / 2);
  const height = Math.round(size * 0.866);
  const innerHalf = Math.max(2, half - Math.round(bw * 1.2));
  const innerH = Math.max(4, height - Math.round(bw * 2.4));
  return (
    <View style={{ width: size, height: height + 2, alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: half,
          borderRightWidth: half,
          borderTopWidth: height,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: bc,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: Math.round(bw * 0.7),
          width: 0,
          height: 0,
          borderLeftWidth: innerHalf,
          borderRightWidth: innerHalf,
          borderTopWidth: innerH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: fc,
        }}
      />
      {dt ? (
        <Text
          style={{
            position: 'absolute',
            top: bw * 2,
            fontSize: size * 0.18,
            fontWeight: '900',
            color: tc,
            textAlign: 'center',
            width: size,
          }}
          numberOfLines={2}
        >
          {dt}
        </Text>
      ) : null}
    </View>
  );
}

function CircleVis({
  size,
  bc,
  fc,
  tc,
  dt,
}: {
  size: number;
  bc: string;
  fc: string;
  tc: string;
  dt?: string;
}) {
  const bw = Math.max(3, Math.round(size * 0.06));
  const rawLen = dt ? dt.length : 0;
  const fontSize =
    rawLen > 4 ? size * 0.18 : rawLen > 3 ? size * 0.21 : rawLen > 2 ? size * 0.26 : size * 0.34;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fc,
        borderWidth: bw,
        borderColor: bc,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {dt ? (
        <Text
          style={{ fontSize, fontWeight: '900', color: tc, textAlign: 'center' }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {dt}
        </Text>
      ) : null}
    </View>
  );
}

function OctagonVis({
  size,
  bc,
  fc,
  tc,
  dt,
}: {
  size: number;
  bc: string;
  fc: string;
  tc: string;
  dt?: string;
}) {
  const bw = Math.max(2, Math.round(size * 0.04));
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: fc,
        borderRadius: size * 0.15,
        borderWidth: bw,
        borderColor: bc,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {dt ? (
        <Text
          style={{
            fontSize: size * 0.28,
            fontWeight: '900',
            color: tc,
            letterSpacing: -1,
            textAlign: 'center',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {dt}
        </Text>
      ) : null}
    </View>
  );
}

function RectVis({
  size,
  bc,
  fc,
  tc,
  dt,
}: {
  size: number;
  bc: string;
  fc: string;
  tc: string;
  dt?: string;
}) {
  const bordered = bc !== fc;
  return (
    <View
      style={{
        width: Math.round(size * 1.5),
        height: Math.round(size * 0.85),
        backgroundColor: fc,
        borderRadius: 4,
        borderWidth: bordered ? 2 : 0,
        borderColor: bc,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      {dt ? (
        <Text
          style={{ fontSize: size * 0.22, fontWeight: '800', color: tc, textAlign: 'center' }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {dt}
        </Text>
      ) : null}
    </View>
  );
}

function SignVisual({ sign, size }: { sign: RoadSign; size: number }) {
  const { shape, borderColor: bc, fillColor: fc, textColor: tc, displayText: dt } = sign;
  if (shape === 'triangle')
    return <TriangleVis size={size} bc={bc} fc={fc} tc={tc} dt={dt} />;
  if (shape === 'inverted-triangle')
    return <InvTriangleVis size={size} bc={bc} fc={fc} tc={tc} dt={dt} />;
  if (shape === 'octagon')
    return <OctagonVis size={size} bc={bc} fc={fc} tc={tc} dt={dt} />;
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
