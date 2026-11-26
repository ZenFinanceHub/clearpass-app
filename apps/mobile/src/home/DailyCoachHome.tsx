import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import type { UserProgress } from '@clearpass/core';
import RoadmapPath from '@/src/components/RoadmapPath';
import { Pip } from '@/src/components/Pip';
import { useDesignTheme } from '@/src/design';
import { contentMaxWidth, minTouchTarget } from '@/src/design/tokens';
import { Badge, Button, Card, Icon, ProgressBar, Text, type IconName } from '@/src/ui';
import { copy } from './homeCopy';
import { TOPIC_PICKER_ROUTE } from '@/src/nav/routeMap';
import type { Coach, HomeViewModel, PlanItem, QuickAction, Upgrade } from './homeViewModel';
import type { PipPose } from './homeViewModel';
import type { PipMood } from '@/src/components/Pip';

export interface DailyCoachHomeProps {
  vm: HomeViewModel;
  /** Passed straight to the existing RoadmapPath (unchanged component). */
  progress: UserProgress | null;
  onNavigate: (route: string) => void;
  onSetTestDate: () => void;
  onRetry?: () => void;
  /** Hide the icon + wordmark row (the desktop sidebar already shows it). */
  hideBrand?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Today's Question of the Day (from @clearpass/content), shown when vm.qotd is set. */
  qotdQuestion?: QotdQuestion | null;
  /** Option chosen today (from '@clearpass/qotd_<date>'), or null. */
  qotdSelected?: number | null;
  onQotdAnswer?: (optionIndex: number) => void;
  /** "Not now" on a nudge headline (dismissNudge in src/tutorNudges.ts). */
  onDismissNudge?: (id: string) => void;
  /** The existing ReminderOffer, rendered when vm.secondaryCard is the reminder offer. */
  reminderOffer?: React.ReactNode;
}

export interface QotdQuestion { questionText: string; options: ReadonlyArray<string>; correctIndex: number; explanation?: string }

/** View-model pose (asset name) -> existing Pip mood key. Every pose is an existing PNG. */
export const POSE_TO_MOOD: Record<PipPose, PipMood> = {
  celebrating: 'celebrate', encouraging: 'sympathetic', neutral: 'happy', sleepy: 'sleepy',
  streak: 'streak', teaching: 'teaching', thinking: 'curious',
};
/**
 * The Pip PNGs have different amounts of transparent padding (measured
 * alpha bounding boxes of the @3x files, as fractions of 360x432). To show
 * every pose at a similar visible size, each is scaled and centred inside a
 * clipped frame. The artwork itself is not altered.
 */
const POSE_BBOX: Record<PipPose, [number, number, number, number]> = {
  celebrating: [54, 107, 295, 352], encouraging: [110, 123, 246, 284], neutral: [129, 111, 333, 347],
  sleepy: [42, 113, 250, 321], streak: [39, 118, 319, 343], teaching: [32, 87, 329, 382], thinking: [77, 112, 298, 362],
};
function poseFrame(pose: PipPose, frameW: number) {
  const [x0, y0, x1, y1] = POSE_BBOX[pose];
  const wf = (x1 - x0) / 360;
  const hf = (y1 - y0) / 432;
  const scale = Math.min(0.72 / hf, 0.95 / wf);
  const size = Math.round(frameW * scale);
  const cx = ((x0 + x1) / 2 / 360) * size;
  const cy = ((y0 + y1) / 2 / 432) * size * 1.2;
  return { size, left: Math.round(frameW / 2 - cx), top: Math.round((frameW * 1.2) / 2 - cy) };
}

/** Container width at which the dashboard switches to two columns. */
const TWO_COLUMN = 720;

/**
 * ClearPass 2.0 Daily Coach Home (spec §6.1 hierarchy):
 * greeting + countdown · Road to Test Ready · Daily Coach card (Pip's advice
 * and the one recommended activity) · quick access · daily goal + streak.
 * Presentation only: everything comes from the view model and the existing
 * RoadmapPath.
 */
