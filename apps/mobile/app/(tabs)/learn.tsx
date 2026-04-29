import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicCategory } from '@clearpass/core';

type TopicEntry = {
  category: TopicCategory;
  label: string;
  iconName: string;
  accentColor: string;
  facts: string[];
};

const TOPICS: TopicEntry[] = [
  {
    category: TopicCategory.Alertness,
    label: 'Alertness',
    iconName: 'eye-outline',
    accentColor: '#3B82F6',
    facts: [
      'Rule 91: if you feel tired, stop at a safe place. Opening a window or turning up the radio only delays the problem - rest is the only cure.',
      'Using a handheld mobile phone while driving is illegal at all times, including when stationary at traffic lights.',
      'Eating, applying make-up, or reading while driving takes your eyes off the road - pull over safely before doing these things.',
      'Driver fatigue doubles reaction times and can cause you to fall asleep at the wheel without warning.',
      'Plan at least a 15-minute break every two hours on long journeys.',
    ],
  },
  {
    category: TopicCategory.Attitude,
    label: 'Attitude',
    iconName: 'heart-outline',
    accentColor: '#EC4899',
    facts: [
      'Flashing your headlights means only "I am here" - it does not give way to another driver and should not be used to intimidate.',
      'Sounding your horn while stationary is illegal (except to warn of danger) between 11:30pm and 7:00am in a built-up area.',
      'Be patient with cyclists, horse riders, and slow-moving vehicles - do not tailgate or intimidate them.',
      'Avoid retaliating to aggressive or inconsiderate driving; it escalates danger for everyone on the road.',
      'A courteous attitude reduces stress and improves safety for all road users.',
    ],
  },
  {
    category: TopicCategory.SafetyMargins,
    label: 'Safety Margins',
    iconName: 'resize-outline',
    accentColor: '#F59E0B',
    facts: [
      'The two-second rule: in dry conditions, leave at least a two-second gap to the vehicle ahead - double it in wet weather.',
      'Overall stopping distance at 70 mph is 96 metres (315 feet) - that is 24 car lengths.',
      'Stopping distances can increase tenfold on ice compared with dry roads.',
      'In fog, slow down and use fog lights when visibility drops below 100 metres (328 feet). Switch them off when visibility improves.',
      'Under-inflated or worn tyres significantly reduce braking ability and grip in corners.',
    ],
  },
  {
    category: TopicCategory.HazardAwareness,
    label: 'Hazard Awareness',
    iconName: 'warning-outline',
    accentColor: '#EF4444',
    facts: [
      'Use the limit point of vision ahead to judge safe speed - if the road curves and you cannot see far, slow down.',
      'Parked vehicles can hide pedestrians who may step out suddenly - reduce speed when passing them.',
      'Children and elderly pedestrians are less predictable - give them extra space and time.',
      'Motorcycles and cyclists are harder to see; always check mirrors and blind spots, especially at junctions.',
      'Animals on the road can behave unpredictably - slow down, stop if necessary, and avoid making loud noises.',
    ],
  },
  {
    category: TopicCategory.RoadAndTrafficSigns,
    label: 'Road and Traffic Signs',
    iconName: 'navigate-outline',
    accentColor: '#8B5CF6',
    facts: [
      'Circular signs give orders: red border = prohibition (e.g. speed limits), blue background = positive instruction (e.g. keep left).',
      'Triangular signs warn of a hazard ahead - most are white with a red border.',
      'Rectangular signs give information: blue on motorways, green on primary routes, white on local roads.',
      'Double white lines: if the line nearest to you is solid, you must not cross or straddle it (except to turn, or pass a stationary vehicle).',
      'An octagonal red "STOP" sign requires you to stop completely, even if the road appears clear.',
    ],
  },
  {
    category: TopicCategory.RulesOfTheRoad,
    label: 'Rules of the Road',
    iconName: 'list-outline',
    accentColor: '#10B981',
    facts: [
      'At roundabouts, give way to traffic already on the roundabout from the right, unless signs or markings state otherwise.',
      'Yellow box junctions: do not enter unless your exit road is clear - you may wait in the box only when turning right and held up by oncoming traffic.',
      'Speed limits: 30 mph in built-up areas (street lights present), 60 mph on single carriageways, 70 mph on dual carriageways and motorways.',
      'At a pelican crossing with a flashing amber light, you must give way to pedestrians who are still on the crossing.',
      'You must obey instructions from a police officer or school crossing patrol even if this contradicts traffic signals.',
    ],
  },
];

type Phase = 'topics' | 'detail';

export default function LearnScreen() {
  const [phase, setPhase] = useState<Phase>('topics');
  const [selectedTopic, setSelectedTopic] = useState<TopicEntry | null>(null);

  function openTopic(topic: TopicEntry) {
    setSelectedTopic(topic);
    setPhase('detail');
  }

  if (phase === 'detail' && selectedTopic !== null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backRow} onPress={() => setPhase('topics')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#012169" />
          <Text style={styles.backText}>All Topics</Text>
        </TouchableOpacity>

        <Text style={styles.detailTitle}>{selectedTopic.label}</Text>
        <Text style={styles.detailSub}>{selectedTopic.facts.length} key rules to remember</Text>

        <View style={styles.factList}>
          {selectedTopic.facts.map((fact, i) => (
            <View key={i} style={[styles.factCard, { borderLeftColor: selectedTopic.accentColor }]}>
              <View style={[styles.factNum, { backgroundColor: selectedTopic.accentColor }]}>
                <Text style={styles.factNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Learn</Text>
      <Text style={styles.screenSub}>Highway Code rules and key theory by topic</Text>

      <View style={styles.topicList}>
        {TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic.category}
            style={styles.topicCard}
            onPress={() => openTopic(topic)}
            activeOpacity={0.8}
          >
            <View style={[styles.topicIcon, { backgroundColor: topic.accentColor + '22' }]}>
              <Ionicons name={topic.iconName as any} size={22} color={topic.accentColor} />
            </View>
            <View style={styles.topicBody}>
              <Text style={styles.topicLabel}>{topic.label}</Text>
              <Text style={styles.topicMeta}>{topic.facts.length} key rules</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 48 },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  screenSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },

  topicList: { gap: 10 },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topicIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBody: { flex: 1 },
  topicLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  topicMeta: { fontSize: 13, color: '#64748B' },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  backText: { fontSize: 15, color: '#012169', fontWeight: '600' },

  detailTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  detailSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },

  factList: { gap: 12 },
  factCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  factNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  factNumText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  factText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 21 },
});
