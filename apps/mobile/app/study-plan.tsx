import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { loadUserProgress, saveUserProgress, createFreshUserProgress, getSessionHistory } from '@/src/storage';
import { getStudyPlan, type StudyPace, type SimpleStudyPlan, type SimpleTask } from '@/src/studyPlan';
import { TopicCategory } from '@clearpass/core';
import { useTheme } from '@/src/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const PACE_LABELS: Record<StudyPace, string> = {
  relaxed:    'Relaxed -- 15 min/day',
  steady:     'Steady -- 20 min/day',
  intensive:  'Intensive -- 30 min/day',
  final_push: 'Final Push -- mock tests focus',
};

const PACE_COLORS: Record<StudyPace, string> = {
  relaxed:    '#0D9488',
  steady:     '#6366F1',
  intensive:  '#F59E0B',
  final_push: '#EF4444',
};

const TASK_ICONS: Record<string, string> = {
  questions: '[Q]',
  mock:      '[M]',
  hazard:    '[H]',
  rest:      '[z]',
  revision:  '[R]',
  weakspots: '[!]',
};

const TASK_LABELS: Record<string, string> = {
  questions: 'Practice Questions',
  mock:      'Full Mock Test',
  hazard:    'Hazard Perception',
  rest:      'Rest Day',
  revision:  'Revision',
  weakspots: 'Weak Spot Drill',
};

const TASK_ROUTES: Record<string, string> = {
  questions: '/(tabs)/practice',
  mock:      '/(tabs)/mock',
  hazard:    '/(tabs)/hazard',
  weakspots: '/(tabs)/practice',
};

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

function countSessionsThisWeek(history: { date: string }[]): number {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return history.filter(s => new Date(s.date) >= monday).length;
}

// ─── DayCard ─────────────────────────────────────────────────────────────────

function DayCard({ plan, isToday }: { plan: SimpleStudyPlan['weekPlan'][0]; isToday: boolean }) {
  const theme = useTheme();
  const isRest = plan.task.type === 'rest';
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday, { backgroundColor: isToday ? '#0D9488' : theme.cardColor }]}>
      <Text style={[styles.dayName, { color: isToday ? 'rgba(255,255,255,0.8)' : theme.subTextColor }]}>
        {plan.dayName}
      </Text>
      <Text style={[styles.dayIcon, { opacity: isRest ? 0.4 : 1 }]}>
        {TASK_ICONS[plan.task.type] ?? '[?]'}
      </Text>
      <Text style={[styles.dayType, { color: isToday ? '#FFFFFF' : (isRest ? theme.subTextColor : theme.textColor) }]} numberOfLines={2}>
        {isRest ? 'Rest' : plan.task.durationMins + 'm'}
      </Text>
    </View>
  );
}

// ─── StudyPlanScreen ──────────────────────────────────────────────────────────

