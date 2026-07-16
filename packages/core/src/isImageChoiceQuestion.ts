import { Question } from './types/Question';

export function isImageChoiceQuestion(q: Question): boolean {
  return Array.isArray(q.optionImages) && q.optionImages.length === q.options.length;
}
