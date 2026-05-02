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
      'Highway Code Rules 163-168 prohibit overtaking where you cannot see far enough ahead to do so safely - including near junctions, at bends, and on the approach to the brow of a hill.',
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
  {
    id: 'RUL_006',
    questionText: 'When are you allowed to use hazard warning lights while moving?',
    options: [
      'Whenever you need to warn drivers behind you of a hazard',
      'When driving slowly on a motorway or dual carriageway to warn of a hazard ahead',
      'When making a delivery stop in a restricted area',
      'When driving in heavy rain to increase your visibility',
    ],
    correctIndex: 1,
    explanation:
      'Hazard warning lights should not normally be used while moving. An exception is on motorways or dual carriageways to warn drivers behind of a sudden hazard ahead, such as a queue. Switch them off as soon as drivers behind have had adequate warning.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_007',
    questionText: 'You are overtaking a cyclist on a narrow road. How much space should you leave?',
    options: [
      'Half a metre - enough to pass safely without touching',
      'At least 1 metre at low speeds; at least 1.5 metres at higher speeds',
      'The same as overtaking a car - one lane width',
      'Any amount is acceptable as long as you do not make contact',
    ],
    correctIndex: 1,
    explanation:
      'The Highway Code states you should give cyclists at least 1.5 metres when overtaking at speeds over 30mph and a similar or greater distance at lower speeds. Cyclists can wobble unexpectedly and need substantial clearance.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_008',
    questionText: 'What is a yellow box junction and when may you enter one?',
    options: [
      'A pedestrian crossing area - enter only when no pedestrians are present',
      'A junction marked with criss-cross yellow lines - enter only when your exit road is clear',
      'A bus priority zone - private vehicles must not enter',
      'A loading area - enter only to collect or set down passengers',
    ],
    correctIndex: 1,
    explanation:
      'Yellow box junctions have criss-cross yellow lines and you must not enter unless your exit is clear. One exception: you may wait in the box when turning right if only oncoming traffic or vehicles ahead turning right are preventing you from completing the turn.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_009',
    questionText: 'What is the maximum speed limit for a car towing a trailer on a motorway?',
    options: [
      '50mph',
      '60mph',
      '70mph',
      'The same as for cars without trailers',
    ],
    correctIndex: 1,
    explanation:
      'When towing a trailer, the maximum speed limit on a motorway or dual carriageway is 60mph. The limit on a single carriageway is 50mph. These limits apply even where the national speed limit would otherwise allow higher speeds.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_010',
    questionText: 'What is the national speed limit for a car on a single carriageway road with no street lighting?',
    options: [
      '50mph',
      '60mph',
      '70mph',
      '80mph',
    ],
    correctIndex: 1,
    explanation:
      'The national speed limit for a car on a single carriageway is 60mph. Dual carriageways and motorways have a national limit of 70mph. The presence or absence of street lights distinguishes a built-up area (30mph limit) from an open road.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 1,
  },
  {
    id: 'RUL_011',
    questionText: 'When is it legal to sound your horn?',
    options: [
      'To greet someone you know',
      'To warn others of your presence when it may prevent a collision',
      'To encourage a slow driver to move out of the way',
      'When reversing in a car park',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 112 states you must only use the horn to warn other road users of your presence. It must not be used to show impatience or aggression, or when stationary except to avoid danger.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 1,
  },
  {
    id: 'RUL_012',
    questionText: 'You are on a one-way street and want to turn right. Which lane should you use?',
    options: [
      'Stay in the left lane throughout to avoid cutting across traffic',
      'Move to the right-hand lane before turning right',
      'Use the middle lane if there is one',
      'It does not matter - either lane is acceptable on a one-way street',
    ],
    correctIndex: 1,
    explanation:
      'On a one-way street, position yourself in the lane appropriate to your intended direction before you reach the junction. To turn right, use the right-hand lane. Signal early and check mirrors thoroughly.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_013',
    questionText: 'A pelican crossing shows a steady amber light. What must you do?',
    options: [
      'Proceed normally as the amber phase means pedestrians should not cross',
      'Stop unless you are so close that stopping would be dangerous',
      'Give way to pedestrians if they are on the crossing',
      'Sound your horn to warn any pedestrians thinking of crossing',
    ],
    correctIndex: 2,
    explanation:
      'At a pelican crossing showing a steady amber light, you must give way to any pedestrian who is still on the crossing. This is different from a normal amber traffic light because pedestrians may lawfully be crossing during this phase.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 3,
  },
  {
    id: 'RUL_014',
    questionText: 'What does "lane hogging" mean and why is it an offence?',
    options: [
      'Driving at the maximum speed limit in any lane',
      'Remaining in the middle or outer lane of a motorway when the lane to the left is clear',
      'Switching between lanes repeatedly without signalling',
      'Driving too slowly in the left-hand lane of a dual carriageway',
    ],
    correctIndex: 1,
    explanation:
      'Lane hogging means unnecessarily occupying the middle or right lane when the left lane is clear. It obstructs other drivers, forces unnecessary overtaking on the left, and is classified as careless driving, carrying penalty points.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
  {
    id: 'RUL_015',
    questionText: 'At a mini roundabout, who has priority?',
    options: [
      'The vehicle that arrived at the roundabout first',
      'The largest vehicle',
      'Traffic already on the roundabout, coming from the right',
      'Vehicles travelling straight on, over those turning',
    ],
    correctIndex: 2,
    explanation:
      'At a mini roundabout, as at all roundabouts, you give way to traffic already on the roundabout from your right. Mini roundabouts are often tighter and require all drivers to be prepared to give way and navigate carefully.',
    topicCategory: TopicCategory.RulesOfTheRoad,
    difficulty: 2,
  },
];