export default function StudyPlanScreen() {
  const theme = useTheme();
  const [plan, setPlan] = useState<SimpleStudyPlan | null>(null);
  const [testDate, setTestDate] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [progress, history] = await Promise.all([loadUserProgress(), getSessionHistory()]);
        const p = progress ?? createFreshUserProgress();
        setTestDate(p.testDate ?? null);
        setSessionsThisWeek(countSessionsThisWeek(history));

        if (p.testDate) {
          const weakTopics = Object.entries(p.topicScores as Record<string, number>)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 5)
            .map(([k]) => k);
          setPlan(getStudyPlan(p.testDate, weakTopics));
        }
      })();
    }, []),
  );

  async function handleSaveDate() {
    const parsed = parseDdMmYyyy(dateInput.trim());
    if (!parsed) { setDateError('Enter a valid date (DD/MM/YYYY)'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const p = (await loadUserProgress()) ?? createFreshUserProgress();
      const updated = { ...p, testDate: parsed };
      await saveUserProgress(updated);
      setTestDate(parsed);
      const weakTopics = Object.entries(updated.topicScores as Record<string, number>)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 5)
        .map(([k]) => k);
      setPlan(getStudyPlan(parsed, weakTopics));
      setDateInput('');
      setDateError('');
    } finally {
      setSaving(false);
    }
  }

  function handleStartTask(task: SimpleTask) {
    const route = TASK_ROUTES[task.type];
    if (!route) return;
    if (task.type === 'weakspots') {
      router.push({ pathname: route as any, params: { mode: 'weakspots' } });
    } else {
      router.push(route as any);
    }
  }

  const weekTarget = plan ? (plan.pace === 'relaxed' ? 4 : plan.pace === 'steady' ? 5 : 7) : 7;
  const weekPct = weekTarget > 0 ? Math.min(100, Math.round((sessionsThisWeek / weekTarget) * 100)) : 0;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: theme.textColor }]}>{'<- Back'}</Text>
        </TouchableOpacity>
        {plan && (
          <View style={[styles.paceChip, { backgroundColor: PACE_COLORS[plan.pace] + '20', borderColor: PACE_COLORS[plan.pace] }]}>
            <Text style={[styles.paceText, { color: PACE_COLORS[plan.pace] }]}>{PACE_LABELS[plan.pace]}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.screenTitle, { color: theme.textColor }]}>{'Your Study Plan'}</Text>

      {plan && (
        <Text style={[styles.countdownText, { color: theme.subTextColor }]}>
          {plan.daysLeft > 0 ? `${plan.daysLeft} days until your test` : 'Test day is today!'}
        </Text>
      )}

      {/* No test date set */}
      {!testDate && (
        <View style={[styles.setDateCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
          <Text style={[styles.setDateTitle, { color: theme.textColor }]}>{'Set your test date'}</Text>
          <Text style={[styles.setDateSub, { color: theme.subTextColor }]}>
            {'We will build a personalised day-by-day study plan for you.'}
          </Text>
          <TextInput
            style={[styles.dateInput, { color: theme.textColor, borderColor: dateInput.length > 0 ? '#0D9488' : theme.borderColor }]}
            value={dateInput}
            onChangeText={t => { setDateInput(t); setDateError(''); }}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {dateError.length > 0 && <Text style={styles.dateError}>{dateError}</Text>}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => void handleSaveDate()}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Build My Plan'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's task */}
      {plan && plan.todayTask.type !== 'rest' && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>{'TODAY\'S TASK'}</Text>
          <TouchableOpacity
            style={styles.todayCard}
            onPress={() => handleStartTask(plan.todayTask)}
            activeOpacity={0.9}
          >
            <View style={styles.todayCardLeft}>
              <Text style={styles.todayIcon}>{TASK_ICONS[plan.todayTask.type] ?? '[?]'}</Text>
              <View style={styles.todayCardText}>
                <Text style={styles.todayTaskLabel}>{TASK_LABELS[plan.todayTask.type] ?? plan.todayTask.type}</Text>
                {plan.todayTask.topic && (
                  <Text style={styles.todayTopicLabel}>{plan.todayTask.topic}</Text>
                )}
                <Text style={styles.todayDuration}>{plan.todayTask.durationMins}{' min session'}</Text>
              </View>
            </View>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnText}>{'Start ->'}</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {plan && plan.todayTask.type === 'rest' && (
        <View style={[styles.restCard, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.restText, { color: theme.subTextColor }]}>{'Rest day -- you have earned it!'}</Text>
        </View>
      )}

      {/* Weekly progress */}
      {plan && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>{'THIS WEEK'}</Text>
          <View style={[styles.progressCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressFraction, { color: theme.textColor }]}>
                {sessionsThisWeek}{' / '}{weekTarget}{' sessions'}
              </Text>
              <Text style={[styles.progressPct, { color: '#0D9488' }]}>{weekPct}{'%'}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${weekPct}%` as any }]} />
            </View>
          </View>
        </>
      )}

      {/* 7-day schedule */}
      {plan && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>{'7-DAY SCHEDULE'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
            {plan.weekPlan.map((d, i) => (
              <DayCard key={d.date} plan={d} isToday={i === 0} />
            ))}
          </ScrollView>
        </>
      )}

      {/* Change test date link */}
      {testDate && (
        <TouchableOpacity style={styles.changeDateLink} onPress={() => { setTestDate(null); setPlan(null); }} activeOpacity={0.7}>
          <Text style={[styles.changeDateText, { color: theme.subTextColor }]}>{'Change test date'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn:   { paddingVertical: 4 },
  backText:  { fontSize: 15, fontWeight: '600' },

  paceChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paceText: { fontSize: 11, fontWeight: '700' },

  screenTitle:   { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 2 },
  countdownText: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },

  // Set date card
  setDateCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    borderTopWidth: 3,
    borderTopColor: '#0D9488',
    padding: 18,
    gap: 10,
  },
  setDateTitle: { fontSize: 17, fontWeight: '800' },
  setDateSub:   { fontSize: 14, lineHeight: 20 },
  dateInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 18,
    fontWeight: '600',
    padding: 13,
    letterSpacing: 2,
    color: '#111827',
  },
  dateError: { fontSize: 13, color: '#EF4444' },
  saveBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Today's task
  todayCard: {
    backgroundColor: '#0D9488',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  todayIcon:     { fontSize: 28, color: '#FFFFFF' },
  todayCardText: { flex: 1, gap: 2 },
  todayTaskLabel: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  todayTopicLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  todayDuration:  { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  startBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  restCard: { borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  restText:  { fontSize: 14, fontStyle: 'italic' },

  // Week progress
  progressCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    gap: 8,
  },
  progressRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressFraction: { fontSize: 14, fontWeight: '600' },
  progressPct:     { fontSize: 16, fontWeight: '800' },
  progressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#0D9488', borderRadius: 3 },

  // 7-day scroll
  weekRow: { gap: 8, paddingBottom: 4 },
  dayCard: {
    width: 58,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  dayCardToday: { borderColor: '#0D9488', borderWidth: 2 },
  dayName: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dayIcon: { fontSize: 16 },
  dayType: { fontSize: 9, fontWeight: '600', textAlign: 'center' },

  changeDateLink: { alignSelf: 'center', paddingVertical: 8 },
  changeDateText: { fontSize: 13, fontWeight: '500' },
});
