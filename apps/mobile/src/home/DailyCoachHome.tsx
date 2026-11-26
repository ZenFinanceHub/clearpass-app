import React, { useState } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import type { UserProgress } from '@clearpass/core';
import RoadmapPath from '@/src/components/RoadmapPath';
import { useDesignTheme } from '@/src/design';
import { contentMaxWidth, minTouchTarget } from '@/src/design/tokens';
import { Badge, Button, Card, Icon, ProgressBar, ScreenHeader, Text, type IconName } from '@/src/ui';
import { useClientDimensions } from '@/src/hooks/useClientDimensions';
import { PipCard, POSE_TO_MOOD } from './PipCard';
import { copy } from './homeCopy';
import type { HomeRoute, HomeViewModel, PlanItem, QuickAction, Recommendation } from './homeViewModel';

export interface DailyCoachHomeProps {
  vm: HomeViewModel;
  /** Passed straight to the existing RoadmapPath (unchanged component). */
  progress: UserProgress | null;
  onNavigate: (route: HomeRoute | string) => void;
  onSetTestDate: () => void;
  /** Personal Go Pro line (existing homeProBannerSub copy), when free. */
  upgradeBody?: string;
  /** Extra bottom padding, e.g. for a tab bar drawn over the scroll view. */
  bottomInset?: number;
}

const WIDE = 1024;

/**
 * ClearPass 2.0 Daily Coach Home (spec §6.1 hierarchy):
 * 1 greeting + countdown · 2 Road to Test Ready · 3 Pip · 4 one next step ·
 * 5 quick access · 6 daily goal + streak. Presentation only: everything
 * comes from the view model and the existing RoadmapPath.
 */
export function DailyCoachHome({ vm, progress, onNavigate, onSetTestDate, upgradeBody, bottomInset = 0 }: DailyCoachHomeProps) {
  const { colors, space } = useDesignTheme();
  const dims = useClientDimensions();
  const width = dims?.width ?? 390;
  const wide = width >= WIDE;
  const gutter = wide ? space.xxl : space.md;
  const loading = vm.state === 'loading';

  const greeting = <Greeting vm={vm} onSetTestDate={onSetTestDate} onNavigate={onNavigate} stacked={width < 360} />;
  const roadmap = loading ? <Skeleton height={300} /> : <RoadmapCard vm={vm} progress={progress} />;
  const pip = <PipCard pose={vm.pip.pose} title={vm.pip.title} message={vm.pip.message} />;
  const next = loading ? <Skeleton height={140} /> : <NextStep rec={vm.recommendation} onNavigate={onNavigate} />;
  const quick = <QuickAccess actions={vm.quickActions} onNavigate={onNavigate} columns={wide && vm.quickActions.length === 4 ? 2 : vm.quickActions.length} />;
  const goals = loading ? <Skeleton height={180} /> : (
    <View style={{ gap: space.sm }}>
      <DailyGoal vm={vm} onNavigate={onNavigate} />
      <StreakCard vm={vm} />
    </View>
  );
  const resultPrompt = vm.showTestResultPrompt ? <TestResultPrompt onNavigate={onNavigate} /> : null;
  const upgrade = vm.upgrade ? <UpgradeCard vm={vm} body={upgradeBody} onNavigate={onNavigate} /> : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.canvas }}
      contentContainerStyle={{ paddingBottom: space.xxl + bottomInset }}
      testID="daily-coach-home"
    >
      <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: space.sm, gap: space.md }}>
        <ScreenHeader showProfileButton={wide} onProfilePress={() => onNavigate('/(tabs)/settings')} />
        {greeting}
        {resultPrompt}
        {wide ? (
          <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
            <View style={{ flex: 3, gap: space.md, minWidth: 0 }}>
              {roadmap}
              {pip}
              {next}
            </View>
            <View style={{ flex: 2, gap: space.md, minWidth: 0 }}>
              <SectionTitle>{'Quick access'}</SectionTitle>
              {quick}
              {goals}
              {upgrade}
            </View>
          </View>
        ) : (
          <>
            {roadmap}
            {pip}
            {next}
            <SectionTitle>{'Quick access'}</SectionTitle>
            {quick}
            {goals}
            {upgrade}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return <Text variant="heading" weight={700} style={{ marginTop: 4 }}>{children}</Text>;
}

function Skeleton({ height }: { height: number }) {
  const { colors, radii } = useDesignTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: radii.card, backgroundColor: colors.bg.subtle, borderWidth: 1, borderColor: colors.border.default }}
    />
  );
}