export function DailyCoachHome({
  vm, progress, onNavigate, onSetTestDate, onRetry, hideBrand, refreshControl,
  qotdQuestion, qotdSelected = null, onQotdAnswer, onDismissNudge, reminderOffer,
}: DailyCoachHomeProps) {
  const { colors, space, textStyle } = useDesignTheme();
  const window = useWindowDimensions();
  // Effective text scale (in-app Large Text x emulated OS scale) for layout decisions.
  const textScale = (textStyle('label').fontSize ?? 14) / 14;
  const [containerW, setContainerW] = useState(0);
  const width = containerW || window.width || 390;
  const wide = width >= TWO_COLUMN;
  const gutter = wide ? space.xxl : space.md;
  const loading = vm.state === 'loading';
  const errored = vm.state === 'error';
  const colW = Math.min(width, contentMaxWidth) - gutter * 2;

  const roadmap = loading ? <RoadmapSkeleton wide={wide} /> : errored ? null : <RoadmapCard vm={vm} progress={progress} wide={wide} />;
  const pipW = wide ? 140 : colW < 320 || textScale > 1.25 ? 64 : 92;
  const coach = loading ? <CoachSkeleton /> : <CoachCard coach={vm.coach} onNavigate={onNavigate} onRetry={onRetry} onDismissNudge={onDismissNudge} compact={!wide} pipW={pipW} />;
  // At most one secondary contextual card (the view model picks it).
  const sc = vm.secondaryCard;
  const invites = sc?.kind === 'challenge-invites' ? <InvitesCard title={sc.title} count={sc.count} onPress={() => onNavigate(sc.route)} /> : null;
  const reminder = sc?.kind === 'reminder-offer' && reminderOffer ? <View testID="reminder-offer">{reminderOffer}</View> : null;
  const n = vm.quickActions.length;
  // 4 (or 3) across on phones; 2 across on desktop or when labels would clip (narrow / large text).
  const quickColumns = (wide && n === 4) || colW / n < 80 * textScale ? 2 : n;
  const quick = loading ? <TilesSkeleton count={4} /> : (
    <QuickAccess actions={vm.quickActions} onNavigate={onNavigate} columns={quickColumns} />
  );
  const goals = loading ? <GoalSkeleton /> : errored ? null : (
    <View style={{ gap: space.sm }}>
      <DailyGoal vm={vm} onNavigate={onNavigate} qotdQuestion={qotdQuestion ?? null} qotdSelected={qotdSelected} onQotdAnswer={onQotdAnswer} />
      <StreakCard vm={vm} />
    </View>
  );
  const upgrade = vm.upgrade ? <UpgradeCard upgrade={vm.upgrade} onNavigate={onNavigate} /> : null;
  const resultPrompt = vm.showTestResultPrompt ? <TestResultPrompt onNavigate={onNavigate} /> : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.canvas }}
      contentContainerStyle={{ paddingBottom: space.xl }}
      onLayout={(e: LayoutChangeEvent) => setContainerW(Math.round(e.nativeEvent.layout.width))}
      refreshControl={refreshControl}
      testID="daily-coach-home"
    >
      <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: wide ? space.xl : space.xs, gap: wide ? space.md : space.sm }}>
        <TopRows vm={vm} wide={wide} hideBrand={hideBrand} onSetTestDate={onSetTestDate} onNavigate={onNavigate} narrow={colW < 260 * textScale} />
        {resultPrompt}
        {wide ? (
          <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
            <View style={{ flex: 3, gap: space.md, minWidth: 0 }}>
              {roadmap}
              {coach}
              {invites}
            </View>
            <View style={{ flex: 2, gap: space.md, minWidth: 0 }}>
              <SectionTitle>{'Quick access'}</SectionTitle>
              {quick}
              {reminder}
              {goals}
              {upgrade}
            </View>
          </View>
        ) : (
          <>
            {roadmap}
            {coach}
            {invites}
            <SectionTitle>{'Quick access'}</SectionTitle>
            {quick}
            {reminder}
            {goals}
            {upgrade}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Top: brand row, greeting, countdown ─────────────────────────────────────

function Brand() {
  const { colors } = useDesignTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: minTouchTarget }} accessible accessibilityRole="header" accessibilityLabel="ClearPass">
      <Image source={require('../../assets/favicon.png')} style={{ width: 28, height: 28, borderRadius: 7 }} accessible={false} />
      <Text variant="heading" weight={700} style={{ color: colors.text.brand }}>{'ClearPass'}</Text>
    </View>
  );
}

