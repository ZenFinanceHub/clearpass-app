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
      'Highway Code Rule 91 states you must stop at a safe place if you feel sleepy. Opening a window or stimulants only delay the problem — the only cure for tiredness is rest.',
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
      'Take regular breaks — at least every two hours',
      'Turn up the radio and sing along',
    ],
    correctIndex: 2,
    explanation:
      'Highway Code Rule 91 recommends taking a break of at least 15 minutes after every two hours of driving. Monotonous motorway driving accelerates fatigue, making regular stops essential.',
    topicCategory: TopicCategory.Alertness,
    difficulty: 1,
  },
];
