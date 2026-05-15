import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'breathe' | 'lastminute' | 'checklist';

// ─── Breathing phases ─────────────────────────────────────────────────────────

const PHASES = [
  { label: 'Breathe In',  seconds: 4, toScale: 1.5 },
  { label: 'Hold',        seconds: 4, toScale: 1.5 },
  { label: 'Breathe Out', seconds: 4, toScale: 1.0 },
  { label: 'Hold',        seconds: 2, toScale: 1.0 },
] as const;

// ─── Last-minute topics ───────────────────────────────────────────────────────

type Topic = { id: string; title: string; emoji: string; facts: string[] };

const TOPICS: Topic[] = [
  {
    id: 'stopping',
    title: 'Stopping Distances',
    emoji: '🛑',
    facts: [
      '20mph: thinking 6m + braking 6m = 12m total',
      '30mph: thinking 9m + braking 14m = 23m total',
      '50mph: thinking 15m + braking 38m = 53m total',
      '70mph: thinking 21m + braking 75m = 96m total',
      'Wet roads: double all braking distances',
      'Icy roads: 10x stopping distance — leave massive space',
    ],
  },
  {
    id: 'speed',
    title: 'Speed Limits',
    emoji: '🚗',
    facts: [
      'Built-up areas (street lights): 30mph',
      'Single carriageway: 60mph (car / motorcycle)',
      'Dual carriageway: 70mph',
      'Motorway: 70mph',
      'Towing a trailer/caravan: 50mph single, 60mph dual/motorway',
      'Look for signs — limits can vary from the default',
    ],
  },
  {
    id: 'alcohol',
    title: 'Alcohol Limits',
    emoji: '🍺',
    facts: [
      'Blood: 80mg per 100ml',
      'Breath: 35 micrograms per 100ml',
      'Urine: 107mg per 100ml',
      'Scotland: lower limits — 50mg blood / 22mcg breath',
      'Alcohol impairs reaction time, judgement and coordination',
      'You may still be over the limit the morning after',
    ],
  },
  {
    id: 'motorway',
    title: 'Motorway Rules',
    emoji: '🛣️',
    facts: [
      'Lane 1 (left) is the normal driving lane — use it when safe',
      'Lanes 2 and 3 are for overtaking only — move back left after',
      'Hard shoulder: emergencies only (not on smart motorways)',
      'Smart motorways: hard shoulder may be a running lane',
      'Emergency refuge areas (ERA) on smart motorways every 1.5 miles',
      'Never reverse, stop or turn around on a motorway',
    ],
  },
  {
    id: 'trafficlights',
    title: 'Traffic Light Sequences',
    emoji: '🚦',
    facts: [
      'Red: STOP — wait behind the stop line',
      'Red + Amber: prepare to go — do NOT move yet',
      'Green: GO if the way is clear',
      'Amber: STOP if it is safe to do so',
      'Flashing amber (pelican): give way to pedestrians on the crossing',
      'Green filter arrow: may proceed only in the direction shown',
    ],
  },
  {
    id: 'reaction',
    title: 'Reaction & Braking',
    emoji: '⚡',
    facts: [
      'Average reaction time: 0.67 seconds',
      'Thinking distance (metres) ≈ speed in mph x 0.3',
      'Tiredness, alcohol and drugs all increase reaction time',
      'ABS prevents wheel lock — it does not shorten stopping distance',
      'Minimum gap in good conditions: 2-second rule',
      'Double to 4 seconds in wet; much more in ice',
    ],
  },
  {
    id: 'roadmarkings',
    title: 'Road Markings',
    emoji: '🛤️',
    facts: [
      'Single yellow line: no parking during restricted hours',
      'Double yellow lines: no parking at any time',
      'Double white centre lines: do not cross if your side is solid',
      'Broken white centre: may cross if safe',
      'Yellow box junction: do not enter unless your exit is clear',
      'Zigzag lines near crossings: no parking or overtaking',
    ],
  },
  {
    id: 'crossings',
    title: 'Pedestrian Crossings',
    emoji: '🚶',
    facts: [
      'Pelican: pedestrian-controlled lights; flashing amber = give way',
      'Puffin: sensors detect pedestrians still crossing; no flashing amber',
      'Toucan: TWO-CAN cross — cyclists AND pedestrians',
      'Pegasus (Equestrian): for horse riders — button mounted higher',
      'Zebra: give way to anyone already on the crossing',
      'Always slow and be ready to stop at all crossings',
    ],
  },
  {
    id: 'levelcrossings',
    title: 'Level Crossings',
    emoji: '🚂',
    facts: [
      'Approach slowly and look both ways',
      'If lights flash red: STOP and wait behind the line',
      'Do not move until lights stop and barriers fully rise',
      'Stuck on a crossing: get everyone out and away immediately',
      'Call the number on the sign — tell the signaller your location',
      'Never race a barrier going down',
    ],
  },
  {
    id: 'motorwaysigns',
    title: 'Motorway Signs',
    emoji: '🔵',
    facts: [
      'Blue signs: motorway information and directions',
      'Amber flashing lights: hazard ahead — slow down',
      'Red X over a lane: that lane is CLOSED — do not use it',
      'Speed limit in red circle on gantry: mandatory maximum',
      'Countdown markers: 3 bars = 300 yards to exit',
      'White on blue: services, motorway junctions',
    ],
  },
  {
    id: 'weather',
    title: 'Weather Driving',
    emoji: '🌧️',
    facts: [
      'Wet roads: double all stopping distances',
      'Ice/snow: stopping distances up to 10x longer',
      'Aquaplaning: ease off the accelerator — do not brake hard',
      'Fog: use front fog lights only if visibility is under 100m',
      'Rear fog lights: only when visibility is under 100m — they dazzle',
      'Bright sun: slow down, keep extra distance, use sun visor',
    ],
  },
  {
    id: 'tyres',
    title: 'Tyre Safety',
    emoji: '🔧',
    facts: [
      'Minimum tread depth: 1.6mm across the central 3/4 of the tyre',
      'Recommended for safety: replace at 3mm',
      'Always check tyre pressure when tyres are COLD',
      'Wrong pressure affects handling, stopping and fuel economy',
      'Look for cuts, bulges or embedded objects before driving',
      'Under/over-inflation both increase risk of blowout',
    ],
  },
  {
    id: 'firstaid',
    title: 'First Aid at Accidents',
    emoji: '🚑',
    facts: [
      'DR ABC: Danger, Response, Airway, Breathing, Circulation',
      'Danger: make the scene safe before approaching anyone',
      'Unconscious or not breathing: call 999 immediately',
      'Bleeding: apply firm, steady pressure — do not remove embedded objects',
      'Recovery position: if breathing, roll onto their side',
      "Do NOT remove a motorcyclist's helmet unless airway is blocked",
    ],
  },
  {
    id: 'overtaking',
    title: 'Overtaking Rules',
    emoji: '↔️',
    facts: [
      'Only overtake when safe and legal',
      'Never overtake on approach to a bend, hill crest or junction',
      'Do not overtake if you would need to exceed the speed limit',
      'Pass on the right — except in slow-moving queued traffic',
      'Give cyclists at least 1.5m clearance',
      'No overtaking signs or solid white lines on your side: do not cross',
    ],
  },
  {
    id: 'childsafety',
    title: 'Child Safety',
    emoji: '👶',
    facts: [
      'Children under 12 or under 135cm must use an appropriate car seat',
      'The driver is responsible for passengers under 14',
      'Rear-facing baby seat: NEVER in front seat with active airbag',
      'Seat type depends on child height and weight — not just age',
      'Children 14 and over are responsible for wearing their own belt',
      'Every passenger must be buckled — even on short journeys',
    ],
  },
];

