import { expect, test } from 'vitest';
import { isImageChoiceQuestion } from './isImageChoiceQuestion';
import { TopicCategory } from './types/TopicCategory';
import { Question } from './types/Question';

const base: Question = {
  id: 'X1',
  questionText: 'test',
  options: ['a', 'b', 'c', 'd'],
  correctIndex: 0,
  explanation: 'test',
  topicCategory: TopicCategory.RoadAndTrafficSigns,
  difficulty: 1,
};

test('false when optionImages is absent', () => {
  expect(isImageChoiceQuestion(base)).toBe(false);
});

test('false when optionImages length does not match options length', () => {
  expect(isImageChoiceQuestion({ ...base, optionImages: ['img1.png'] })).toBe(false);
});

test('true when optionImages has one entry per option', () => {
  expect(isImageChoiceQuestion({
    ...base,
    optionImages: ['img1.png', 'img2.png', 'img3.png', 'img4.png'],
  })).toBe(true);
});
