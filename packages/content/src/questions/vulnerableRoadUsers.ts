// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const vulnerableRoadUsersQuestions: Question[] = [
  {
    id: 'VRU_001',
    questionText: 'How much space should you leave when overtaking a cyclist at speeds above 30mph?',
    options: [
      'At least 0.5 metres',
      'At least 1 metre',
      'At least 1.5 metres',
      'At least 2 metres',
    ],
    correctIndex: 2,
    explanation:
      'The Highway Code states you should give cyclists at least 1.5 metres when overtaking at speeds above 30mph. At lower speeds, leave at least 1 metre. Cyclists can swerve unexpectedly to avoid potholes or debris.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_002',
    questionText: 'A pedestrian has stepped onto a zebra crossing ahead of you. What must you do?',
    options: [
      'Sound your horn to warn them you are approaching',
      'Slow down and give way to the pedestrian',
      'Flash your headlights so they know to wait',
      'Proceed carefully as you have right of way if already moving',
    ],
    correctIndex: 1,
    explanation:
      'At a zebra crossing, once a pedestrian has stepped onto the crossing, they have priority and you must give way. Do not wave or signal to them - let them cross safely without pressure.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_003',
    questionText: 'A horse rider holds out their arm and moves it up and down. What does this signal mean?',
    options: [
      'They are turning right',
      'They are asking you to slow down',
      'They are warning of a hazard ahead',
      'They are turning left',
    ],
    correctIndex: 1,
    explanation:
      'A horse rider moving their arm up and down is asking you to slow down. Horses can be unpredictably frightened by vehicles. Pass slowly and quietly, leaving plenty of room, and do not accelerate sharply until well past.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_004',
    questionText: 'You are approaching a group of young children near a school crossing. What extra precautions should you take?',
    options: [
      'Sound your horn to warn them of your presence',
      'Reduce speed well in advance and be prepared to stop',
      'Move to the centre of the road to pass wide',
      'Flash your lights so they see you approaching',
    ],
    correctIndex: 1,
    explanation:
      'Children are unpredictable - they may step into the road without warning. Reduce speed well in advance near schools, especially at arrival and departure times, and be prepared to stop.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_005',
    questionText: 'A motorcyclist is filtering slowly past stationary traffic. What should you do?',
    options: [
      'Open your door slightly to discourage the motorcyclist from passing',
      'Be aware and do not change lane or position without checking for motorcyclists',
      'Sound your horn to warn the motorcyclist it is not safe to filter',
      'Move closer to the kerb to prevent the motorcyclist from passing',
    ],
    correctIndex: 1,
    explanation:
      'Motorcyclists filtering through slow or stationary traffic is legal. Check for motorcyclists before moving position or opening your door. Do not deliberately obstruct them.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_006',
    questionText: 'An elderly pedestrian is crossing the road slowly when the lights change to green in your favour. What should you do?',
    options: [
      'Proceed slowly - they should move out of the way',
      'Sound a gentle warning with the horn to let them know the lights have changed',
      'Wait patiently until they have safely reached the pavement',
      'Edge forward to show them you need to go',
    ],
    correctIndex: 2,
    explanation:
      'Pedestrians who are already crossing must always be allowed to complete their crossing safely, regardless of the traffic signal state. Elderly or disabled people may need extra time. Never pressure them to hurry.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_007',
    questionText: 'You see a person carrying a white cane at the roadside. What does this tell you?',
    options: [
      'They are a road worker and you should stop for instructions',
      'They have a visual impairment and may not see your vehicle approaching',
      'They are partially deaf and may not hear your approach',
      'They are an older person and may cross slowly',
    ],
    correctIndex: 1,
    explanation:
      'A white cane indicates a visual impairment. The person may not see your vehicle at all. Approach with great care, slow down, and be prepared to stop and wait until they have safely crossed.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_008',
    questionText: 'At a junction with an Advanced Stop Line (ASL) for cyclists, where must you stop when the lights are red?',
    options: [
      'At the second white line, leaving the cycle zone clear',
      'At the first white line, before the cycle zone',
      'Anywhere in the cycle zone if you arrive there before it is occupied',
      'At the same point you would stop at any other junction',
    ],
    correctIndex: 1,
    explanation:
      'When traffic lights are red at a junction with an Advanced Stop Line, you must stop at the first white line, not the second. This leaves the forward cycle zone clear for cyclists to position themselves safely ahead of traffic.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_009',
    questionText: 'You are driving at night and see a pedestrian walking on the road wearing dark clothing. What should you do?',
    options: [
      'Flash your headlights to warn them',
      'Slow down significantly and be prepared to stop',
      'Sound your horn continuously until they move to the pavement',
      'Switch to full-beam headlights to see them more clearly',
    ],
    correctIndex: 1,
    explanation:
      'Pedestrians in dark clothing are very difficult to see at night. Reduce your speed, use dipped headlights, and be prepared to stop. Switching to full-beam could dazzle the pedestrian, making the situation more dangerous.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_010',
    questionText: 'Why are motorcyclists particularly at risk at junctions?',
    options: [
      'Motorcycles have poor braking compared to cars',
      'Their smaller size makes them harder to see, and drivers may misjudge their speed',
      'Motorcycles are not permitted to filter at junctions',
      'Motorcyclists tend to exceed the speed limit more than other drivers',
    ],
    correctIndex: 1,
    explanation:
      'Motorcycles have a smaller profile than cars, making them harder to see, especially in mirrors and blind spots. Their speed is also harder to judge. "Sorry, I did not see the motorcyclist" is one of the most common causes of junction collisions.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_011',
    questionText: 'A school crossing patrol officer is displaying their stop sign as you approach. What must you do?',
    options: [
      'Slow to below 20mph and proceed with care',
      'Stop completely and wait until the officer gives a clear signal to proceed',
      'Give way to any children who are actually in the road',
      'Stop if children are present but proceed if the road is empty',
    ],
    correctIndex: 1,
    explanation:
      'When a school crossing patrol officer displays the stop board, you are legally required to stop and wait. You must not proceed until the officer has cleared the crossing and signals you to go.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 1,
  },
  {
    id: 'VRU_012',
    questionText: 'A cyclist signals to turn right at a junction ahead. How should you respond?',
    options: [
      'Overtake the cyclist quickly before they complete the manoeuvre',
      'Hang back and give the cyclist time and space to complete the turn safely',
      'Sound your horn to acknowledge their signal',
      'Flash your headlights to indicate you have seen them',
    ],
    correctIndex: 1,
    explanation:
      'Give cyclists space and time to complete their manoeuvre. Do not pressure them or attempt to squeeze past. A cyclist turning right will need to move towards the centre of the road and is vulnerable to following traffic.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_013',
    questionText: 'You are passing a horse and rider on a country road. The horse becomes startled. What should you do?',
    options: [
      'Accelerate past quickly to end the disturbance sooner',
      'Stop completely if necessary, switch off the engine, and wait calmly',
      'Sound the horn briefly so the rider knows you are there',
      'Rev the engine to urge the horse forward',
    ],
    correctIndex: 1,
    explanation:
      'If a horse becomes startled, stopping completely and switching off the engine is the safest action. Any noise or sudden movement can cause the horse to bolt and the rider to be injured. Be patient and wait for the horse to calm down.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
  {
    id: 'VRU_014',
    questionText: 'A pedestrian refuge (island) splits a wide road into two halves. How should you treat each half?',
    options: [
      'Treat the entire road as one crossing - give way if any pedestrians are on either half',
      'Treat each half as a separate crossing - give way if pedestrians are on your half',
      'Pedestrians must wait on the island; vehicles always have priority',
      'Give way only at the far side of the road crossing',
    ],
    correctIndex: 1,
    explanation:
      'A pedestrian refuge divides a wide road into two separate crossings. Treat each half independently. Give way to pedestrians if they are on your half of the road, but you are not obliged to stop for pedestrians waiting on the island.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 3,
  },
  {
    id: 'VRU_015',
    questionText: 'Why should you take extra care when overtaking cyclists in windy conditions?',
    options: [
      'Cyclists are legally required to dismount in strong winds',
      'Strong crosswinds can blow a cyclist into your path unexpectedly',
      'Wind noise prevents cyclists from hearing your approach',
      'Cyclists are entitled to ride in the middle of the lane in strong winds',
    ],
    correctIndex: 1,
    explanation:
      'Sudden gusts of wind can push a cyclist unexpectedly into the path of a passing vehicle. In windy conditions, leave extra space when overtaking and be prepared for sudden lateral movement by the cyclist.',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    difficulty: 2,
  },
];
