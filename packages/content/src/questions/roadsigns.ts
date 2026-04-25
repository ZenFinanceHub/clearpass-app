// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const roadsignsQuestions: Question[] = [
  {
    id: 'SGN_001',
    questionText: 'What shape are UK warning signs, such as "slippery road" or "road narrows"?',
    options: [
      'Circular with a red border',
      'Rectangular with a blue background',
      'Triangular with a red border',
      'Rectangular with a green background',
    ],
    correctIndex: 2,
    explanation:
      'Warning signs in the UK are red-bordered equilateral triangles pointing upwards. They warn of hazards ahead and require you to be prepared to respond.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_002',
    questionText: 'What does an inverted triangle (pointing downwards) with a red border mean at a junction?',
    options: [
      'No entry — do not proceed',
      'Stop and give way to all traffic',
      'Give way to traffic on the major road ahead',
      'Reduce speed to 20mph',
    ],
    correctIndex: 2,
    explanation:
      'An inverted triangle is the "give way" sign. You must give way to traffic on the road you are entering. It is different from the octagonal STOP sign, which requires you to stop completely.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_003',
    questionText: 'What does a circular sign with a white background and a single diagonal black stripe indicate?',
    options: [
      'No entry for all vehicles',
      'The national speed limit applies',
      'No overtaking permitted',
      'End of all speed restrictions',
    ],
    correctIndex: 1,
    explanation:
      'The national speed limit sign is a white circle with a diagonal black stripe. On a single carriageway this means 60mph; on a motorway or dual carriageway it means 70mph.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
  {
    id: 'SGN_004',
    questionText: 'A red circle containing a horizontal white bar in the centre means:',
    options: [
      'Give way to oncoming traffic',
      'No entry for vehicular traffic',
      'Stop — controlled junction ahead',
      'Speed limit 50mph',
    ],
    correctIndex: 1,
    explanation:
      'The "no entry" sign is a red circle with a white horizontal bar. You must not enter the road or lane displaying this sign. It is commonly used on one-way streets and exit roads.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_005',
    questionText: 'What does a blue circular sign displaying a white arrow indicate?',
    options: [
      'A mandatory direction you must follow',
      'A recommended route',
      'A warning that traffic turns ahead',
      'A one-way street in the arrow direction',
    ],
    correctIndex: 0,
    explanation:
      'Blue circular signs give mandatory instructions — you must follow them. A blue circle with a directional arrow means you must travel in that direction. (Compare: blue rectangles are merely informational.)',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
];