// ─── Checklist ────────────────────────────────────────────────────────────────

type CheckItem    = { id: string; label: string };
type CheckSection = { title: string; items: CheckItem[] };

const CHECKLIST_SECTIONS: CheckSection[] = [
  {
    title: 'MUST BRING',
    items: [
      { id: 'photo_id',     label: 'Photo ID (passport or driving licence photocard)' },
      { id: 'booking_ref',  label: 'Your booking confirmation / reference number' },
      { id: 'arrive_early', label: 'Arrive 15 minutes early' },
    ],
  },
  {
    title: 'GOOD TO KNOW',
    items: [
      { id: 'centre_addr',     label: 'Test centre address saved on your phone' },
      { id: 'phone_charged',   label: 'Phone charged (for checking in)' },
      { id: 'phone_surrender', label: 'You will surrender your phone before the test' },
      { id: 'computer_test',   label: 'Test is on a computer — ask staff if unsure how it works' },
      { id: 'rough_paper',     label: 'You get rough paper for notes' },
      { id: 'hazard_after',    label: 'Hazard perception comes after multiple choice' },
      { id: 'results_immed',   label: 'Results given immediately after the test' },
    ],
  },
  {
    title: 'ON THE DAY',
    items: [
      { id: 'had_breakfast', label: 'Had breakfast / not hungry' },
      { id: 'arrived',       label: 'Arrived at the test centre' },
      { id: 'deep_breath',   label: 'Deep breath taken 😊' },
    ],
  },
];

