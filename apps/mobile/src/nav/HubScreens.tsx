import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadUserProgress } from '@/src/storage';
import { useNetwork } from '@/src/NetworkContext';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { useDesignTheme } from '@/src/design';
import { contentMaxWidth, minTouchTarget } from '@/src/design/tokens';
import { Badge, Card, Icon, Text, type IconName } from '@/src/ui';
import { LEARN_HUB, PROGRESS_LINKS, TESTS_HUB, withTapNonce, type HubEntry } from './routeMap';
import { TOPIC_PICKER_PARAM, topicRevisionList, type TopicRevisionItem } from './topicRevision';

/**
 * ClearPass 2.0 hub screens (ui_v2 only). Presentation only: every entry
 * opens an EXISTING screen (routes in src/nav/routeMap.ts, mapping in
 * docs/clearpass-2.0/02-navigation-mapping.md). No new data, no new gating.
 */

function go(route: string) {
  router.push(withTapNonce(route, Date.now()) as never);
}

function HubRow({ entry, disabledNote, onPress, expanded }: { entry: HubEntry; disabledNote?: string | null; onPress?: () => void; expanded?: boolean }) {
  const { colors, radii } = useDesignTheme();
  const disabled = !!disabledNote;
  return (
    <Pressable
      onPress={disabled ? undefined : (onPress ?? (() => go(entry.route)))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}. ${disabledNote ?? entry.subtitle}`}
      accessibilityState={expanded === undefined ? { disabled } : { disabled, expanded }}
      testID={`hub-${entry.id}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.card,
        backgroundColor: hovered && !disabled ? colors.bg.subtle : colors.bg.card,
        borderWidth: 1, borderColor: colors.border.default,
        opacity: pressed ? 0.85 : 1, flex: 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.brandSubtle }}>
        <Icon name={entry.icon as IconName} size={22} color={disabled ? colors.text.secondary : colors.text.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" weight={700} color={disabled ? 'secondary' : 'primary'}>{entry.title}</Text>
        <Text variant="bodySmall" color="secondary">{disabledNote ?? entry.subtitle}</Text>
      </View>
      {!disabled && <Icon name={expanded === undefined ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.secondary} />}
    </Pressable>
  );
}

/** One or two columns of rows, depending on width. */
function HubGrid({ children }: { children: React.ReactNode[] }) {
  const { width } = useWindowDimensions();
  const cols = width >= 720 ? 2 : 1;
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += cols) rows.push(children.slice(i, i + cols));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          {r}
          {r.length < cols && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

function HubShell({ title, subtitle, children, testID }: { title: string; subtitle: string; children: React.ReactNode; testID: string }) {
  const { colors, space } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg.canvas }}>
      <OfflineBanner />
      <ScrollView testID={testID} contentContainerStyle={{ paddingBottom: space.xl }}>
        <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: wide ? space.xxl : space.md, paddingTop: wide ? space.xl : space.md, gap: space.md }}>
          <View>
            <Text variant={wide ? 'display' : 'title'} weight={700}>{title}</Text>
            <Text variant="body" color="secondary">{subtitle}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text variant="heading" weight={700} style={{ marginTop: 4 }}>{children}</Text>;
}

// ─── Learn ───────────────────────────────────────────────────────────────────

