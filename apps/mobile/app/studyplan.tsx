import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { loadUserProgress, createFreshUserProgress, saveUserProgress } from '@/src/storage';
import {
  generateStudyPlan,
  loadStudyPlan,
  clearStudyPlan,
  StudyPlan,
  StudyDay,
  StudyTaskType,
} from '@/src/studyPlan';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';

const DAILY_MINUTES_OPTIONS = [10, 20, 30, 45];

const TASK_ICONS: Record<StudyTaskType, string> = {
  questions:    '📝',
  mock:         '🎯',
  hazard:       '⚠',
  highway_code: '📖',
  road_signs:   '🚦',
  rest:         '😴',
};

const TASK_ROUTES: Partial<Record<StudyTaskType, string>> = {
  questions:    '/(tabs)/practice',
  mock:         '/(tabs)/mock',
  hazard:       '/(tabs)/hazard',
  highway_code: '/(tabs)/highwaycode',
  road_signs:   '/(tabs)/roadsigns',
};

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatTestDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isoToDdMmYyyy(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year  = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

function getDaysRemaining(testDateIso: string): number {
  const now     = new Date();
  const test    = new Date(testDateIso);
  const nowDay  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const testDay = new Date(test.getFullYear(), test.getMonth(), test.getDate());
  return Math.round((testDay.getTime() - nowDay.getTime()) / 86400000);
}

export function buildTodaySummary(plan: StudyPlan): string {
  const today = getTodayStr();
  const day   = plan.days.find(d => d.date === today);
  if (!day) return '';
  const parts = day.tasks
    .filter(t => t.type !== 'rest')
    .map(t => {
      if (t.count) return `${t.count} ${t.type === 'questions' ? 'questions' : t.type.replace('_', ' ')}`;
      return t.type.replace('_', ' ');
    });
  return parts.length > 0 ? `Today: ${parts.join(' + ')}` : 'Today: rest day';
}

// ─── DayCard ─────────────────────────────────────────────────────────────────

function DayCard({ day, isToday, isPast }: { day: StudyDay; isToday: boolean; isPast: boolean }) {
  const theme = useTheme();
  const firstActionableTask = day.tasks.find(t => TASK_ROUTES[t.type]);
  const route = firstActionableTask ? TASK_ROUTES[firstActionableTask.type] : null;

  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday, isPast && styles.dayCardPast]}>
      {isToday && (
        <View style={styles.todayBadgeRow}>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>TODAY</Text>
          </View>
          <Text style={[styles.dayMins, { color: '#0D9488' }]}>{day.estimatedMinutes}{' min'}</Text>
        </View>
      )}

      <View style={styles.dayHeader}>
        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday, isPast && styles.dayLabelPast]}>
          {dateLabel}
        </Text>
        {!isToday && (
          <Text style={[styles.dayMins, isPast && styles.dayLabelPast]}>{day.estimatedMinutes}{' min'}</Text>
        )}
      </View>

      {day.tasks.map((task, i) => (
        <View key={i} style={styles.taskRow}>
          <Text style={styles.taskIcon}>{TASK_ICONS[task.type] ?? '•'}</Text>
          <Text style={[styles.taskDesc, isPast && styles.taskDescPast, { fontSize: theme.fontSize(13), ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}) }]}>
            {task.description}
          </Text>
        </View>
      ))}

      {isToday && route && (
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => router.push(route as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>{"Start Today's Session"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── StudyPlanScreen ──────────────────────────────────────────────────────────

export default function StudyPlanScreen() {
  const theme = useTheme();

  const [plan,             setPlan]             = useState<StudyPlan | null>(null);
  const [testDate,         setTestDate]         = useState<string | null>(null);
  const [dailyMinutes,     setDailyMinutes]     = useState<number>(20);
  const [generating,       setGenerating]       = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [loaded,           setLoaded]           = useState(false);
  const [showDateModal,    setShowDateModal]    = useState(false);
  const [dateInput,        setDateInput]        = useState('');
  const [dateError,        setDateError]        = useState('');
  const [showRegenModal,   setShowRegenModal]   = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [existingPlan, progress] = await Promise.all([
          loadStudyPlan(),
          loadUserProgress(),
        ]);
        const p = progress ?? createFreshUserProgress();
        setTestDate(p.testDate ?? null);
        if (existingPlan) setPlan(existingPlan);
        setLoaded(true);
      })();
    }, []),
  );

  function openDateModal() {
    setDateInput(testDate ? isoToDdMmYyyy(testDate) : '');
    setDateError('');
    setShowDateModal(true);
  }

  async function handleSaveDate() {
    const parsed = parseDdMmYyyy(dateInput.trim());
    if (!parsed) {
      setDateError('Enter a valid date in DD/MM/YYYY format');
      return;
    }
    setDateError('');

    const dateChanged = parsed !== testDate;
    setTestDate(parsed);
    setShowDateModal(false);

    // Persist to UserProgress (AsyncStorage + cloud)
    const progress = await loadUserProgress() ?? createFreshUserProgress();
    await saveUserProgress({ ...progress, testDate: parsed });

    // Persist to Supabase profiles
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, test_date: parsed });
      }
    } catch { /* non-critical */ }

    if (dateChanged && plan) {
      setShowRegenModal(true);
    }
  }

  async function handleGenerate(dateOverride?: string) {
    const date = dateOverride ?? testDate;
    if (!date) return;
    setGenerating(true);
    setError(null);
    try {
      const progress = await loadUserProgress() ?? createFreshUserProgress();
      const newPlan  = await generateStudyPlan(date, progress, dailyMinutes);
      setPlan(newPlan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    await clearStudyPlan();
    setPlan(null);
    await handleGenerate();
  }

  if (!loaded) {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  const today        = getTodayStr();
  const daysRemaining = testDate ? getDaysRemaining(testDate) : null;

  // ── Test Date Card (shared between both views) ─────────────────────────────
  const testDateCard = testDate ? (
    <View style={styles.testDateCard}>
      <View style={styles.testDateLeft}>
        <Text style={styles.testDateEmoji}>{'📅'}</Text>
        <View style={styles.testDateTextBlock}>
          <Text style={styles.testDateLabel}>TEST DATE</Text>
          <Text style={styles.testDateValue}>{formatTestDate(testDate)}</Text>
          {daysRemaining !== null && daysRemaining >= 0 && (
            <Text style={styles.testDateSub}>{daysRemaining}{' days to go'}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity onPress={openDateModal} style={styles.editBtn} activeOpacity={0.7}>
        <Text style={styles.editBtnText}>Edit</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity style={styles.noDateCard} onPress={openDateModal} activeOpacity={0.85}>
      <Text style={styles.noDateIcon}>{'⚠'}</Text>
      <View style={styles.noDateBody}>
        <Text style={styles.noDateTitle}>Set your test date</Text>
        <Text style={styles.noDateDesc}>
          {'Get a personalised plan based on exactly how long you have to prepare'}
        </Text>
      </View>
      <View style={styles.noDateBtn}>
        <Text style={styles.noDateBtnText}>Set Date</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: theme.textColor }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Study Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      {generating ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={[styles.generatingText, { color: theme.textColor }]}>
            {'Claude is personalising your schedule...'}
          </Text>
          <Text style={[styles.generatingSub, { color: theme.subTextColor }]}>
            {'This usually takes 10–15 seconds'}
          </Text>
        </View>

      ) : plan ? (
        // ── Plan view ────────────────────────────────────────────────────────
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {testDateCard}

          {/* Summary stats */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>YOUR PLAN</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{daysRemaining ?? '—'}</Text>
                <Text style={styles.summaryItemLabel}>days to go</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.dailyMinutes}</Text>
                <Text style={styles.summaryItemLabel}>min / day</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{plan.days.length}</Text>
                <Text style={styles.summaryItemLabel}>days planned</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.regenBtn} onPress={() => void handleRegenerate()} activeOpacity={0.8}>
              <Text style={styles.regenBtnText}>{'Regenerate Plan'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.testDayCard}
            onPress={() => router.push('/testday' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.testDayCardEmoji}>{'🎯'}</Text>
            <View style={styles.testDayCardText}>
              <Text style={styles.testDayCardTitle}>{'Test Day Prep'}</Text>
              <Text style={styles.testDayCardSub}>{'Breathe, revise and checklist'}</Text>
            </View>
            <Text style={styles.testDayCardChevron}>{'›'}</Text>
          </TouchableOpacity>

          {error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

          {plan.days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              isToday={day.date === today}
              isPast={day.date < today}
            />
          ))}
          <View style={styles.bottomPad} />
        </ScrollView>

      ) : (
        // ── Setup flow ───────────────────────────────────────────────────────
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {testDateCard}

          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            {'How much time can you study each day?'}
          </Text>

          <View style={styles.chipsRow}>
            {DAILY_MINUTES_OPTIONS.map(mins => (
              <TouchableOpacity
                key={mins}
                style={[styles.chip, dailyMinutes === mins && styles.chipSelected]}
                onPress={() => setDailyMinutes(mins)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, dailyMinutes === mins && styles.chipTextSelected]}>
                  {mins}{' min'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.chipsHint, { color: theme.subTextColor }]}>
            {dailyMinutes === 10 ? 'Quick daily refresher — great for maintenance'
              : dailyMinutes === 20 ? 'Solid daily practice — recommended for most learners'
              : dailyMinutes === 30 ? 'Focused study sessions — faster progress'
              : 'Intensive revision — ideal if your test is soon'}
          </Text>

          {error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

          <TouchableOpacity
            style={[styles.generateBtn, !testDate && styles.generateBtnDisabled]}
            onPress={() => void handleGenerate()}
            disabled={!testDate}
            activeOpacity={0.85}
          >
            <Text style={styles.generateBtnText}>{'Generate My Plan'}</Text>
          </TouchableOpacity>

          <Text style={[styles.generateHint, { color: theme.subTextColor }]}>
            {'Powered by Claude AI — your plan adapts to your weak topics and test date'}
          </Text>

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {/* ── Date Picker Modal ──────────────────────────────────────────────── */}
      <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              {testDate ? 'Change Test Date' : 'Set Test Date'}
            </Text>
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>
              {'Enter your theory test date in DD/MM/YYYY format'}
            </Text>
            <TextInput
              style={styles.dateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoFocus
            />
            {dateError.length > 0 && <Text style={styles.dateError}>{dateError}</Text>}
            <TouchableOpacity style={styles.modalSave} onPress={() => void handleSaveDate()} activeOpacity={0.85}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDateModal(false)} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Regenerate Confirm Modal ───────────────────────────────────────── */}
      <Modal visible={showRegenModal} transparent animationType="fade" onRequestClose={() => setShowRegenModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.regenModalIcon}>{'📅'}</Text>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>Test date updated</Text>
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>
              {'Your test date changed. Would you like to regenerate your study plan to match the new date?'}
            </Text>
            <TouchableOpacity
              style={styles.modalSave}
              onPress={() => {
                setShowRegenModal(false);
                void handleRegenerate();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveText}>{'Yes, Regenerate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowRegenModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{'Keep Current Plan'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:         { flex: 1 },
  centered:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll:         { flex: 1 },
  scrollContent:  { padding: 16, paddingBottom: 40 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  backBtn:      { padding: 4, marginRight: 8 },
  backArrow:    { fontSize: 22, fontWeight: '600', lineHeight: 26 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: 34 },

  // ── Generating ────────────────────────────────────────────────────────────
  generatingText: { marginTop: 20, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  generatingSub:  { marginTop: 8, fontSize: 13, textAlign: 'center' },

  // ── Test Date Card ────────────────────────────────────────────────────────
  testDateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: '#0D9488',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  testDateLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  testDateEmoji:     { fontSize: 28 },
  testDateTextBlock: { flex: 1 },
  testDateLabel:     { fontSize: 10, fontWeight: '700', color: '#0D9488', letterSpacing: 1, marginBottom: 3 },
  testDateValue:     { fontSize: 18, fontWeight: '800', color: '#111827', lineHeight: 22, marginBottom: 2 },
  testDateSub:       { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  editBtn: {
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginLeft: 8,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },

  // ── No Date Card ──────────────────────────────────────────────────────────
  noDateCard: {
    backgroundColor: '#0D9488',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  noDateIcon:    { fontSize: 22, color: '#FFFFFF' },
  noDateBody:    { flex: 1 },
  noDateTitle:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  noDateDesc:    { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },
  noDateBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  noDateBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Summary card ─────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  summaryItem:      { flex: 1, alignItems: 'center' },
  summaryValue:     { fontSize: 30, fontWeight: '900', color: '#111827', lineHeight: 36 },
  summaryItemLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  summaryDivider:   { width: 1, height: 36, backgroundColor: '#E5E7EB' },
  regenBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  regenBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // ── Day card ──────────────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  dayCardToday: {
    borderLeftColor: '#0D9488',
    borderLeftWidth: 4,
    backgroundColor: '#F0FDFA',
  },
  dayCardPast: { opacity: 0.5 },

  todayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  todayBadge: {
    backgroundColor: '#0D9488',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  dayHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayLabel:      { fontSize: 13, fontWeight: '700', color: '#374151' },
  dayLabelToday: { color: '#0D9488', fontSize: 14 },
  dayLabelPast:  { color: '#9CA3AF' },
  dayMins:       { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  taskRow:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  taskIcon:     { fontSize: 16, lineHeight: 20 },
  taskDesc:     { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  taskDescPast: { color: '#9CA3AF' },

  startBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Setup flow ────────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  chipsRow:     { flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  chipText:         { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  chipTextSelected: { color: '#0D9488' },
  chipsHint:        { fontSize: 13, lineHeight: 18, marginBottom: 24 },

  generateBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateBtnDisabled: { backgroundColor: '#9CA3AF' },
  generateBtnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  generateHint:        { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // ── Error card ────────────────────────────────────────────────────────────
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 14,
  },
  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '500', lineHeight: 18 },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  regenModalIcon: { fontSize: 32, textAlign: 'center', marginBottom: 12 },
  modalTitle:     { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalSub:       { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  dateInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    marginBottom: 8,
    letterSpacing: 2,
  },
  dateError:      { fontSize: 13, color: '#EF4444', marginBottom: 10 },
  modalSave: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  modalSaveText:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },

  bottomPad: { height: 20 },

  testDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  testDayCardEmoji:   { fontSize: 26 },
  testDayCardText:    { flex: 1 },
  testDayCardTitle:   { fontSize: 15, fontWeight: '800', color: '#0D9488' },
  testDayCardSub:     { fontSize: 12, color: '#14B8A6', marginTop: 2 },
  testDayCardChevron: { fontSize: 24, color: '#0D9488', fontWeight: '700', lineHeight: 28 },
});
