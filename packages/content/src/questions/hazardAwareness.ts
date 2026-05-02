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
      'A developing hazard is something that requires you to take action - braking, steering, or changing speed. Spotting it early and scoring higher in the hazard perception test means responding as soon as the hazard starts to develop.',
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
      'Highway Code Rule 239 advises watching for car doors opening when passing parked vehicles. Reducing speed and being ready to respond safely is the correct approach - swerving abruptly into traffic is dangerous.',
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
      'Farm vehicles often turn into field gateways that may not be immediately visible on your approach. They may slow and turn abruptly - maintain a safe distance and watch for any indication of a turn.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_006',
    questionText: 'What does the "MSM" routine stand for, and when should it be applied?',
    options: [
      'Mirror, Speed, Manoeuvre - used only when overtaking',
      'Mirror, Signal, Manoeuvre - used before any change in speed, direction, or position',
      'Move, Stop, Move - used at junctions',
      'Mirror, Steer, Merge - used when joining a main road',
    ],
    correctIndex: 1,
    explanation:
      'MSM (Mirror, Signal, Manoeuvre) is the core observation routine used before every change in direction, speed, or road position. Always check mirrors first so you know what is behind before you signal or act.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_007',
    questionText: 'Your car begins to skid. What is the correct initial response?',
    options: [
      'Brake firmly and steer hard in the opposite direction of the skid',
      'Take your foot off the accelerator and steer smoothly in the direction you want to go',
      'Apply the handbrake to slow the rear wheels',
      'Accelerate to restore traction to the driven wheels',
    ],
    correctIndex: 1,
    explanation:
      'In a skid, releasing the accelerator reduces the forces causing the skid. Steer gently in the direction you want the front of the car to go. Avoid harsh braking or sudden steering corrections, which can worsen the skid.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_008',
    questionText: 'You are approaching an unmarked crossroads of equal-sized roads. Who has priority?',
    options: [
      'Traffic on the road running left to right always has priority',
      'Vehicles travelling straight ahead have priority over those turning',
      'There is no priority - all drivers must take extra care and be prepared to give way',
      'The first vehicle to reach the junction has absolute priority',
    ],
    correctIndex: 2,
    explanation:
      'At an unmarked crossroads with no signs or markings, no driver has automatic priority. All road users must approach with care and be prepared to give way. Treat it as you would a potential hazard.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 3,
  },
  {
    id: 'HAZ_009',
    questionText: 'It is autumn and fallen leaves cover the road surface. Why is this a hazard?',
    options: [
      'Leaves can block the drainage channels and cause flooding',
      'Wet leaves are very slippery and can reduce tyre grip significantly',
      'Leaves blow up and reduce visibility through the windscreen',
      'Leaves can cause damage to the underside of the vehicle',
    ],
    correctIndex: 1,
    explanation:
      'Wet fallen leaves are extremely slippery and can reduce tyre grip to a similar level as ice. Braking distances increase dramatically. Treat leaf-covered roads with extra caution, especially on bends and hills.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_010',
    questionText: 'You are following a large lorry on a single-carriageway road. Why should you hold back rather than drive close behind it?',
    options: [
      'Large vehicles brake faster than cars and could stop suddenly',
      'Holding back gives you a better view of the road ahead and more time to react',
      'It is a legal requirement to leave 10 car lengths behind a lorry',
      'The lorry\'s exhaust fumes can reduce engine performance in following vehicles',
    ],
    correctIndex: 1,
    explanation:
      'Holding back from a large vehicle improves your view of the road ahead, giving you more time to react to developing hazards. It also gives the lorry driver a clearer view in their mirrors and reduces the risk of debris striking your vehicle.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_011',
    questionText: 'In the hazard perception test, how is your score affected if you click the mouse repeatedly in a short period?',
    options: [
      'Your score for that clip is doubled as it shows awareness',
      'You receive the maximum score of 5 for alertness',
      'You score zero for that clip as the system detects a pattern suggesting guessing',
      'You receive a warning but your score is unaffected',
    ],
    correctIndex: 2,
    explanation:
      'The hazard perception test software detects if you click in a regular pattern, which suggests guessing rather than genuine hazard recognition. If this pattern is detected, you score zero for that clip.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
  {
    id: 'HAZ_012',
    questionText: 'You are about to overtake on a country road when you see a vehicle approaching from a side road on the right. What should you do?',
    options: [
      'Flash your lights to warn the driver and proceed with the overtake quickly',
      'Abandon the overtake, drop back, and wait until it is clearly safe',
      'Sound your horn and continue with the overtake at increased speed',
      'Proceed with the overtake but move slightly left to create more room',
    ],
    correctIndex: 1,
    explanation:
      'Any new hazard that emerges during an overtake means you must abandon it immediately and drop back. Never commit to an overtake if the road ahead or emerging hazards make completion unsafe.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 3,
  },
  {
    id: 'HAZ_013',
    questionText: 'You are approaching a hump-back bridge on a country road. What is the key hazard?',
    options: [
      'The road surface is often uneven, causing steering problems',
      'Oncoming vehicles may be hidden until they appear over the top of the bridge',
      'Bridge structures cause crosswinds that push the car sideways',
      'The road becomes slippery due to water drainage from the bridge',
    ],
    correctIndex: 1,
    explanation:
      'Hump-back bridges severely restrict forward visibility. An oncoming vehicle, cyclist, or pedestrian may only become visible at very close range. Approach slowly and be prepared to stop, especially if the road is narrow.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_014',
    questionText: 'You approach a group of horse riders on a country road. What is the best way to pass them?',
    options: [
      'Sound your horn to warn the riders you are approaching',
      'Pass at normal speed but leave plenty of room',
      'Slow right down, pass wide and slowly, and avoid revving or sudden acceleration',
      'Flash your headlights to warn them and pass quickly to minimise disturbance',
    ],
    correctIndex: 2,
    explanation:
      'Horses are easily startled by noise and sudden movement. Pass slowly and quietly, leaving as much room as possible. Do not rev the engine or accelerate sharply until you are well past the horses.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 1,
  },
  {
    id: 'HAZ_015',
    questionText: 'Bright sunshine is directly ahead of you. What steps should you take?',
    options: [
      'Pull over until the sun moves to a less dazzling angle',
      'Slow down, use the sun visor, and allow extra stopping distance',
      'Increase speed to reduce the time spent driving into the sun',
      'Switch on headlights so other road users can see you more clearly',
    ],
    correctIndex: 1,
    explanation:
      'Sun dazzle can temporarily blind you completely, masking hazards including pedestrians and cyclists. Use the sun visor, slow down, allow extra stopping distance, and keep sunglasses in the car for exactly this situation.',
    topicCategory: TopicCategory.HazardAwareness,
    difficulty: 2,
  },
];