function Greeting({ vm, onSetTestDate, onNavigate, stacked }: {
  vm: HomeViewModel; onSetTestDate: () => void; onNavigate: (r: string) => void; stacked: boolean;
}) {
  const { colors, radii } = useDesignTheme();
  const c = vm.countdown;
  const icon: IconName = c.kind === 'none' ? 'calendar-clear-outline' : c.kind === 'past' ? 'ribbon-outline' : 'calendar-outline';
  const onPress = c.kind === 'past' ? () => onNavigate('/ipassed') : c.kind === 'today' ? () => onNavigate('/testday') : onSetTestDate;
  const a11y =
    c.kind === 'days' ? `${c.title} ${c.subtitle}. Change test date`
    : c.kind === 'none' ? 'Set a test date, optional'
    : `${c.title}. ${c.subtitle}`;

  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', gap: 12 }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text variant="display" numberOfLines={1} style={{ flexShrink: 1 }}>{vm.greeting.title}</Text>
          {vm.isPro && <Badge label="Pro" tone="gold" icon="star" accessibilityLabel="Pro member" />}
        </View>
        <Text variant="body" color="secondary">{vm.greeting.subtitle}</Text>
      </View>
      {vm.state !== 'loading' && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          testID="countdown"
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.bg.brandSubtle, borderRadius: radii.card,
            paddingHorizontal: 14, paddingVertical: 10, minHeight: minTouchTarget,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={icon} size={26} color={colors.text.brand} />
          <View>
            <Text variant="heading" weight={700} style={{ color: colors.text.brand }}>{c.title}</Text>
            <Text variant="bodySmall" color="secondaryOnTint">{c.subtitle}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function RoadmapCard({ vm, progress }: { vm: HomeViewModel; progress: UserProgress | null }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const height = Math.round(Math.max(240, Math.min(360, w * 0.68)));
  return (
    <Card padding={0} style={{ overflow: 'hidden' }} testID="roadmap-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <Text variant="heading" weight={700} style={{ flex: 1 }}>{'Your road to Test Ready'}</Text>
        <Badge label={`${vm.roadmapValue}% ready`} tone="solid" />
      </View>
      <View onLayout={onLayout} style={{ width: '100%' }}>
        {w > 0 && (
          <RoadmapPath progress={progress} passProbability={vm.roadmapValue} pipMood={POSE_TO_MOOD[vm.pip.pose]} width={w} height={height} />
        )}
      </View>
    </Card>
  );
}

const REC_ICON: Record<Recommendation['icon'], IconName> = {
  school: 'school', flag: 'flag', refresh: 'refresh', clipboard: 'clipboard', locate: 'locate', eye: 'eye', shuffle: 'shuffle',
};

function NextStep({ rec, onNavigate }: { rec: Recommendation; onNavigate: (r: string) => void }) {
  const { colors, radii } = useDesignTheme();
  return (
    <Card elevation="raised" testID="next-step">
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={{ width: 56, height: 56, borderRadius: radii.control, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={REC_ICON[rec.icon]} size={28} color={colors.text.onPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="navigate-circle-outline" size={18} color={colors.text.secondaryBrand} />
            <Text variant="label" weight={700} color="secondaryBrand">{'Your next step'}</Text>
          </View>
          <Text variant="heading" weight={700}>{rec.title}</Text>
          <Text variant="bodySmall" color="secondary">{rec.description}</Text>
        </View>
      </View>
      <Button
        label={rec.cta}
        icon="arrow-forward"
        size="lg"
        onPress={() => onNavigate(rec.route)}
        accessibilityLabel={`${rec.cta}: ${rec.title}`}
        style={{ marginTop: 14, alignSelf: 'stretch' }}
        testID="next-step-cta"
      />
    </Card>
  );
}

function QuickAccess({ actions, onNavigate, columns }: { actions: QuickAction[]; onNavigate: (r: string) => void; columns: number }) {
  const { colors, radii } = useDesignTheme();
  const tint: Record<QuickAction['id'], { bg: string; fg: string }> = {
    mock: { bg: colors.bg.brandSubtle, fg: colors.text.brand },
    hazards: { bg: colors.bg.secondarySubtle, fg: colors.text.secondaryBrand },
    signs: { bg: colors.bg.goldSubtle, fg: colors.status.error },
    pip: { bg: colors.bg.brandSubtle, fg: colors.text.brand },
  };
  const rows: QuickAction[][] = [];
  for (let i = 0; i < actions.length; i += columns) rows.push(actions.slice(i, i + columns));
  return (
    <View style={{ gap: 10 }} accessibilityRole="list">
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => onNavigate(a.route)}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              testID={`quick-${a.id}`}
              style={({ pressed }) => ({
                flex: 1, minHeight: 88, borderRadius: radii.card, backgroundColor: tint[a.id].bg,
                alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name={a.icon as IconName} size={28} color={tint[a.id].fg} />
              <Text variant="label" weight={600} align="center" numberOfLines={2}>{a.label}</Text>
            </Pressable>
          ))}
          {row.length < columns && Array.from({ length: columns - row.length }).map((_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

function PlanRow({ item, onNavigate }: { item: PlanItem; onNavigate: (r: string) => void }) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      onPress={() => onNavigate(item.route)}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}${item.detail ? `, ${item.detail}` : ''}, ${item.done ? 'done' : 'not done yet'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.done ? colors.status.success : colors.border.strong} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySmall" weight={600} style={item.done ? { textDecorationLine: 'line-through' } : undefined}>{item.label}</Text>
        {item.detail ? <Text variant="caption" color="secondary" numberOfLines={1}>{item.detail}</Text> : null}
      </View>
      {item.done
        ? <Text variant="caption" weight={600} color="success">{'Done'}</Text>
        : <Icon name="chevron-forward" size={18} color={colors.text.secondary} />}
    </Pressable>
  );
}

function DailyGoal({ vm, onNavigate }: { vm: HomeViewModel; onNavigate: (r: string) => void }) {
  const { colors } = useDesignTheme();
  const { completed, total, items } = vm.dailyPlan;
  return (
    <Card testID="daily-goal">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Icon name="locate" size={28} color={colors.text.brand} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" weight={700}>{'Daily goal'}</Text>
          <Text variant="bodySmall" color="secondary">{`${completed} of ${total} completed`}</Text>
        </View>
      </View>
      <ProgressBar value={completed / total} label={`Daily goal: ${completed} of ${total} completed`} />
      <View style={{ marginTop: 6 }}>
        {items.map((i) => <PlanRow key={i.id} item={i} onNavigate={onNavigate} />)}
      </View>
    </Card>
  );
}

function StreakCard({ vm }: { vm: HomeViewModel }) {
  const { colors } = useDesignTheme();
  const s = vm.streak;
  return (
    <Card testID="streak">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.goldSubtle, alignItems: 'center', justifyContent: 'center' }}>
          {/* Gold is decoration here; the text carries the meaning. */}
          <Icon name="flame" size={26} color={colors.accent.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" color="secondary">{'Streak'}</Text>
          <Text variant="heading" weight={700}>{s.label}</Text>
        </View>
        <Badge label={s.note} tone={s.atRisk ? 'info' : s.days > 0 ? 'gold' : 'neutral'} />
      </View>
    </Card>
  );
}

function UpgradeCard({ vm, body, onNavigate }: { vm: HomeViewModel; body?: string; onNavigate: (r: string) => void }) {
  const u = vm.upgrade!;
  const isMock = u.kind === 'free-mock';
  return (
    <Card surface="subtle" elevation="flat" testID="upgrade">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Badge label={isMock ? 'Free' : 'Pro'} tone={isMock ? 'success' : 'gold'} icon={isMock ? 'gift-outline' : 'star'} />
        <Text variant="bodyStrong" weight={700}>{u.title}</Text>
      </View>
      <Text variant="bodySmall" color="secondaryOnTint">{isMock ? copy.upgrade.freeMockBody : (body ?? '')}</Text>
      <Button
        label={isMock ? 'Start mock' : 'See plans'}
        variant="outline"
        onPress={() => onNavigate(u.route)}
        style={{ marginTop: 12, alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

function TestResultPrompt({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <Card surface="brandSubtle" elevation="flat" testID="test-result">
      <Text variant="heading" weight={700}>{'How did your test go?'}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <Button label="I passed!" onPress={() => onNavigate('/ipassed?flow=passed')} />
        <Button label="I need to resit" variant="outline" onPress={() => onNavigate('/ipassed?flow=resit')} />
      </View>
    </Card>
  );
}