function TopRows({ vm, wide, hideBrand, onSetTestDate, onNavigate, narrow }: {
  vm: HomeViewModel; wide: boolean; hideBrand?: boolean; onSetTestDate: () => void; onNavigate: (r: string) => void; narrow: boolean;
}) {
  const showChip = vm.state !== 'loading' && vm.state !== 'error';
  const chip = showChip ? <CountdownChip vm={vm} onSetTestDate={onSetTestDate} onNavigate={onNavigate} large={wide} /> : null;
  const greeting = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant={wide ? 'display' : 'title'} numberOfLines={1} style={{ flexShrink: 1 }}>{vm.greeting.title}</Text>
        {vm.isPro && <Badge label="Pro" tone="gold" icon="star" accessibilityLabel="Pro member" />}
      </View>
      <Text variant={wide ? 'body' : 'bodySmall'} color="secondary" numberOfLines={2}>{vm.greeting.subtitle}</Text>
    </View>
  );

  if (wide) {
    return (
      <>
        {!hideBrand && <Brand />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {greeting}
          {chip}
        </View>
      </>
    );
  }
  // Mobile: brand + countdown share one row; greeting underneath (one line).
  return (
    <>
      <View style={{ flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 8 }}>
        {hideBrand ? <View /> : <Brand />}
        {chip}
      </View>
      {greeting}
    </>
  );
}

