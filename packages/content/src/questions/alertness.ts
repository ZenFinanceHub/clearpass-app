// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const alertnessQuestions: Question[] = [
  {
    id: 'ALT_001',
    questionText: 'You start to feel tired while driving on a motorway. What should you do?',
    options: [
      'Open a window and turn the radio up to stay stimulated',
      'Pull off at the next exit and rest in a safe place',
      'Speed up to reach your destination sooner',
      'Drink an energy drink and keep going',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 91 states you must stop at a safe place if you feel sleepy. Opening a window or stimulants only delay the problem - the only cure for tiredness is rest.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
  {
    id: 'ALT_002',
    questionText: 'You need to make a phone call while driving. What must you do?',
    options: [
      'Use the phone on loudspeaker while holding it on your lap',
      'Keep the call very brief and drive carefully',
      'Find a safe place to pull over before making the call',
      'Only make the call when stopped at traffic lights',
    ],
    correctIndex: 2,
    explanation:
      'It is illegal to hold a mobile phone while driving. Even hands-free calls can be a distraction. You should always find a safe place to stop before using a phone.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
  {
    id: 'ALT_003',
    questionText: 'How does driver fatigue affect your ability to drive?',
    options: [
      'It makes you more cautious and slows you down beneficially',
      'It has no effect if you are on a familiar route',
      'It significantly slows your reaction time and reduces concentration',
      'It only affects driving after more than four hours on the road',
    ],
    correctIndex: 2,
    explanation:
      'Fatigue is one of the leading causes of road accidents. It impairs judgement, slows reaction times, and can cause drivers to fall asleep at the wheel without warning.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
  {
    id: 'ALT_004',
    questionText: 'You are driving and feel hungry. You have a sandwich on the passenger seat. What is the safest action?',
    options: [
      'Eat while driving using one hand on the wheel',
      'Stop in a safe place before eating',
      'Eat quickly while stopped at traffic lights',
      'Ask a passenger to feed you while you drive',
    ],
    correctIndex: 1,
    explanation:
      'Eating while driving is a distraction that takes your hands off the wheel and your eyes off the road. You should always stop safely before eating or drinking.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_005',
    questionText: 'What is the most effective way to stay alert on a long motorway journey?',
    options: [
      'Drive faster to shorten the journey time',
      'Keep the car warm and the heater on full',
      'Take regular breaks - at least every two hours',
      'Turn up the radio and sing along',
    ],
    correctIndex: 2,
    explanation:
      'Highway Code Rule 91 recommends taking a break of at least 15 minutes after every two hours of driving. Monotonous motorway driving accelerates fatigue, making regular stops essential.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
  {
    id: 'ALT_006',
    questionText: 'You are taking prescription medication that may cause drowsiness. What should you do before driving?',
    options: [
      'Drive only on familiar roads where you know the route',
      'Check with your doctor or pharmacist whether it is safe to drive',
      'Take half the dose so the drowsiness effect is reduced',
      'Drive only in daylight and avoid motorways',
    ],
    correctIndex: 1,
    explanation:
      'Some prescription and over-the-counter medicines can impair driving. Always consult your doctor or pharmacist before driving while on medication. Driving whilst impaired by drugs - including prescribed ones - is an offence.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_007',
    questionText: 'What is the danger of carbon monoxide inside a vehicle?',
    options: [
      'It causes the windows to steam up and reduces visibility',
      'It is an odourless gas that can cause drowsiness and loss of consciousness',
      'It affects the fuel mixture and reduces engine performance',
      'It only affects passengers, not the driver',
    ],
    correctIndex: 1,
    explanation:
      'Carbon monoxide is colourless and odourless, making it impossible to detect without an alarm. A faulty exhaust or heater can introduce it into the cabin, causing drowsiness and eventually unconsciousness.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_008',
    questionText: 'How often should you check your mirrors while driving on an open road?',
    options: [
      'Only when you intend to turn or change speed',
      'At least every 8 to 12 seconds as a general guide',
      'Once every 30 seconds is sufficient',
      'Only when another vehicle is close behind you',
    ],
    correctIndex: 1,
    explanation:
      'Effective observation requires checking mirrors frequently - approximately every 8 to 12 seconds - so you always have an up-to-date picture of what is around you. Always check mirrors before signalling, changing speed, or changing position.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_009',
    questionText: 'What is a "microsleep" and why is it dangerous for drivers?',
    options: [
      'A very short but deliberate nap taken during a rest break',
      'An involuntary episode of sleep lasting seconds, often without the driver realising',
      'A state of reduced alertness caused by bright sunshine',
      'A period of inattention caused by distracting passengers',
    ],
    correctIndex: 1,
    explanation:
      'A microsleep is an involuntary, brief loss of consciousness lasting from a fraction of a second to several seconds. The driver is completely unaware it has happened. At 70mph, a 4-second microsleep means travelling blind for over 100 metres.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 3,
  },
  {
    id: 'ALT_010',
    questionText: 'You want to adjust your satellite navigation system. The safest thing to do is:',
    options: [
      'Make quick adjustments at traffic lights',
      'Ask a passenger to operate it while you drive',
      'Pull over in a safe place before making any adjustments',
      'Programme it while travelling below 20mph',
    ],
    correctIndex: 2,
    explanation:
      'Interacting with a sat nav while moving is a distraction. Even brief glances away from the road increase collision risk significantly. Always stop safely before making adjustments to any in-vehicle device.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
  {
    id: 'ALT_011',
    questionText: 'Driving at night is more tiring than driving during the day. Why?',
    options: [
      'Road surfaces are colder and require more steering effort',
      'Your body naturally wants to sleep during the night hours',
      'Headlights consume extra power that drains concentration',
      'Oncoming headlights cause pupils to constrict repeatedly',
    ],
    correctIndex: 1,
    explanation:
      'The body\'s natural circadian rhythm promotes sleep at night. This means alertness is inherently lower during night driving, making fatigue build faster. Drivers should be especially vigilant on late-night journeys.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_012',
    questionText: 'An oncoming vehicle has its full-beam headlights on, dazzling you. What should you do?',
    options: [
      'Flash your own full-beam to signal them to dip their lights',
      'Close one eye to protect your night vision',
      'Slow down and look towards the left edge of the road until they pass',
      'Pull over and stop until the dazzle has passed',
    ],
    correctIndex: 2,
    explanation:
      'Flashing back can dazzle the other driver. Looking towards the left edge of the road avoids direct exposure to the glare and gives you a reference point. Slow down, as your effective vision is reduced until the vehicle passes.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_013',
    questionText: 'You have been driving for three hours without a break and you feel fine. Should you still stop?',
    options: [
      'No - only stop if you feel tired',
      'Yes - fatigue can build up without you being aware of it',
      'No - three hours is within safe driving guidelines',
      'Yes - but only if travelling at motorway speeds',
    ],
    correctIndex: 1,
    explanation:
      'Fatigue can develop gradually and impair your driving before you feel obviously tired. Highway Code Rule 91 advises taking at least a 15-minute break every two hours regardless of how you feel.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 2,
  },
  {
    id: 'ALT_014',
    questionText: 'Which of these is most likely to cause a driver to lose concentration?',
    options: [
      'Driving in light rain on a well-lit road',
      'Talking on a hands-free mobile phone while on a dual carriageway',
      'Using cruise control on a clear motorway at the speed limit',
      'Driving a familiar route in good weather',
    ],
    correctIndex: 1,
    explanation:
      'Research shows that hands-free phone calls are almost as distracting as handheld calls because the mental demand of a conversation diverts attention from the driving task. The distraction is cognitive, not just physical.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 3,
  },
  {
    id: 'ALT_015',
    questionText: 'You are about to start a long journey and feel tired. What should you do?',
    options: [
      'Start the journey and stop if you become drowsy on the way',
      'Delay your journey and get adequate sleep before setting off',
      'Drink two cups of strong coffee before departing',
      'Set a shorter route to reduce the total driving time',
    ],
    correctIndex: 1,
    explanation:
      'Setting off while tired is dangerous. The only safe solution is to delay the journey until you are properly rested. Caffeine and other stimulants provide only temporary relief and cannot substitute for sleep.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
];
