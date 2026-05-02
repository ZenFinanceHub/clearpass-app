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
      'No entry - do not proceed',
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
      'Stop - controlled junction ahead',
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
      'Blue circular signs give mandatory instructions - you must follow them. A blue circle with a directional arrow means you must travel in that direction. (Compare: blue rectangles are merely informational.)',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
  {
    id: 'SGN_006',
    questionText: 'What is the correct sequence of UK traffic lights when they change from red to green?',
    options: [
      'Red - Green - Amber - Red',
      'Red - Red and Amber - Green - Amber',
      'Red - Amber - Green - Amber',
      'Red - Flashing Amber - Green - Amber',
    ],
    correctIndex: 1,
    explanation:
      'UK traffic lights follow the sequence: Red (stop) - Red and Amber together (prepare to go) - Green (go if safe) - Amber (stop if safe to do so) - back to Red. The red-and-amber phase warns you to prepare to move.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_007',
    questionText: 'What do double yellow lines painted along the edge of the road mean?',
    options: [
      'No stopping at any time',
      'No parking at any time',
      'No waiting during certain hours shown on nearby signs or plates',
      'No parking or loading at any time',
    ],
    correctIndex: 2,
    explanation:
      'Double yellow lines mean no waiting (parking) during the times shown on nearby kerb plates or signs. Single yellow lines apply during specific hours; double yellows extend the restriction. The exact hours must be checked locally.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 3,
  },
  {
    id: 'SGN_008',
    questionText: 'What colour background do motorway direction signs have?',
    options: [
      'Green',
      'White',
      'Blue',
      'Yellow',
    ],
    correctIndex: 2,
    explanation:
      'Motorway direction and information signs have a blue background with white text and yellow route numbers. Primary route signs on A-roads use green backgrounds; local route signs use white backgrounds.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_009',
    questionText: 'At a school crossing, a patrol officer displays a "STOP - CHILDREN" sign. What must you do?',
    options: [
      'Slow to 20mph and proceed with care',
      'Stop and wait until the officer signals it is safe to proceed',
      'Give way to children if any are crossing but otherwise continue',
      'Stop only if children are actually in the road',
    ],
    correctIndex: 1,
    explanation:
      'You must obey a school crossing patrol officer displaying the "STOP - CHILDREN" sign. Stop and wait. You must not proceed until the officer signals it is safe and clears the crossing.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_010',
    questionText: 'What does a "clearway" sign indicate?',
    options: [
      'A road where you must not stop at any time, except in an emergency',
      'A road with no speed limit',
      'A road that has been gritted and is clear of ice',
      'A road where no parking is permitted during the day',
    ],
    correctIndex: 0,
    explanation:
      'A clearway is a route where stopping is prohibited at all times (including by the driver), except in an emergency or breakdown. They are typically found on busy roads where stopping would cause obstruction.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 3,
  },
  {
    id: 'SGN_011',
    questionText: 'Diagonal white lines fill the area between two solid white lines in the centre of a road. What do they mean?',
    options: [
      'Traffic may use this area for overtaking if the road ahead is clear',
      'This area separates traffic streams and must not be entered unless safe and necessary',
      'The road narrows ahead and you must merge into one lane',
      'Lane markings indicating the end of a motorway',
    ],
    correctIndex: 1,
    explanation:
      'Areas of diagonal white lines (chevrons) bordered by solid lines are designed to separate opposing traffic or protect turning vehicles. You must not enter them unless it is safe and, in some cases, unless it is necessary to do so.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
  {
    id: 'SGN_012',
    questionText: 'A speed limit sign shows "30" inside a red circle. What does this mean?',
    options: [
      'The recommended speed on this road is 30mph',
      'The maximum permitted speed is 30mph',
      'A 30mph zone begins ahead',
      'Lorries over 3.5 tonnes must not exceed 30mph',
    ],
    correctIndex: 1,
    explanation:
      'A number inside a red circle is a mandatory maximum speed limit sign. You must not exceed 30mph on that road. This applies to all vehicles unless a lower limit is separately signed for specific vehicle types.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 1,
  },
  {
    id: 'SGN_013',
    questionText: 'What do zigzag lines on the road at a pedestrian crossing indicate?',
    options: [
      'You may park briefly here to collect or set down passengers',
      'No parking or overtaking within this marked area',
      'Road surface is uneven - reduce speed',
      'You must slow to 20mph when pedestrians are present',
    ],
    correctIndex: 1,
    explanation:
      'Zigzag lines mark the area approaching a pedestrian crossing where parking and overtaking are prohibited. Parking here would obstruct the view for both drivers and pedestrians, and is therefore illegal.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
  {
    id: 'SGN_014',
    questionText: 'An amber traffic light is showing. When can you continue through it without stopping?',
    options: [
      'Whenever oncoming traffic has already stopped',
      'Only if stopping would be unsafe because you are too close to the stop line',
      'Always - amber means prepare to stop but you may proceed',
      'When a vehicle is following closely behind you',
    ],
    correctIndex: 1,
    explanation:
      'Amber means stop at the stop line. You may continue only if stopping would be unsafe - for example, if you are already so close to the stop line that stopping would cause a skid or collision. Amber does not mean "hurry through".',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 2,
  },
  {
    id: 'SGN_015',
    questionText: 'What does a continuous solid white line along the centre of the road mean for a driver?',
    options: [
      'You may cross it only if you are overtaking and the road ahead is clear',
      'You must not cross or straddle it unless turning, passing a stationary obstruction, or in an emergency',
      'It is a warning line and crossing it is not legally prohibited',
      'It indicates the edge of the hard shoulder on a dual carriageway',
    ],
    correctIndex: 1,
    explanation:
      'A continuous solid white centre line is a mandatory road marking. You must not cross or straddle it except to turn into a premises, pass a stationary vehicle or road worker, or in an emergency. Hazard warning lines (broken) allow crossing when safe.',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    difficulty: 3,
  },
];
