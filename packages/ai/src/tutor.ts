import Anthropic from '@anthropic-ai/sdk';
import { TUTOR_SYSTEM_PROMPT } from './systemPrompt';

export async function explainAnswer(
  question: string,
  options: string[],
  correctIndex: number,
  selectedIndex: number,
  apiKey: string,
): Promise<string> {
  const correctOption = options[correctIndex];
  const selectedOption = options[selectedIndex];

  const optionsList = options
    .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
    .join('\n');

  const userMessage =
    `Question: ${question}\n\n` +
    `Options:\n${optionsList}\n\n` +
    `The learner chose: ${String.fromCharCode(65 + selectedIndex)}. ${selectedOption}\n` +
    `The correct answer is: ${String.fromCharCode(65 + correctIndex)}. ${correctOption}\n\n` +
    `Please explain why "${correctOption}" is the correct answer, and why the learner's choice was incorrect.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: TUTOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = message.content[0];
    if (block.type === 'text') {
      return block.text.trim();
    }
    return fallback(correctOption);
  } catch {
    return fallback(correctOption);
  }
}

function fallback(correctOption: string): string {
  return `The correct answer is "${correctOption}". Review this topic in the Highway Code for more details.`;
}
