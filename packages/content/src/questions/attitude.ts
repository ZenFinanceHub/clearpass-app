// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const attitudeQuestions: Question[] = [
  {
    id: 'ATT_001',
    questionText: 'Another driver cuts in front of you aggressively. What is the correct response?',
    options: [
      'Flash your headlights and sound the horn to express your frustration',
      'Follow closely behind them as a warning',
      'Stay calm, drop back, and maintain a safe following distance',
      'Overtake them at the first opportunity to reclaim your position',
    ],
    correctIndex: 2,
    explanation:
      'Reacting aggressively to poor driving escalates danger for everyone. The Highway Code advises keeping calm and not allowing other drivers to affect your driving behaviour.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_002',
    questionText: 'According to the Highway Code, what is the only correct reason to flash your headlights at another driver?',
    options: [
      'To warn them of a speed camera ahead',
      'To indicate that they may proceed',
      'To let them know you are there',
      'To signal your intention to overtake',
    ],
    correctIndex: 2,
    explanation:
      'Highway Code Rule 110 states headlights should only be flashed to warn other road users of your presence. Flashing to beckon others forward or warn of speed cameras is not a recognised signal.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_003',
    questionText: 'A driver is tailgating you on a dual carriageway. What is the safest course of action?',
    options: [
      'Brake sharply to warn them to back off',
      'Gradually reduce your speed to create more space ahead, then let them pass',
      'Speed up to increase the gap between you',
      'Put your hazard lights on to signal the problem',
    ],
    correctIndex: 1,
    explanation:
      'Braking sharply risks a rear-end collision. By slowing gradually and creating space ahead, you increase the overall safety margin and allow the tailgater to pass when safe.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_004',
    questionText: 'You are waiting in slow-moving traffic at a pedestrian crossing. What should you always do?',
    options: [
      'Creep forward slowly to maintain momentum with the queue',
      'Keep the crossing clear so pedestrians can use it',
      'Move forward to prevent motorcyclists filtering through',
      'Signal to pedestrians when they can cross',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 191 requires drivers not to block pedestrian crossings. Stopping on a crossing is dangerous and illegal.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_005',
    questionText: 'What is the principal cause of road rage incidents?',
    options: [
      'Driving on unfamiliar or congested roads',
      'Poor road surface and adverse weather',
      'Perceived inconsiderate or selfish behaviour by other road users',
      'Driving a slow or underpowered vehicle',
    ],
    correctIndex: 2,
    explanation:
      'Road rage is most commonly triggered when drivers feel another road user has acted selfishly or dangerously. Recognising this helps you stay calm and avoid escalating situations.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
];