/** Topic revision: every topic with the learner's local score; a tap starts the existing topic launcher. */
function TopicPicker({ topics }: { topics: TopicRevisionItem[] | null }) {
  const { colors } = useDesignTheme();
  return (
    <Card padding={8} testID="topic-picker">
      <Text variant="bodySmall" color="secondary" style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
        {'Choose a topic to practise.'}
      </Text>
      {topics === null ? (
        <Text variant="bodySmall" color="secondary" style={{ padding: 8 }}>{'Loading…'}</Text>
      ) : topics.map((t) => {
        const scoreText = t.score === null ? 'Not started' : `${t.score}%`;
        return (
          <Pressable
            key={t.key}
            onPress={() => go(t.route)}
            accessibilityRole="button"
            accessibilityLabel={`Practise ${t.name}. ${scoreText}${t.weakest ? '. Your weakest topic' : ''}`}
            testID={`topic-pick-${t.key}`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget,
              paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
              backgroundColor: hovered ? colors.bg.subtle : 'transparent', opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="body" weight={600} style={{ flex: 1, minWidth: 0 }}>{t.name}</Text>
            {t.weakest ? <Badge label="Weakest" tone="gold" /> : null}
            <Text variant="bodySmall" color="secondary">{scoreText}</Text>
            <Icon name="chevron-forward" size={16} color={colors.text.secondary} />
          </Pressable>
        );
      })}
    </Card>
  );
}

export function LearnHubV2() {
  const { isOffline } = useNetwork();
  const params = useLocalSearchParams<{ [TOPIC_PICKER_PARAM]?: string }>();
  const revise = params[TOPIC_PICKER_PARAM];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [topics, setTopics] = useState<TopicRevisionItem[] | null>(null);

  // Home's "Choose another topic" opens the Learn tab with the picker open.
  // Clear the param so the next link from Home opens it again.
  useEffect(() => {
    if (revise !== 'topics') return;
    setPickerOpen(true);
    router.setParams({ [TOPIC_PICKER_PARAM]: undefined } as never);
  }, [revise]);

  // Read-only: the existing local topic scores, refreshed each time Learn is shown.
  useFocusEffect(useCallback(() => {
    void loadUserProgress()
      .then((p) => setTopics(topicRevisionList(p?.topicScores as Record<string, number> | undefined)))
      .catch(() => setTopics(topicRevisionList(null)));
  }, []));

  const pick = (ids: string[]) => LEARN_HUB.filter((e) => ids.includes(e.id));
  const row = (e: HubEntry) =>
    e.id === 'topic-revision'
      ? <HubRow key={e.id} entry={e} expanded={pickerOpen} onPress={() => setPickerOpen((o) => !o)} />
      : <HubRow key={e.id} entry={e} disabledNote={isOffline && e.onlineOnly ? 'Requires internet' : null} />;
  return (
    <HubShell title="Learn" subtitle="Everything you need to pass" testID="learn-hub">
      <HubGrid>{pick(['practice', 'topic-revision', 'ask-pip']).map(row)}</HubGrid>
      {pickerOpen && <TopicPicker topics={topics} />}
      <SectionTitle>{'Practice modes'}</SectionTitle>
      <HubGrid>{pick(['weak-spots', 'speed-round', 'battle', 'challenge', 'bookmarked']).map(row)}</HubGrid>
      <SectionTitle>{'Revise'}</SectionTitle>
      <HubGrid>{pick(['road-signs', 'highway-code']).map(row)}</HubGrid>
      <SectionTitle>{'Plan'}</SectionTitle>
      <HubGrid>{pick(['study-plan', 'ai-study-plan']).map(row)}</HubGrid>
    </HubShell>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

type RecentResult = { kind: 'mock' | 'hazard'; when: string; score: string; passed: boolean };

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function TestsHubV2() {
  const { colors } = useDesignTheme();
  const [recent, setRecent] = useState<RecentResult[] | null>(null);
  useFocusEffect(useCallback(() => {
    // Read-only view of the existing local history. No new data.
    void loadUserProgress().then((p) => {
      if (!p) { setRecent([]); return; }
      const mocks = (p.mockTestHistory ?? []).map((m) => {
        const x = m as typeof m & { total?: number };
        return { at: m.takenAt, r: { kind: 'mock' as const, when: formatDay(m.takenAt), score: x.total ? `${m.score}/${x.total}` : `${m.score}`, passed: m.passed } };
      });
      const hazards = (p.hazardPerceptionHistory ?? []).map((h) => {
        const x = h as typeof h & { takenAt?: string; score?: number; maxScore?: number };
        return { at: x.takenAt ?? '', r: { kind: 'hazard' as const, when: x.takenAt ? formatDay(x.takenAt) : '', score: x.score !== undefined ? `${x.score}${x.maxScore ? `/${x.maxScore}` : ''}` : '', passed: h.passed } };
      });
      setRecent([...mocks, ...hazards].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((e) => e.r));
    }).catch(() => setRecent([]));
  }, []));
  const isWeb = Platform.OS === 'web';
  return (
    <HubShell title="Tests" subtitle="Practise under real test conditions" testID="tests-hub">
      <HubGrid>
        {TESTS_HUB.map((e) => (
          <HubRow key={e.id} entry={e} disabledNote={isWeb && e.nativeOnly ? 'Available in the iOS and Android app' : null} />
        ))}
      </HubGrid>
      <SectionTitle>{'Your recent results'}</SectionTitle>
      <Card padding={14} testID="recent-results">
        {recent === null ? (
          <Text variant="bodySmall" color="secondary">{'Loading…'}</Text>
        ) : recent.length === 0 ? (
          <Text variant="bodySmall" color="secondary">{'No results yet. Your mock and hazard scores will appear here.'}</Text>
        ) : recent.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget }}>
            <Icon name={r.kind === 'mock' ? 'clipboard-outline' : 'play-circle-outline'} size={22} color={colors.text.brand} />
            <Text variant="bodySmall" weight={600} style={{ flex: 1 }}>{`${r.kind === 'mock' ? 'Mock test' : 'Hazard perception'}${r.when ? ` · ${r.when}` : ''}`}</Text>
            {r.score ? <Text variant="bodySmall" color="secondary">{r.score}</Text> : null}
            <Text variant="caption" weight={700} color={r.passed ? 'success' : 'error'}>{r.passed ? 'Passed' : 'Not yet'}</Text>
          </View>
        ))}
      </Card>
    </HubShell>
  );
}

// ─── Progress: links above the existing Progress screen ─────────────────────

export function ProgressLinksV2() {
  const { colors, space } = useDesignTheme();
  return (
    <View testID="progress-links" style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.md, paddingVertical: 8, backgroundColor: colors.bg.canvas, borderBottomWidth: 1, borderBottomColor: colors.border.default }}>
      {PROGRESS_LINKS.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => go(e.route)}
          accessibilityRole="button"
          accessibilityLabel={`${e.title}. ${e.subtitle}`}
          testID={`hub-${e.id}`}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: minTouchTarget, paddingHorizontal: 12,
            borderRadius: 999, backgroundColor: colors.bg.brandSubtle, opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={e.icon as IconName} size={18} color={colors.text.brand} />
          <Text variant="label" weight={700} style={{ color: colors.text.brand }}>{e.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}
