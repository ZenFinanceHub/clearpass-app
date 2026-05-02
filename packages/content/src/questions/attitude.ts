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
  {
    id: 'ATT_006',
    questionText: 'An emergency vehicle with flashing blue lights and a siren is approaching from behind. What must you do?',
    options: [
      'Speed up to get out of the way as quickly as possible',
      'Move over safely to let it pass, even if this means crossing a solid white line',
      'Stop immediately wherever you are',
      'Continue normally and let it find a way around',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 219 requires you to move over and let emergency vehicles pass. You may cross a solid white line to do so if it is safe. Never stop on a motorway hard shoulder to let them pass unless instructed.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_007',
    questionText: 'Between 11:30pm and 7:00am in a built-up area, when is it illegal to sound your horn?',
    options: [
      'When stationary, except to warn of immediate danger',
      'At any time, regardless of circumstances',
      'Only when other vehicles are present',
      'When parked, but not when moving',
    ],
    correctIndex: 0,
    explanation:
      'Highway Code Rule 112 prohibits sounding the horn when stationary between 11:30pm and 7:00am in a built-up area, except to avoid danger. The horn must never be used aggressively at any time.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_008',
    questionText: 'You are stuck behind a slow-moving vehicle on a country road. The safest attitude is to:',
    options: [
      'Sit right behind it to put pressure on the driver to pull over',
      'Sound your horn repeatedly to encourage the driver to speed up',
      'Be patient, hang back, and wait for a safe opportunity to overtake',
      'Overtake as soon as there is a gap in oncoming traffic, regardless of road markings',
    ],
    correctIndex: 2,
    explanation:
      'Tailgating a slow vehicle is dangerous and intimidating. The correct attitude is patience. Overtake only when you can see the road ahead is clear, road markings permit, and you have enough distance to complete the manoeuvre safely.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_009',
    questionText: 'You are running late and feeling frustrated. How should this affect your driving?',
    options: [
      'It should not affect your driving at all - drive as you normally would',
      'You can exceed the speed limit slightly to make up time on a clear road',
      'You should take less time checking mirrors to save seconds',
      'It is acceptable to park briefly on yellow lines if you are only stopping for a moment',
    ],
    correctIndex: 0,
    explanation:
      'Emotional states such as frustration or stress are known to impair judgement and increase risk-taking. You must never let time pressure lead you to speed, take shortcuts on safety checks, or park illegally.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_010',
    questionText: 'A large lorry needs to pull out from a side road and is having difficulty. What is the considerate action?',
    options: [
      'Maintain your speed - the lorry driver should wait for a proper gap',
      'Flash your headlights to show you are giving way, then slow to let it out',
      'Slow down and wave the lorry out if it is safe to do so',
      'Sound your horn to warn the lorry driver to stay where they are',
    ],
    correctIndex: 2,
    explanation:
      'Being courteous to other road users improves traffic flow and reduces frustration. Slowing and waving a large vehicle out when safe is considerate driving. Flashing headlights to beckon another driver is not a recognised signal.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_011',
    questionText: 'You notice that a driver ahead is swerving slightly and driving erratically. What should you do?',
    options: [
      'Overtake them quickly to get ahead before they cause an accident',
      'Flash your lights and sound your horn to alert them',
      'Keep well back and, when safe, report your concerns to the police',
      'Pull alongside and shout to them through your window',
    ],
    correctIndex: 2,
    explanation:
      'Erratic driving may indicate tiredness, illness, or impairment. Keep a safe distance, never attempt to confront the driver, and report your concerns to the police when it is safe to do so.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 2,
  },
  {
    id: 'ATT_012',
    questionText: 'What is "queue jumping" and why is it considered poor driving?',
    options: [
      'Driving too slowly in a queue, causing obstruction behind',
      'Forcing your way into a queue of traffic instead of waiting your turn',
      'Leaving a large gap in a queue and allowing too many vehicles to join',
      'Using an outside lane to pass slow traffic then merging at the last moment unnecessarily',
    ],
    correctIndex: 1,
    explanation:
      'Forcing into a queue without waiting your turn is selfish and can cause accidents. It creates frustration and can lead to aggressive reactions from other drivers. Patience and consideration are hallmarks of good driving.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 3,
  },
  {
    id: 'ATT_013',
    questionText: 'You want to turn right but traffic in the opposite direction is blocking your path. What should you do?',
    options: [
      'Sound your horn to ask oncoming drivers to move',
      'Wait patiently until there is a safe gap in oncoming traffic',
      'Edge slowly into the oncoming lane to make your intentions clear',
      'Flash your headlights to ask oncoming traffic to give way',
    ],
    correctIndex: 1,
    explanation:
      'When turning right you must give way to oncoming traffic. Wait safely until there is a clear gap before completing the manoeuvre. Do not use the horn or headlights to demand right of way.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_014',
    questionText: 'A pedestrian is still crossing the road as traffic lights change to green in your favour. What must you do?',
    options: [
      'Sound your horn gently to alert them to move',
      'Edge forward slowly to encourage them to hurry',
      'Wait until the pedestrian has safely cleared the road before proceeding',
      'Move off carefully, passing behind the pedestrian',
    ],
    correctIndex: 2,
    explanation:
      'Pedestrians who have already started crossing have priority and must be allowed to finish crossing safely. Green lights give permission to proceed only when the way is clear - they do not override a pedestrian\'s right to finish crossing.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 1,
  },
  {
    id: 'ATT_015',
    questionText: 'You are driving in a residential area at night and want to signal that you have arrived at a friend\'s house. Which is the acceptable method?',
    options: [
      'Sound the horn briefly so they hear you arrive',
      'Flash your headlights twice outside their house',
      'Phone or text them to let them know you have arrived',
      'Rev the engine to let them know you are there',
    ],
    correctIndex: 2,
    explanation:
      'Sounding the horn or revving the engine in a residential area at night is inconsiderate and potentially illegal. Using a phone to notify someone of your arrival is the courteous alternative that does not disturb neighbours.',
    topicCategory: TopicCategory.Attitude,
    difficulty: 3,
  },
];
