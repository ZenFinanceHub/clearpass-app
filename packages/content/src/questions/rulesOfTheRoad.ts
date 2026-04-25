// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const rulesOfTheRoadQuestions: Question[] = [
  {
    id: 'RUL_001',
    questionText: 'What is the national speed limit for a car on a UK motorway?',
    options: [
      '60mph',
      '70mph',
      '80mph',
      '90mph',
    ],
    correctIndex: 1,
    explanation:
      'The national speed limit on a motorway is 70mph for cars and motorcycles. Lower limits apply for vehicles towing trailers, HGVs, and where variable speed limit signs are displayed.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 1,
  },
  {
    id: 'RUL_002',
    questionText: 'What is the default speed limit in a built-up area unless otherwise signed?',
    options: [
      '20mph',
      '30mph',
      '40mph',
      '50mph',
    ],
    correctIndex: 1,
    explanation:
      'The default speed limit in a built-up area (where there are street lights no more than 185m apart) is 30mph. This can be reduced to 20mph if signed.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 1,
  },
  {
    id: 'RUL_003',
    questionText: 'Which lane should you use for normal driving on a three-lane motorway when the road is clear?',
    options: [
      'The middle lane for safety',
      'Any lane, whichever is most convenient',
      'The left-hand lane',
      'The lane that allows you to travel fastest',
    ],
    correctIndex: 2,
    explanation:
      'Highway Code Rule 264 states you should always drive in the left-hand lane when the road ahead is clear. Middle and right lanes are for overtaking only. Staying in the middle lane (lane hogging) is an offence.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 1,
  },
  {
    id: 'RUL_004',
    questionText: 'In which of these situations must you NOT overtake?',
    options: [
      'On a straight road with good visibility ahead',
      'When approaching a junction, the brow of a hill, or a bend',
      'When the vehicle ahead is travelling below the speed limit',
      'On a dual carriageway in the right-hand lane',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rules 163–168 prohibit overtaking where you cannot see far enough ahead to do so safely — including near junctions, at bends, and on the approach to the brow of a hill.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_005',
    questionText: 'You want to turn right at a roundabout to take the third exit. Which lane and signal should you use on approach?',
    options: [
      'Left lane, no signal on approach',
      'Right lane, signal right on approach',
      'Either lane, signal left as you pass the second exit',
      'Middle lane if available, no approach signal needed',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 186 states that for exits beyond 12 o\'clock (right turns) you should approach in the right-hand lane, signalling right. Signal left after passing the exit before the one you intend to take.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 3,
  },
];
