// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const motorwayRulesQuestions: Question[] = [
  {
    id: 'MOT_001',
    questionText: 'What is the national speed limit on a UK motorway for a car?',
    options: [
      '60mph',
      '70mph',
      '80mph',
      '90mph',
    ],
    correctIndex: 1,
    explanation:
      'The national speed limit on a motorway for cars and motorcycles is 70mph. Variable speed limit signs may display lower limits, which are legally enforceable.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_002',
    questionText: 'Which lane should you use for normal driving on a motorway when the road ahead is clear?',
    options: [
      'The middle lane to maintain maximum safety',
      'Any lane - choose the one that suits your speed',
      'The left-hand lane',
      'The right-hand lane to stay out of the way of slower traffic',
    ],
    correctIndex: 2,
    explanation:
      'Rule 264 of the Highway Code states you must always drive in the left-hand lane when the road is clear. Other lanes are for overtaking only. Remaining in the middle lane unnecessarily is careless driving.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_003',
    questionText: 'What does a red X displayed on a motorway overhead gantry sign mean?',
    options: [
      'Slow down and use that lane with care',
      'That lane is closed - you must not drive in it',
      'A breakdown is ahead in that lane',
      'Reduce speed to 50mph in preparation for a junction',
    ],
    correctIndex: 1,
    explanation:
      'A red X means the lane is closed and you must not drive in it. Ignoring a red X is a criminal offence under the Road Traffic Act. Move to an open lane as soon as it is safe to do so.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_004',
    questionText: 'When joining a motorway from a slip road, who has priority?',
    options: [
      'Vehicles joining from the slip road, as they are accelerating to motorway speed',
      'Traffic already on the motorway',
      'Priority depends on the type of junction',
      'Whichever vehicle arrives at the merge point first',
    ],
    correctIndex: 1,
    explanation:
      'Traffic already on the motorway has priority. When joining from a slip road, you must match the speed of motorway traffic and merge safely into a gap in the left-hand lane. Do not force your way in or expect others to slow down.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_005',
    questionText: 'You break down on a motorway. Where should you stop and what should you do first?',
    options: [
      'Stop in the left lane and switch on hazard lights',
      'Pull onto the hard shoulder or emergency refuge area, exit via the nearside door, and move behind the barrier',
      'Coast to the next junction before stopping',
      'Stop on the hard shoulder and remain in the vehicle to await recovery',
    ],
    correctIndex: 1,
    explanation:
      'Pull as far left as possible onto the hard shoulder or emergency refuge area. Exit from the left (nearside) door and stand behind the barrier away from the carriageway. Call for recovery from an emergency phone or mobile. Never stand between your vehicle and live traffic.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_006',
    questionText: 'At what minimum distance should you leave a separation gap when travelling at 70mph on a motorway?',
    options: [
      'At least 35 metres (2 seconds)',
      'At least 96 metres (the two-second rule produces this at 70mph)',
      'At least 50 metres',
      'At least 175 metres',
    ],
    correctIndex: 1,
    explanation:
      'The two-second rule means you should maintain at least a two-second gap to the vehicle ahead. At 70mph this equates to approximately 96 metres. In wet conditions double this gap to at least four seconds.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_007',
    questionText: 'When may you use the right-hand lane of a three-lane motorway?',
    options: [
      'When travelling at or near the speed limit',
      'Only to overtake slower-moving vehicles, returning to the left when safe',
      'Whenever you prefer to avoid slower traffic in the left lane',
      'At any time, provided you stay within the speed limit',
    ],
    correctIndex: 1,
    explanation:
      'The right-hand lane is for overtaking only. Once you have passed the slower vehicle, you must move back to the left as soon as it is safe. Staying in the right lane when not overtaking is lane hogging and a careless driving offence.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_008',
    questionText: 'What are the white reflective studs on a motorway used to indicate?',
    options: [
      'The centre of the carriageway',
      'Lane markings between lanes on the main carriageway',
      'The edge of the road at the nearside',
      'The boundary between the hard shoulder and the main carriageway',
    ],
    correctIndex: 1,
    explanation:
      'White studs mark lane boundaries between lanes on the main carriageway. Red studs mark the left edge of the carriageway next to the hard shoulder. Amber studs mark the central reservation. Green studs appear at lay-bys and slip roads.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_009',
    questionText: 'Motorway fog patches can appear suddenly. What should you do when you see a sign warning of fog?',
    options: [
      'Maintain speed but turn on fog lights immediately',
      'Reduce speed and increase your following distance before entering the fog',
      'Switch to the right-hand lane where visibility is better',
      'Sound your horn periodically to warn other drivers',
    ],
    correctIndex: 1,
    explanation:
      'Reduce speed before reaching the fog and leave more distance to the vehicle ahead. Once in fog, use dipped headlights or fog lights if visibility falls below 100 metres. Do not suddenly brake when entering fog as this can cause rear-end collisions.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_010',
    questionText: 'You see emergency flashing amber lights on a motorway maintenance vehicle. What does this mean?',
    options: [
      'The vehicle is broken down - slow down and move to a different lane',
      'There is a lane closure or road works - slow down, take care, and follow any instructions',
      'The vehicle is about to leave the motorway - maintain your speed',
      'The vehicle is warning of a hazard in the central reservation only',
    ],
    correctIndex: 1,
    explanation:
      'Amber flashing lights on maintenance vehicles indicate road works or a hazard. Reduce speed, increase your following distance, and obey any temporary speed limit signs. Workers may be nearby.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_011',
    questionText: 'On a smart motorway, what does it mean when no speed limit is displayed on an overhead gantry?',
    options: [
      'The national speed limit applies',
      'You must slow to 40mph as the default smart motorway limit',
      'The lane is closed',
      'You must use the hard shoulder as a running lane',
    ],
    correctIndex: 0,
    explanation:
      'On a smart motorway, when no speed limit is displayed on the overhead sign, the national speed limit applies (70mph for cars). Speed limits are only enforced when they are displayed on the gantry.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_012',
    questionText: 'Can learner drivers use motorways?',
    options: [
      'No - motorways are prohibited for learner drivers at all times',
      'Yes, but only when accompanied by an approved driving instructor in a dual-controlled car',
      'Yes, but only on quiet motorways between 10pm and 6am',
      'Yes, provided a qualified driver is present and the learner drives below 50mph',
    ],
    correctIndex: 1,
    explanation:
      'Since June 2018, learner drivers are permitted on motorways in England, Scotland, and Wales, but only when accompanied by an approved driving instructor (ADI) in a car fitted with dual controls.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_013',
    questionText: 'When driving on a smart motorway where the hard shoulder is used as a running lane, what should you do if your vehicle has a problem?',
    options: [
      'Continue to the next junction as there is no hard shoulder',
      'Stop in the live lane and switch on hazard lights',
      'Reach the nearest Emergency Refuge Area (ERA) and call for help',
      'Drive on the central reservation verge until help arrives',
    ],
    correctIndex: 2,
    explanation:
      'On a smart motorway with no permanent hard shoulder, drive to the nearest Emergency Refuge Area (ERA). These are marked by orange SOS phones and blue signs. If you cannot reach an ERA, pull as far left as possible, switch on hazard lights, and call 999.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_014',
    questionText: 'You are driving on a motorway and feel very tired. What is the safest course of action?',
    options: [
      'Open the windows and turn up the radio to stay alert',
      'Pull over at the next service area, drink coffee, and take a short sleep',
      'Slow to 50mph and keep to the left lane until you feel better',
      'Ask a passenger to talk to you to maintain alertness',
    ],
    correctIndex: 1,
    explanation:
      'If you feel tired on a motorway, leave at the next junction or services. Take a proper rest break - ideally a 15-20 minute nap. Caffeine can provide short-term help while you find a safe place to stop, but it is not a substitute for rest.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_015',
    questionText: 'What should you do if you accidentally miss your motorway exit?',
    options: [
      'Stop on the hard shoulder and reverse back to the exit',
      'Continue to the next exit and leave there',
      'Cross the central reservation to return in the other direction',
      'Perform a U-turn as soon as there is a gap in traffic',
    ],
    correctIndex: 1,
    explanation:
      'If you miss your exit, continue to the next junction and leave there. Never reverse on a motorway - it is extremely dangerous and illegal. Crossing the central reservation or performing a U-turn are equally prohibited.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
];