function CountdownChip({ vm, onSetTestDate, onNavigate, large }: {
  vm: HomeViewModel; onSetTestDate: () => void; onNavigate: (r: string) => void; large: boolean;
}) {
  const { colors, radii } = useDesignTheme();
  const c = vm.countdown;
  const icon: IconName = c.kind === 'none' ? 'calendar-clear-outline' : c.kind === 'past' ? 'ribbon-outline' : 'calendar-outline';
  const onPress = c.kind === 'past' ? () => onNavigate('/ipassed') : c.kind === 'today' ? () => onNavigate('/testday') : onSetTestDate;
  const a11y =
    c.kind === 'days' ? `${c.title} ${c.subtitle}. Change test date`
    : c.kind === 'none' ? 'Add your test date, optional'
    : `${c.title}. ${c.subtitle}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      testID="countdown"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: large ? 10 : 8,
        backgroundColor: colors.bg.brandSubtle, borderRadius: radii.control,
        paddingHorizontal: large ? 14 : 10, paddingVertical: large ? 10 : 4, minHeight: minTouchTarget,
        opacity: pressed ? 0.85 : 1, flexShrink: 0,
      })}
    >
      <Icon name={icon} size={large ? 26 : 20} color={colors.text.brand} />
      <View>
        <Text variant={large ? 'heading' : 'label'} weight={700} style={{ color: colors.text.brand }} numberOfLines={1}>{c.title}</Text>
        <Text variant="caption" color="secondaryOnTint" numberOfLines={1}>{c.subtitle}</Text>
      </View>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text variant="heading" weight={700} style={{ marginTop: 4 }}>{children}</Text>;
}

// ─── Road to Test Ready ──────────────────────────────────────────────────────

function RoadmapCard({ vm, progress, wide }: { vm: HomeViewModel; progress: UserProgress | null; wide: boolean }) {
  const { colors } = useDesignTheme();
  const [w, setW] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  // RoadmapPath takes an explicit height prop; the component itself is unchanged.
  const height = wide ? Math.round(Math.max(260, Math.min(380, w * 0.52))) : Math.round(Math.max(170, Math.min(230, w * 0.52)));
  const r = vm.roadmap;
  return (
    <Card padding={0} style={{ overflow: 'hidden' }} testID="roadmap-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 4, minHeight: minTouchTarget }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, paddingVertical: 6 }}>
          <Text variant="heading" weight={700} numberOfLines={2}>{copy.roadmap.title}</Text>
          {/* Journey start: no score badge; the status line below explains instead. */}
          {!r.journeyStart && <View><Badge label={r.badge} tone="solid" /></View>}
        </View>
        <Pressable
          onPress={() => setShowInfo((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="What do the readiness score and milestones mean?"
          accessibilityState={{ expanded: showInfo }}
          style={{ width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
          testID="roadmap-info"
        >
          <Icon name={showInfo ? 'information-circle' : 'information-circle-outline'} size={22} color={colors.text.secondary} />
        </Pressable>
      </View>
      {(showInfo || r.journeyLine) && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 4 }}>
          {r.journeyLine && (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} testID="journey-start">
              <Icon name="flag" size={16} color={colors.status.success} />
              <Text variant="bodySmall" color="secondary" style={{ flex: 1 }}>
                <Text variant="bodySmall" weight={700} color="success">{copy.roadmap.journeyBadge}</Text>
                {` · ${r.journeyLine}`}
              </Text>
            </View>
          )}
          {showInfo && <Text variant="bodySmall" color="secondary" accessibilityLiveRegion="polite">{r.explainer}</Text>}
        </View>
      )}
      <View onLayout={onLayout} style={{ width: '100%', height }}>
        {w > 0 && (
          <RoadmapPath progress={progress} passProbability={r.value} pipMood={POSE_TO_MOOD[vm.coach.pose]} width={w} height={height} />
        )}
      </View>
    </Card>
  );
}

// ─── Daily Coach card: Pip's advice + the one recommended activity ──────────

function CoachCard({ coach, onNavigate, onRetry, onDismissNudge, compact, pipW }: {
  coach: Coach; onNavigate: (r: string) => void; onRetry?: () => void; onDismissNudge?: (id: string) => void; compact: boolean; pipW: number;
}) {
  const { colors } = useDesignTheme();
  const frame = poseFrame(coach.pose, pipW);
  return (
    <Card elevation="raised" padding={compact ? 12 : 20} testID="coach-card">
      <View style={{ flexDirection: 'row', gap: compact ? 12 : 18, alignItems: 'center' }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Pip the hedgehog"
          style={{ width: pipW, height: Math.round(pipW * 1.2), overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', left: frame.left, top: frame.top }}>
            <Pip size={frame.size} mood={POSE_TO_MOOD[coach.pose]} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="chatbubble-ellipses" size={16} color={colors.text.secondaryBrand} />
            <Text variant="caption" weight={700} color="secondaryBrand" style={{ flex: 1 }}>{'Your Daily Coach'}</Text>
            {coach.nudgeId && onDismissNudge ? (
              // The headline came from a tutor nudge: let the learner put it away.
              <Pressable
                onPress={() => onDismissNudge(coach.nudgeId!)}
                accessibilityRole="button"
                accessibilityLabel={`${copy.nudgeDismiss}: dismiss “${coach.headline}”`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => ({ paddingHorizontal: 6, paddingVertical: 2, opacity: pressed ? 0.7 : 1 })}
                testID="coach-nudge-dismiss"
              >
                <Text variant="caption" weight={600} color="secondary">{copy.nudgeDismiss}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text variant={compact ? 'bodyStrong' : 'heading'} weight={700}>{coach.headline}</Text>
          <Text variant="bodySmall" color="secondary">{coach.advice}</Text>
        </View>
      </View>
      {coach.action ? (
        <>
          <Button
            label={coach.action.cta}
            icon="arrow-forward"
            size="lg"
            numberOfLines={2}
            onPress={() => onNavigate(coach.action!.route)}
            style={{ marginTop: compact ? 10 : 16, alignSelf: 'stretch' }}
            testID="coach-cta"
          />
          {coach.action.id === 'weak-topic' ? (
            // Topic revision: practise a different topic instead (opens the Learn picker).
            <Button
              label="Choose another topic"
              variant="ghost"
              icon="list-outline"
              iconPosition="left"
              onPress={() => onNavigate(TOPIC_PICKER_ROUTE)}
              style={{ marginTop: 4, alignSelf: 'stretch' }}
              testID="coach-choose-topic"
            />
          ) : null}
        </>
      ) : onRetry ? (
        <Button label={copy.retry} icon="refresh" iconPosition="left" size="lg" onPress={onRetry} style={{ marginTop: 12, alignSelf: 'stretch' }} testID="coach-retry" />
      ) : null}
    </Card>
  );
}

// ─── Quick access, daily goal, streak, upgrade ──────────────────────────────

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
    <View style={{ gap: 10 }}>
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
                flex: 1, minHeight: 76, borderRadius: radii.card, backgroundColor: tint[a.id].bg,
                alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name={a.icon as IconName} size={26} color={tint[a.id].fg} />
              <Text variant="label" weight={600} align="center" numberOfLines={2}>{a.label}</Text>
            </Pressable>
          ))}
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
      disabled={item.done}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}${item.detail ? `, ${item.detail}` : ''}, ${item.done ? 'done' : 'not done yet'}`}
      accessibilityState={{ disabled: item.done }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.done ? colors.status.success : colors.border.strong} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Done: softer (secondary) text and a tick; no strikethrough. */}
        <Text variant="bodySmall" weight={600} color={item.done ? 'secondary' : 'primary'}>{item.label}</Text>
        {item.detail ? <Text variant="caption" color="secondary" numberOfLines={2}>{item.detail}</Text> : null}
      </View>
      {item.done
        ? <Text variant="caption" weight={700} color="success">{'Done'}</Text>
        : <Icon name="chevron-forward" size={18} color={colors.text.secondary} />}
    </Pressable>
  );
}

