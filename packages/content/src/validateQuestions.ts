import { Question, isImageChoiceQuestion } from '@clearpass/core';

export function validateQuestions(questions: Question[]): string[] {
  const errors: string[] = [];

  for (const q of questions) {
    const allOptionsBlank = q.options.every((o) => o.trim() === '');
    const hasValidImageChoice = isImageChoiceQuestion(q);
    const hasMismatchedImageCount =
      Array.isArray(q.optionImages) && q.optionImages.length !== q.options.length;

    if (allOptionsBlank && !hasValidImageChoice) {
      errors.push(
        `${q.id}: all 4 options are blank and optionImages is not set (or wrong length) — question is unanswerable as rendered.`
      );
    } else if (hasMismatchedImageCount) {
      errors.push(
        `${q.id}: optionImages has ${q.optionImages!.length} entries but options has ${q.options.length} — must match.`
      );
    }
  }

  return errors;
}
