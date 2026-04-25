import { Question, TopicCategory } from '@clearpass/core';

import { alertnessQuestions } from './questions/alertness';
import { attitudeQuestions } from './questions/attitude';
import { safetyMarginsQuestions } from './questions/safetyMargins';
import { hazardAwarenessQuestions } from './questions/hazardAwareness';
import { roadsignsQuestions } from './questions/roadsigns';
import { rulesOfTheRoadQuestions } from './questions/rulesOfTheRoad';

export const allQuestions: Question[] = [
  ...alertnessQuestions,
  ...attitudeQuestions,
  ...safetyMarginsQuestions,
  ...hazardAwarenessQuestions,
  ...roadsignsQuestions,
  ...rulesOfTheRoadQuestions,
];

// Initialise every category to an empty array so the Record is always complete.
export const questionsByTopic: Record<TopicCategory, Question[]> = (
  Object.values(TopicCategory) as TopicCategory[]
).reduce(
  (acc, cat) => {
    acc[cat] = [];
    return acc;
  },
  {} as Record<TopicCategory, Question[]>,
);

for (const question of allQuestions) {
  questionsByTopic[question.topicCategory].push(question);
}

export function getQuestionById(id: string): Question | undefined {
  return allQuestions.find((q) => q.id === id);
}
