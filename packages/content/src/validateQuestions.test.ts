import { test, expect } from 'vitest';
import { validateQuestions } from './validateQuestions';
import { TopicCategory } from '@clearpass/core';
import { Question } from '@clearpass/core';

const okTextQuestion: Question = {
  id: 'OK1', questionText: 'test', options: ['a', 'b', 'c', 'd'],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.Alertness, difficulty: 1,
};

const okImageQuestion: Question = {
  id: 'OK2', questionText: 'test', options: ['sign A', 'sign B', 'sign C', 'sign D'],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.RoadAndTrafficSigns, difficulty: 1,
  optionImages: ['a.png', 'b.png', 'c.png', 'd.png'],
};

const brokenBlankQuestion: Question = {
  id: 'BROKEN1', questionText: 'test', options: ['', '', '', ''],
  correctIndex: 0, explanation: 'test', topicCategory: TopicCategory.RoadAndTrafficSigns, difficulty: 1,
};

test('passes for a normal text-option question', () => {
  expect(validateQuestions([okTextQuestion])).toEqual([]);
});

test('passes for a correctly-formed image-choice question', () => {
  expect(validateQuestions([okImageQuestion])).toEqual([]);
});

test('flags a question with blank options and no optionImages', () => {
  const errors = validateQuestions([brokenBlankQuestion]);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('BROKEN1');
});

test('flags optionImages with wrong length', () => {
  const bad: Question = { ...okImageQuestion, id: 'BROKEN2', optionImages: ['a.png'] };
  const errors = validateQuestions([bad]);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('BROKEN2');
});

import { alertnessQuestions } from './questions/alertness';
import { attitudeQuestions } from './questions/attitude';
import { safetyMarginsQuestions } from './questions/safetyMargins';
import { hazardAwarenessQuestions } from './questions/hazardAwareness';
import { roadsignsQuestions } from './questions/roadsigns';
import { rulesOfTheRoadQuestions } from './questions/rulesOfTheRoad';
import { safetyAndYourVehicleQuestions } from './questions/safetyAndYourVehicle';
import { vulnerableRoadUsersQuestions } from './questions/vulnerableRoadUsers';
import { otherTypesQuestions } from './questions/otherTypes';
import { vehicleHandlingQuestions } from './questions/vehicleHandling';
import { motorwayRulesQuestions } from './questions/motorwayRules';
import { documentsAndRegulationsQuestions } from './questions/documentsAndRegulations';
import { accidentsAndEmergenciesQuestions } from './questions/accidentsAndEmergencies';
import { vehicleLoadingQuestions } from './questions/vehicleLoading';

const rawQuestions = [
  ...alertnessQuestions, ...attitudeQuestions, ...safetyMarginsQuestions,
  ...hazardAwarenessQuestions, ...roadsignsQuestions, ...rulesOfTheRoadQuestions,
  ...safetyAndYourVehicleQuestions, ...vulnerableRoadUsersQuestions, ...otherTypesQuestions,
  ...vehicleHandlingQuestions, ...motorwayRulesQuestions, ...documentsAndRegulationsQuestions,
  ...accidentsAndEmergenciesQuestions, ...vehicleLoadingQuestions,
];

test('the real question bank has no blank-options-without-images violations (known baseline: 27 as of 2026-07-16, target: 0)', () => {
  const errors = validateQuestions(rawQuestions);
  // This assertion is EXPECTED TO FAIL right now — that's the point. It documents
  // the exact current state and turns green as Tasks 9-13 fix content. Do not
  // weaken this test to make it pass; fix the content instead. Do NOT import
  // `allQuestions` here — it already filters these exact questions out (see
  // the discovery note above this task), which would make this test vacuously
  // pass and defeat its purpose.
  expect(errors).toEqual([]);
});
