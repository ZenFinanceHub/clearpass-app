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
    `Please explain why "${correctOption}" is the correct answer, and why the learner's choice was incorrect.\n\n` +
    `Keep your response under 60 words. Do not use markdown formatting - no asterisks, no bold, no bullet points. Write in plain conversational sentences only.`;

  try {
    const response = await fetch('http://localhost:3001/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: TUTOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      await response.text();
      return fallback(correctOption);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    return data.content[0].text.trim();
  } catch {
    return fallback(correctOption);
  }
}

function fallback(correctOption: string): string {
  return `The correct answer is "${correctOption}". Review this topic in the Highway Code for more details.`;
}
