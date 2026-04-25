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
}
