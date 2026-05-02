// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const otherTypesQuestions: Question[] = [
  {
    id: 'OTV_001',
    questionText: 'A large lorry is signalling to turn left at a junction. Why should you not pass on its left?',
    options: [
      'Large vehicles have priority over smaller vehicles when turning',
      'The lorry may need to swing wide to the right before turning left, and could crush a vehicle on its left',
      'It is always illegal to pass on the left of any vehicle',
      'The lorry\'s rear overhang could strike a vehicle behind it',
    ],
    correctIndex: 1,
    explanation:
      'Large vehicles often need to move right before turning left to allow room for the rear of the trailer to clear the kerb. Never attempt to pass on the left of a long vehicle that is turning left - the gap can close rapidly.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_002',
    questionText: 'An emergency vehicle with blue flashing lights and a siren is approaching from behind on a dual carriageway. What should you do?',
    options: [
      'Speed up to clear the lane for the emergency vehicle',
      'Move left safely, reduce speed, and let it pass',
      'Stop immediately on the hard shoulder',
      'Maintain your current speed and lane position',
    ],
    correctIndex: 1,
    explanation:
      'Pull over to the left and reduce speed to allow emergency vehicles to pass. Do not mount kerbs or brake suddenly. On a motorway, do not stop on the hard shoulder unless directed to by blue flashing lights.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_003',
    questionText: 'Can you overtake a tram that has stopped at a tram stop?',
    options: [
      'Yes, provided no passengers are boarding or alighting',
      'Yes, always - trams follow their own lane',
      'No - you must wait behind the tram until it moves off',
      'Only when the tram doors are fully closed',
    ],
    correctIndex: 0,
    explanation:
      'You may pass a stationary tram on its left where the road allows, provided no passengers are boarding or alighting. If passengers are getting off, you must wait until they have cleared the road.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_004',
    questionText: 'A bus is indicating to pull away from a bus stop into your lane on a road with a 30mph limit. What should you do?',
    options: [
      'Always give way to a bus pulling out, as the law requires it',
      'Give way if it is safe to do so, as the Highway Code asks drivers to show courtesy',
      'Maintain your speed - the bus driver must wait for a safe gap',
      'Sound your horn to let the bus driver know you are passing',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 223 asks drivers to give way to buses pulling out from bus stops where it is safe to do so. This is a courtesy requirement, not an absolute legal requirement, but refusing to give way when it is safe is inconsiderate.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_005',
    questionText: 'On a motorway, which lanes may a large HGV use?',
    options: [
      'Any lane, the same as a car',
      'Left and middle lanes only (lanes 1 and 2 on a 3-lane motorway)',
      'Left lane only at all times',
      'Any lane except the right-hand lane when towing',
    ],
    correctIndex: 1,
    explanation:
      'Vehicles over 7.5 tonnes are prohibited from using the right-hand lane on a motorway with three or more lanes. They may use lanes 1 and 2. This rule also applies to vehicles towing trailers.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_006',
    questionText: 'Why are motorcyclists particularly difficult to see at junctions and when changing lanes?',
    options: [
      'Motorcyclists do not use their headlights during the day',
      'Their narrow profile makes them harder to spot, especially in mirrors and blind spots',
      'Motorcycle engines are quieter than car engines',
      'Motorcyclists are allowed to ride in the blind spot area',
    ],
    correctIndex: 1,
    explanation:
      'Motorcycles have a much narrower profile than cars and can easily be obscured in mirrors or blind spots. Always look twice for motorcycles before pulling out or changing lanes. "Sorry, I didn\'t see them" is not a valid excuse.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_007',
    questionText: 'You are driving a long vehicle and need to turn right. Oncoming traffic is preventing you from completing the turn. What should you do?',
    options: [
      'Wait at the centre of the junction until oncoming traffic stops',
      'Sound your horn to ask oncoming traffic to give way',
      'Reverse and find an alternative route',
      'Move forward into the junction, wait in the turning position, and complete the turn when safe',
    ],
    correctIndex: 3,
    explanation:
      'When turning right across oncoming traffic, position at the centre line and wait for a safe gap. Long vehicles may need to wait in the junction but must ensure they do not cause a permanent blockage. Wait patiently for a safe opportunity to complete the turn.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_008',
    questionText: 'What is the maximum motorway speed for a bus or coach?',
    options: [
      '60mph',
      '65mph',
      '70mph',
      'The same as a car - 70mph',
    ],
    correctIndex: 0,
    explanation:
      'The maximum speed for a bus or coach on a motorway is 60mph. This is lower than the 70mph limit for cars to account for their heavier weight, higher centre of gravity, and greater stopping distances.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_009',
    questionText: 'Amber flashing lights on a vehicle or sign generally indicate what?',
    options: [
      'The vehicle is an emergency vehicle requiring you to stop',
      'The vehicle is slow-moving or there is a hazard ahead requiring caution',
      'The vehicle is indicating a turn and you should give way',
      'The vehicle is reversing and you must not proceed',
    ],
    correctIndex: 1,
    explanation:
      'Amber flashing lights warn of a slow-moving hazard. They are used on recovery vehicles, abnormal loads, motorway maintenance vehicles, and roadside warning signs. You should slow down and take care when you see amber warning lights.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_010',
    questionText: 'A motorcyclist is overtaking you on the right. At what point is it safe to turn right?',
    options: [
      'As soon as the motorcyclist\'s front wheel passes your vehicle',
      'Only after the motorcyclist has fully passed and is well ahead of you',
      'You can turn right provided you signal first',
      'Immediately - motorcyclists should not be overtaking near junctions',
    ],
    correctIndex: 1,
    explanation:
      'Wait until the motorcyclist has completely passed and is well clear before turning. A motorcyclist travelling at speed can close a gap very quickly. Turning into a motorcycle is one of the most common serious collision types.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_011',
    questionText: 'A very slow-moving tractor is ahead on a country road with no passing places. What is the safest approach?',
    options: [
      'Drive very closely behind so the tractor driver sees you and moves over',
      'Sound your horn regularly to encourage the tractor driver to pull in',
      'Drop back to maintain a safe following distance and wait for a safe overtaking opportunity',
      'Overtake when there is a gap in oncoming traffic, regardless of road markings',
    ],
    correctIndex: 2,
    explanation:
      'Be patient when following slow agricultural vehicles. Stay well back for a clear view of the road ahead and wait until it is completely safe to overtake - a clear straight road, no oncoming traffic, and no road markings prohibiting overtaking.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_012',
    questionText: 'You see a fire engine or ambulance at the roadside attending an incident. What should you do when passing?',
    options: [
      'Sound your horn so they are aware you are passing',
      'Slow down, take care, and pass at a safe reduced speed',
      'Maintain normal speed as emergency services are trained to work near traffic',
      'Stop completely until all emergency vehicles have left the scene',
    ],
    correctIndex: 1,
    explanation:
      'Pass stationary emergency services slowly and with care. Emergency workers are operating in a dangerous environment close to live traffic. Many countries operate a "Move Over" law - in the UK, take great care and slow right down.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_013',
    questionText: 'What do three short blasts of a horn from a large vehicle usually signify?',
    options: [
      'The driver is warning you not to overtake',
      'This is not a standard recognised signal in the Highway Code',
      'The driver is indicating they are reversing',
      'The driver is warning of a hazard ahead',
    ],
    correctIndex: 1,
    explanation:
      'Three short blasts is not a standardised Highway Code signal. The horn should only be used to warn of presence. Do not interpret unofficial horn sequences as instructions - they are not part of the recognised signalling system.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_014',
    questionText: 'Cyclists are allowed to use which lanes on a road?',
    options: [
      'Only dedicated cycle lanes',
      'Any part of the road, including the main carriageway, unless signed otherwise',
      'Only the left-hand lane of a dual carriageway',
      'The pavement when there is no dedicated cycle lane',
    ],
    correctIndex: 1,
    explanation:
      'Cyclists are permitted to ride on any part of the road unless signs indicate otherwise. They do not have to use cycle lanes if they are present. Cyclists riding in the primary position (middle of the lane) can do so legitimately to increase their visibility.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_015',
    questionText: 'What is the purpose of an "abnormal load" escort vehicle?',
    options: [
      'To carry spare parts for the oversized vehicle in case of breakdown',
      'To warn other road users of the wide or long load ahead and assist with traffic management',
      'To enforce the special speed restrictions that apply to all large vehicles',
      'To provide communications between the load driver and the police',
    ],
    correctIndex: 1,
    explanation:
      'Escort vehicles accompany abnormal (oversized) loads to warn other road users that an unusually wide or long vehicle is ahead. They help manage traffic at junctions and ensure the load can complete its route safely.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
];
