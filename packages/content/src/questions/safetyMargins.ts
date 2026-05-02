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
      'At 70mph, thinking distance is 21m and braking distance is 75m - a total of 96m (315ft). This is roughly 24 car lengths, demonstrating why tailgating at motorway speeds is so dangerous.',
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
  {
    id: 'SAF_006',
    questionText: 'What is the total stopping distance at 50mph in good dry conditions?',
    options: [
      '36 metres (118 feet)',
      '53 metres (175 feet)',
      '73 metres (240 feet)',
      '96 metres (315 feet)',
    ],
    correctIndex: 1,
    explanation:
      'At 50mph, thinking distance is 15m and braking distance is 38m, giving a total of 53m (175ft). Doubling your speed from 30 to 60 mph more than doubles your braking distance.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_007',
    questionText: 'What is the thinking distance when travelling at 60mph in good conditions?',
    options: [
      '12 metres',
      '15 metres',
      '18 metres',
      '21 metres',
    ],
    correctIndex: 2,
    explanation:
      'Thinking distance at 60mph is 18 metres. The rule is straightforward: speed in mph = thinking distance in feet, or roughly 0.3m per mph. This assumes a typical reaction time of about 0.67 seconds.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 3,
  },
  {
    id: 'SAF_008',
    questionText: 'Which of these factors increases your thinking distance?',
    options: [
      'Cold weather and low temperatures',
      'Tiredness, alcohol, drugs, or distraction',
      'Driving a heavier vehicle',
      'Having worn tyres',
    ],
    correctIndex: 1,
    explanation:
      'Thinking distance is determined by reaction time. Anything that slows your reaction - tiredness, alcohol, drugs, distraction, or illness - increases thinking distance and therefore total stopping distance.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
  {
    id: 'SAF_009',
    questionText: 'You are driving in thick fog. What is the most important adjustment to make?',
    options: [
      'Keep close to the vehicle ahead so you can follow its tail lights',
      'Switch on hazard warning lights so others can see you',
      'Slow down significantly and increase your following distance',
      'Use full-beam headlights to see further ahead',
    ],
    correctIndex: 2,
    explanation:
      'In fog, visibility is reduced and therefore you need more time to react. Slow down and increase your following distance. Full-beam headlights cause dazzling glare in fog - use dipped headlights and front/rear fog lights when visibility drops below 100 metres.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
  {
    id: 'SAF_010',
    questionText: 'What is aquaplaning and what is the correct response if it occurs?',
    options: [
      'The car vibrating on a motorway - accelerate through it',
      'Tyres losing contact with the road surface due to a film of water - ease off the accelerator gently',
      'Windscreen misting caused by rain - use the demister fan',
      'Loss of steering caused by flooded brakes - apply the handbrake',
    ],
    correctIndex: 1,
    explanation:
      'Aquaplaning occurs when a layer of water builds up between the tyres and road surface, causing a loss of grip and steering. Ease off the accelerator gently and do not brake or steer sharply until grip is restored.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_011',
    questionText: 'How does alcohol consumption affect stopping distance?',
    options: [
      'It has no effect on stopping distance, only on steering accuracy',
      'It increases braking distance only, not thinking distance',
      'It can significantly increase thinking distance by slowing reaction times',
      'It reduces stopping distance by making drivers more focused',
    ],
    correctIndex: 2,
    explanation:
      'Alcohol slows reaction times, which increases thinking distance and therefore total stopping distance. Even small amounts of alcohol affect the speed at which the brain processes information and sends signals to the muscles.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_012',
    questionText: 'What is the total stopping distance at 20mph in good dry conditions?',
    options: [
      '6 metres (20 feet)',
      '12 metres (40 feet)',
      '18 metres (59 feet)',
      '23 metres (75 feet)',
    ],
    correctIndex: 1,
    explanation:
      'At 20mph, thinking distance is 6m and braking distance is 6m, giving a total of 12m (40ft). This is why 20mph zones near schools and residential areas significantly reduce the severity of collisions with pedestrians.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 2,
  },
  {
    id: 'SAF_013',
    questionText: 'You are following a large lorry on a wet motorway. What following distance should you aim for?',
    options: [
      'The same as in dry conditions - 2 seconds',
      'At least 4 seconds, as wet roads at least double braking distances',
      '1 second, so you can react before the lorry gets too far away',
      '10 seconds, as lorries take much longer to stop than cars',
    ],
    correctIndex: 1,
    explanation:
      'In wet conditions, braking distances at least double. The standard two-second rule becomes a minimum four-second rule. Behind a large vehicle, your view ahead is also obscured, requiring even more caution.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
  {
    id: 'SAF_014',
    questionText: 'What is the main danger of following the vehicle ahead too closely (tailgating)?',
    options: [
      'It can cause overheating of your front brakes due to restricted airflow',
      'You will not have enough stopping distance if the vehicle ahead brakes suddenly',
      'It confuses other drivers and may cause them to change lanes unexpectedly',
      'Your headlights will dazzle the driver in front through their mirrors',
    ],
    correctIndex: 1,
    explanation:
      'Tailgating is one of the main causes of rear-end collisions. If the vehicle ahead brakes suddenly, you may not have enough time and distance to stop safely. Always maintain at least the two-second gap (four seconds in wet conditions).',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 1,
  },
  {
    id: 'SAF_015',
    questionText: 'What is the total stopping distance at 60mph in good dry conditions?',
    options: [
      '53 metres (175 feet)',
      '73 metres (240 feet)',
      '85 metres (280 feet)',
      '96 metres (315 feet)',
    ],
    correctIndex: 1,
    explanation:
      'At 60mph, thinking distance is 18m and braking distance is 55m - a total of 73m (240ft). Note that braking distance increases with the square of speed, so doubling speed quadruples braking distance.',
    topicCategory: TopicCategory.SafetyMargins,
    difficulty: 3,
  },
];