const ALL_ITEM_IDS  = CHECKLIST_SECTIONS.flatMap(s => s.items.map(i => i.id));
const CHECKLIST_KEY = '@clearpass/testday_checklist';

// ─── TabBar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const TABS: { id: TabId; label: string }[] = [
    { id: 'breathe',    label: 'Breathe' },
    { id: 'lastminute', label: 'Last Minute' },
    { id: 'checklist',  label: 'Checklist' },
  ];
  return (
    <View style={styles.tabBar}>
      {TABS.map(t => (
        <TouchableOpacity
          key={t.id}
          style={[styles.tab, active === t.id && styles.tabActive]}
          onPress={() => onChange(t.id)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, active === t.id && styles.tabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── BreatheTab ───────────────────────────────────────────────────────────────

function BreatheTab() {
  const theme = useTheme();
  const [breathing, setBreathing]   = useState(false);
  const [phaseIdx, setPhaseIdx]     = useState<number>(0);
  const [countdown, setCountdown]   = useState<number>(PHASES[0].seconds);

  const scaleAnim   = useRef(new Animated.Value(1.0)).current;
  const opacityAnim = useRef(new Animated.Value(0.85)).current;

  const timerRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const opacityLoopRef = useRef<Animated.CompositeAnimation   | null>(null);
  const activeRef     = useRef(false);

  function startOpacityPulse() {
    opacityAnim.setValue(0.8);
    opacityLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.8, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    opacityLoopRef.current.start();
  }

  function stopOpacityPulse() {
    opacityLoopRef.current?.stop();
    opacityAnim.setValue(0.85);
  }

  function runPhase(idx: number) {
    if (!activeRef.current) return;
    const phase = PHASES[idx % PHASES.length];
    const pIdx  = idx % PHASES.length;
    setPhaseIdx(pIdx);
    setCountdown(phase.seconds);

    scaleAnim.stopAnimation();
    Animated.timing(scaleAnim, {
      toValue:  phase.toScale,
      duration: phase.seconds * 1000,
      easing:   Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();

    let rem = phase.seconds;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      rem -= 1;
      if (rem > 0) setCountdown(rem);
    }, 1000);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      runPhase(idx + 1);
    }, phase.seconds * 1000);
  }

  function startBreathing() {
    activeRef.current = true;
    setBreathing(true);
    startOpacityPulse();
    runPhase(0);
  }

  function stopBreathing() {
    activeRef.current = false;
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    scaleAnim.stopAnimation();
    stopOpacityPulse();
    Animated.timing(scaleAnim, { toValue: 1.0, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    setBreathing(false);
    setPhaseIdx(0);
    setCountdown(PHASES[0].seconds);
  }

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      opacityLoopRef.current?.stop();
    };
  }, []);

  const currentPhase = PHASES[phaseIdx];

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.tabTitle, { color: theme.textColor, fontFamily: theme.fontFamily }]}>
        {'Take a breath 😌'}
      </Text>
      <Text style={[styles.tabSub, { color: theme.subTextColor, fontFamily: theme.fontFamily }]}>
        {"Feeling nervous is normal. Let's calm your mind."}
      </Text>

      <View style={styles.circleWrapper}>
        <Animated.View
          style={[styles.circle, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
        />
        {breathing && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.circleOverlay]}>
            <Text style={styles.phaseLabel}>{currentPhase.label}</Text>
            <Text style={styles.phaseCount}>{countdown}</Text>
          </View>
        )}
        {!breathing && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.circleOverlay]}>
            <Text style={styles.circleIdleText}>{'Press start'}</Text>
          </View>
        )}
      </View>

      {!breathing ? (
        <TouchableOpacity style={styles.startBtn} onPress={startBreathing} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>{'Start Breathing'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.stopBtn} onPress={stopBreathing} activeOpacity={0.85}>
          <Text style={styles.stopBtnText}>{'Stop'}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.phaseGuide}>
        {PHASES.map((p, i) => (
          <View key={i} style={styles.phaseGuideRow}>
            <View style={[styles.phaseGuideDot, breathing && phaseIdx === i && styles.phaseGuideDotActive]} />
            <Text style={[styles.phaseGuideText, { color: breathing && phaseIdx === i ? '#0D9488' : theme.subTextColor }]}>
              {p.label}{' — '}{p.seconds}{'s'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.reassuranceSection}>
        {[
          "44% of people feel nervous before their theory test — you're not alone.",
          "You've prepared well. Trust your practice.",
          "The examiner wants you to pass. They're on your side.",
        ].map((msg, i) => (
          <View key={i} style={[styles.reassureCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.reassureText, { color: theme.textColor, fontFamily: theme.fontFamily }]}>{msg}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── LastMinuteTab ────────────────────────────────────────────────────────────

function LastMinuteTab() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.tabTitle, { color: theme.textColor, fontFamily: theme.fontFamily }]}>
        {'Key things to remember 📝'}
      </Text>
      <Text style={[styles.tabSub, { color: theme.subTextColor, fontFamily: theme.fontFamily }]}>
        {'Tap any card to expand. Focus on the ones you find hardest.'}
      </Text>
      {TOPICS.map(topic => {
        const isOpen = expanded.has(topic.id);
        return (
          <View key={topic.id} style={[styles.topicCard, { backgroundColor: theme.cardColor }]}>
            <TouchableOpacity
              style={styles.topicHeader}
              onPress={() => toggle(topic.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.topicEmoji}>{topic.emoji}</Text>
              <Text style={[styles.topicTitle, { color: theme.textColor, fontFamily: theme.fontFamily }]}>
                {topic.title}
              </Text>
              <Text style={[styles.topicChevron, { color: theme.subTextColor }]}>
                {isOpen ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.topicBody}>
                {topic.facts.map((fact, i) => (
                  <View key={i} style={styles.factRow}>
                    <Text style={styles.factBullet}>{'•'}</Text>
                    <Text style={[styles.factText, { color: theme.textColor, fontFamily: theme.fontFamily }]}>
                      {fact}
                    </Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.askTutorBtn}
                  onPress={() => router.push('/(tabs)/tutor')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.askTutorBtnText}>{'Ask AI Tutor about this'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── ChecklistTab ─────────────────────────────────────────────────────────────

function ChecklistTab() {
  const theme = useTheme();
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(CHECKLIST_KEY);
        if (stored) setTicked(new Set(JSON.parse(stored) as string[]));
      } catch {}
    })();
  }, []);

  function toggleItem(id: string) {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      void AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const allTicked = ticked.size === ALL_ITEM_IDS.length;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.tabTitle, { color: theme.textColor, fontFamily: theme.fontFamily }]}>
        {"You're ready. Here's what to bring ✅"}
      </Text>

      {CHECKLIST_SECTIONS.map(section => (
        <View key={section.title} style={styles.checkSection}>
          <Text style={styles.checkSectionTitle}>{section.title}</Text>
          {section.items.map(item => {
            const isTicked = ticked.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.checkRow, { backgroundColor: theme.cardColor }]}
                onPress={() => toggleItem(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkBox, isTicked && styles.checkBoxTicked]}>
                  {isTicked && <Text style={styles.checkTick}>{'✓'}</Text>}
                </View>
                <Text style={[
                  styles.checkLabel,
                  { color: isTicked ? '#9CA3AF' : theme.textColor, fontFamily: theme.fontFamily },
                  isTicked && styles.checkLabelTicked,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {allTicked && (
        <View style={styles.allTickedCard}>
          <Text style={styles.allTickedText}>{"You've got this! Good luck! 🚗"}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── TestDayScreen ────────────────────────────────────────────────────────────

export default function TestDayScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('breathe');
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <LinearGradient
        colors={['#0D9488', '#0891B2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{'Test Day Mode'}</Text>
          <Text style={styles.headerSub}>{"You've got this 🎯"}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'breathe'    && <BreatheTab />}
      {activeTab === 'lastminute' && <LastMinuteTab />}
      {activeTab === 'checklist'  && <ChecklistTab />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn:      { padding: 8 },
  backArrow:    { fontSize: 22, color: '#FFFFFF', fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  headerSpacer: { width: 38 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: '#0D9488' },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#0D9488' },

  // Common tab layout
  tabContent: { padding: 20, paddingBottom: 60 },
  tabTitle:   { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  tabSub:     { fontSize: 14, lineHeight: 20, marginBottom: 24 },

  // Breathing
  circleWrapper: {
    width: 300,
    height: 300,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#0D9488',
  },
  circleOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel:     { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  phaseCount:     { fontSize: 52, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 60 },
  circleIdleText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  startBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  stopBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  stopBtnText: { color: '#6B7280', fontSize: 17, fontWeight: '600' },

  phaseGuide:    { marginTop: 20, gap: 8 },
  phaseGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phaseGuideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  phaseGuideDotActive: { backgroundColor: '#0D9488' },
  phaseGuideText:      { fontSize: 13, fontWeight: '500' },

  reassuranceSection: { marginTop: 28, gap: 10 },
  reassureCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
  },
  reassureText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },

  // Last Minute
  topicCard: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  topicEmoji:   { fontSize: 22 },
  topicTitle:   { flex: 1, fontSize: 15, fontWeight: '700' },
  topicChevron: { fontSize: 11, fontWeight: '700' },
  topicBody:    { paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
  factRow:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  factBullet:   { fontSize: 14, color: '#0D9488', lineHeight: 22 },
  factText:     { flex: 1, fontSize: 14, lineHeight: 22 },
  askTutorBtn: {
    marginTop: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0D9488',
  },
  askTutorBtnText: { color: '#0D9488', fontSize: 14, fontWeight: '700' },

  // Checklist
  checkSection:      { marginBottom: 24 },
  checkSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxTicked:   { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  checkTick:        { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  checkLabel:       { flex: 1, fontSize: 15, lineHeight: 22 },
  checkLabelTicked: { textDecorationLine: 'line-through' },
  allTickedCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  allTickedText: { fontSize: 20, fontWeight: '800', color: '#0D9488', textAlign: 'center' },
});
