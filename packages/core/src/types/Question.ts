import { TopicCategory } from './TopicCategory';

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicCategory: TopicCategory;
  difficulty: 1 | 2 | 3;
  imageUrl?: string;
  /**
   * When set, one image per entry in `options` (same length, same order).
   * `options[i]` becomes the accessible/TTS label for that image rather
   * than visible button text — see isImageChoiceQuestion().
   */
  optionImages?: string[];
}
