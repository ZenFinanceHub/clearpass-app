// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const safetyMarginsQuestions: Question[] = [
  {
    id: 'SAF_001',
    questionText: 'What is the total stopping distance (thinking + braking) for a car travelling at 30mph in good conditions?',
    options: [
      '12 metres (40 feet)',
      '23 metres (75 feet)',
      '36 metres (120 feet)',
      '53 metres (175 feet)',
    ],
    correctIndex: 1,
    explanation:
      'At 30mph, thinking distance is 9m and braking distance is 14m, giving a total of 23m (75ft). These figures assume dry roads and good tyres.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_002',
    questionText: 'How does wet weather affect your braking distance compared to dry conditions?',
    options: [
      'It stays the same if you have good tyres',
      'It increases by roughly 25%',
      'It at least doubles',
      'It triples on modern roads',
    ],
    correctIndex: 2,
    explanation:
      'In wet conditions braking distances at least double. Reduced tyre grip means you should leave at least twice the normal gap and approach hazards much more gently.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
  {
    id: 'SAF_003',
    questionText: 'What is the total stopping distance at 70mph in good dry conditions?',
    options: [
      '53 metres (175 feet)',
      '73 metres (240 feet)',
      '96 metres (315 feet)',
      '120 metres (396 feet)',
    ],
    correctIndex: 2,
    explanation:
      'At 70mph, thinking distance is 21m and braking distance is 75m — a total of 96m (315ft). This is roughly 24 car lengths, demonstrating why tailgating at motorway speeds is so dangerous.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_004',
    questionText: 'In icy conditions, how much greater can your braking distance be compared to a dry road?',
    options: [
      'Twice as long',
      'Four times as long',
      'Six times as long',
      'Up to ten times as long',
    ],
    correctIndex: 3,
    explanation:
      'The Highway Code states that on icy roads braking distances can be up to ten times longer than in dry conditions. Extra caution, gentle inputs, and much lower speeds are essential.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_005',
    questionText: 'What is the "two-second rule" when following another vehicle?',
    options: [
      'Leave at least two car lengths between you and the vehicle ahead',
      'After the vehicle ahead passes a fixed point, at least two seconds must pass before you reach that same point',
      'Apply your brakes two seconds before reaching a hazard',
      'Leave two seconds when changing lanes on a motorway',
    ],
    correctIndex: 1,
    explanation:
      'The two-second rule gives a minimum safe following distance in dry conditions. In wet weather this should be at least four seconds. Choose a fixed object (bridge, sign) and count "only a fool breaks the two-second rule".',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
];