function DailyGoal({ vm, onNavigate, qotdQuestion, qotdSelected, onQotdAnswer }: {
  vm: HomeViewModel; onNavigate: (r: string) => void;
  qotdQuestion: QotdQuestion | null; qotdSelected: number | null; onQotdAnswer?: (i: number) => void;
}) {
  const { colors } = useDesignTheme();
  const { completed, total, items } = vm.dailyPlan;
  const extras = !!vm.scheduledMock || (!!vm.qotd && !!qotdQuestion);
  return (
    <Card testID="daily-goal" padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Icon name="locate" size={24} color={colors.text.brand} />
        <Text variant="bodyStrong" weight={700} style={{ flex: 1 }}>{'Daily goal'}</Text>
        <Text variant="bodySmall" color="secondary">{`${completed} of ${total} done`}</Text>
      </View>
      <ProgressBar value={completed / total} label={`Daily goal: ${completed} of ${total} completed`} tone={completed === total ? 'success' : 'brand'} />
      <View style={{ marginTop: 4 }}>
        {items.map((i) => <PlanRow key={i.id} item={i} onNavigate={onNavigate} />)}
      </View>
      {extras && (
        // Extras sit under a divider: they are not part of the "N of M done" count.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.default, marginTop: 4, paddingTop: 2 }}>
          {vm.scheduledMock && <ScheduledMockRow row={vm.scheduledMock} onNavigate={onNavigate} />}
          {vm.qotd && qotdQuestion && (
            <QotdRow row={vm.qotd} question={qotdQuestion} selected={qotdSelected} onAnswer={onQotdAnswer} />
          )}
        </View>
      )}
    </Card>
  );
}

function ScheduledMockRow({ row, onNavigate }: { row: NonNullable<HomeViewModel['scheduledMock']>; onNavigate: (r: string) => void }) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      onPress={() => onNavigate(row.route)}
      accessibilityRole="button"
      accessibilityLabel={`${copy.scheduled.prefix}: ${row.label}, ${row.when}. Open mock tests`}
      testID="scheduled-mock"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name="alarm-outline" size={24} color={colors.text.brand} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySmall" weight={600}>{`${copy.scheduled.prefix}: ${row.label}`}</Text>
        <Text variant="caption" color="secondary">{row.when}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.text.secondary} />
    </Pressable>
  );
}

/**
 * Question of the Day: a collapsed row ("Question of the day · +10 XP")
 * that expands inline. Once answered it is a one-line "done" row that can
 * be expanded to review. Feedback is icon + text, never colour alone.
 */
