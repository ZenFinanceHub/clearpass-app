// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const hazardAwarenessQuestions: Question[] = [
  {
    id: 'HAZ_001',
    questionText: 'In the hazard perception test, what is a "developing hazard"?',
    options: [
      'Any road sign or marking',
      'A situation that is likely to require you to change speed or direction',
      'Any other vehicle on the road',
      'A bend or hill that reduces your visibility',
    ],
    correctIndex: 1,
    explanation:
      'A developing hazard is something that requires you to take action — braking, steering, or changing speed. Spotting it early and scoring higher in the hazard perception test means responding as soon as the hazard starts to develop.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_002',
    questionText: 'You are driving past parked cars when a door opens into your path. What should you do?',
    options: [
      'Sound your horn and maintain speed to warn the driver',
      'Brake sharply and swerve into the oncoming lane',
      'Reduce speed and be prepared to stop or steer around the door',
      'Flash your headlights as a warning and accelerate past',
    ],
    correctIndex: 2,
    explanation:
      'Highway Code Rule 239 advises watching for car doors opening when passing parked vehicles. Reducing speed and being ready to respond safely is the correct approach — swerving abruptly into traffic is dangerous.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_003',
    questionText: 'You are driving past a school at 3:30pm on a weekday. What hazard should you be most alert to?',
    options: [
      'Increased HGV and delivery traffic near the school',
      'Children crossing the road unexpectedly between parked cars',
      'Bus engines causing slippery road surfaces',
      'Fallen leaves creating poor grip near the entrance',
    ],
    correctIndex: 1,
    explanation:
      'At school finishing time, large numbers of children may be near the road. Children can be unpredictable and may step out suddenly from between parked cars without looking.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_004',
    questionText: 'A bus has stopped at a bus stop ahead on your side of the road. What is the most significant hazard to anticipate?',
    options: [
      'The bus taking up too much of the road',
      'Pedestrians stepping into the road from in front of or behind the bus',
      'The bus driver making an incorrect signal',
      'Passengers queuing on the pavement',
    ],
    correctIndex: 1,
    explanation:
      'Pedestrians getting off or crossing from in front of stationary buses are a serious hazard because they are hidden from your view. Slow down and be ready to stop when passing any stationary bus.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_005',
    questionText: 'You are following a slow-moving tractor on a narrow rural road. What is the most important hazard to anticipate?',
    options: [
      'The tractor accelerating suddenly and unexpectedly',
      'The tractor turning without warning into a field entrance',
      'Oncoming tractors attempting to overtake from the opposite direction',
      'Exhaust fumes from the tractor affecting your visibility',
    ],
    correctIndex: 1,
    explanation:
      'Farm vehicles often turn into field gateways that may not be immediately visible on your approach. They may slow and turn abruptly — maintain a safe distance and watch for any indication of a turn.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
];