function QotdRow({ row, question, selected, onAnswer }: {
  row: NonNullable<HomeViewModel['qotd']>; question: QotdQuestion; selected: number | null; onAnswer?: (i: number) => void;
}) {
  const { colors, radii } = useDesignTheme();
  const [open, setOpen] = useState(false);
  const done = row.state === 'done' || selected !== null;
  const correct = selected !== null ? selected === question.correctIndex : row.correct;
  const detail = selected !== null && row.state === 'open'
    ? (correct ? copy.qotd.doneCorrect : copy.qotd.doneWrong)
    : row.detail;
  return (
    <View testID="qotd">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${row.label}, ${done ? detail : `plus ${row.xp} XP`}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget, opacity: pressed ? 0.8 : 1 })}
      >
        <Icon name={done ? 'checkmark-circle' : 'help-circle-outline'} size={24} color={done ? colors.status.success : colors.text.brand} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodySmall" weight={600} color={done ? 'secondary' : 'primary'}>{row.label}</Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>{done ? detail : row.detail}</Text>
        </View>
        <Badge label={done ? `✓ +${row.xp} XP` : `+${row.xp} XP`} tone="success" />
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.secondary} />
      </Pressable>
      {open && (
        <View style={{ gap: 8, paddingBottom: 8 }}>
          <Text variant="bodySmall" weight={600}>{question.questionText}</Text>
          {question.options.map((opt, idx) => {
            const isCorrect = idx === question.correctIndex;
            const isPicked = idx === selected;
            const reveal = selected !== null;
            const tone = reveal && isCorrect ? 'success' : reveal && isPicked ? 'error' : null;
            return (
              <Pressable
                key={idx}
                onPress={() => onAnswer?.(idx)}
                disabled={reveal || !onAnswer}
                accessibilityRole="button"
                accessibilityLabel={`${opt}${tone === 'success' ? ', correct answer' : tone === 'error' ? ', your answer, incorrect' : ''}`}
                accessibilityState={{ disabled: reveal, selected: isPicked }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: minTouchTarget,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.control, borderWidth: 1,
                  borderColor: tone === 'success' ? colors.status.success : tone === 'error' ? colors.status.error : colors.border.default,
                  backgroundColor: tone === 'success' ? colors.status.successBg : tone === 'error' ? colors.status.errorBg : colors.bg.card,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="bodySmall" style={{ flex: 1 }}>{opt}</Text>
                {tone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name={tone === 'success' ? 'checkmark-circle' : 'close-circle'} size={18} color={colors.status[tone]} />
                    <Text variant="caption" weight={700} color={tone}>{tone === 'success' ? 'Correct' : 'Incorrect'}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {selected !== null && question.explanation ? (
            <Text variant="bodySmall" color="secondary" accessibilityLiveRegion="polite">{question.explanation}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function InvitesCard({ title, count, onPress }: { title: string; count: number; onPress: () => void }) {
  const { colors } = useDesignTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`${count} challenge ${count === 1 ? 'invite' : 'invites'} waiting`} padding={14} testID="challenge-invites">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="people" size={24} color={colors.text.brand} />
        <Text variant="bodyStrong" weight={700} style={{ flex: 1 }}>{title}</Text>
        <Icon name="chevron-forward" size={18} color={colors.text.secondary} />
      </View>
    </Card>
  );
}

function StreakCard({ vm }: { vm: HomeViewModel }) {
  const { colors } = useDesignTheme();
  const s = vm.streak;
  return (
    <Card testID="streak" padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.goldSubtle, alignItems: 'center', justifyContent: 'center' }}>
          {/* Gold is decoration here; the text carries the meaning. */}
          <Icon name={s.days > 0 ? 'flame' : 'flame-outline'} size={24} color={colors.accent.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" weight={700}>{s.label}</Text>
          <Text variant="bodySmall" color="secondary">{s.note}</Text>
        </View>
      </View>
    </Card>
  );
}

function UpgradeCard({ upgrade, onNavigate }: { upgrade: Upgrade; onNavigate: (r: string) => void }) {
  const { colors, radii } = useDesignTheme();
  if (upgrade.kind === 'free-mock') {
    return (
      <Card testID="upgrade" padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Badge label="Free" tone="success" icon="gift-outline" />
          <Text variant="bodyStrong" weight={700} style={{ flexShrink: 1 }}>{upgrade.title}</Text>
        </View>
        <Text variant="bodySmall" color="secondary">{upgrade.body}</Text>
        <Button label={upgrade.cta} variant="outline" onPress={() => onNavigate(upgrade.route)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </Card>
    );
  }
  const p = colors.promo;
  return (
    <View testID="upgrade" style={{ backgroundColor: p.bg, borderRadius: radii.card, padding: 18, overflow: 'hidden' }}>
      {/* Decorative gold rings (no meaning, hidden from screen readers). */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
        style={{ position: 'absolute', right: -48, top: -48, width: 112, height: 112, borderRadius: 56, borderWidth: 10, borderColor: colors.accent.gold, opacity: 0.6 }} />
      <Badge label={upgrade.eyebrow} tone="gold" icon="star" />
      <Text variant="heading" weight={700} style={{ color: p.text, marginTop: 10 }}>{upgrade.headline}</Text>
      <Text variant="bodySmall" style={{ color: p.textSecondary, marginTop: 2 }}>{upgrade.sub}</Text>
      <View style={{ marginTop: 10, gap: 6 }} accessibilityRole="list">
        {upgrade.benefits.map((b) => (
          <View key={b} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="checkmark-circle" size={18} color={colors.accent.gold} />
            <Text variant="bodySmall" style={{ color: p.text, flex: 1 }}>{b}</Text>
          </View>
        ))}
      </View>
      <Button label={upgrade.cta} variant="inverse" icon="arrow-forward" onPress={() => onNavigate(upgrade.route)} style={{ marginTop: 14, alignSelf: 'stretch' }} testID="upgrade-cta" />
    </View>
  );
}

function TestResultPrompt({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <Card surface="brandSubtle" elevation="flat" testID="test-result" padding={14}>
      <Text variant="bodyStrong" weight={700}>{'How did your test go?'}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Button label="I passed!" onPress={() => onNavigate('/ipassed?flow=passed')} />
        <Button label="I need to resit" variant="outline" onPress={() => onNavigate('/ipassed?flow=resit')} />
      </View>
    </Card>
  );
}

// ─── Skeletons shaped like the content ──────────────────────────────────────

function Bone({ w, h, r = 8, style }: { w: number | `${number}%`; h: number; r?: number; style?: object }) {
  const { colors } = useDesignTheme();
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.bg.subtle }, style]} />;
}

function SkeletonCard({ children, padding = 14 }: { children: React.ReactNode; padding?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Card padding={padding} elevation="flat">{children}</Card>
    </View>
  );
}

function RoadmapSkeleton({ wide }: { wide: boolean }) {
  return (
    <SkeletonCard padding={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
        <Bone w={170} h={18} />
        <Bone w={84} h={22} r={11} />
      </View>
      <Bone w="100%" h={wide ? 300 : 192} r={0} />
    </SkeletonCard>
  );
}

function CoachSkeleton() {
  return (
    <SkeletonCard>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Bone w={84} h={100} r={42} />
        <View style={{ flex: 1, gap: 8 }}>
          <Bone w={90} h={12} />
          <Bone w="80%" h={16} />
          <Bone w="100%" h={12} />
          <Bone w="70%" h={12} />
        </View>
      </View>
      <Bone w="100%" h={52} r={12} style={{ marginTop: 12 }} />
    </SkeletonCard>
  );
}

function TilesSkeleton({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => <View key={i} style={{ flex: 1 }}><Bone w="100%" h={76} r={16} /></View>)}
    </View>
  );
}

function GoalSkeleton() {
  return (
    <SkeletonCard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Bone w={110} h={16} />
        <Bone w={70} h={14} />
      </View>
      <Bone w="100%" h={8} r={4} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <Bone w={24} h={24} r={12} />
          <Bone w="60%" h={14} />
        </View>
      ))}
    </SkeletonCard>
  );
}
