import { TUTOR_SYSTEM_PROMPT } from './systemPrompt';

// 'unauthorized' is distinct from 'error' so callers (practice.tsx) can
// show "sign in again" instead of quietly rendering the generic fallback
// as if it were a real explanation — an expired session isn't the same
// kind of failure as a network hiccup or a 5xx, and looked identical to
// the user before this.
export type ExplainResult =
  | { status: 'ok'; text: string }
  | { status: 'unauthorized' }
  | { status: 'rate_limited'; isPro: boolean }
  | { status: 'error'; text: string };

export async function explainAnswer(
  question: string,
  options: string[],
  correctIndex: number,
  selectedIndex: number,
  apiKey: string,
  accessToken: string | null,
): Promise<ExplainResult> {
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

  // __DEV__ is a Metro-injected global, no import needed — matches the
  // pattern already used in apps/mobile/app/(tabs)/tutor.tsx:23-27. The
  // window-based check this replaces always fell through to the
  // localhost branch on native (window is undefined there), which is
  // exactly the hang this fixes.
  //
  // This is a fifth independent copy of this same logic (see also
  // apps/mobile/app/(tabs)/tutor.tsx, apps/mobile/app/instructor.tsx,
  // apps/mobile/app/confirm-parent.tsx, apps/mobile/src/proxyUrl.ts).
  // Consolidating all of them into packages/core is the right fix but is
  // separate work, not done here — this is deliberately the minimal,
  // targeted fix for the hang.
  const PROXY_URL = __DEV__
    ? 'http://localhost:3001'
    : 'https://clearpass-app-production.up.railway.app';

  try {
    const response = await fetch(`${PROXY_URL}/api/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Server doesn't require this yet (step 1 of rolling out auth on
        // /api/explain) — sent now so making it mandatory later doesn't
        // need a client change too.
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: TUTOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (response.status === 401) {
      return { status: 'unauthorized' };
    }

    if (response.status === 429) {
      const body = await response.json().catch(() => null) as { isPro?: boolean } | null;
      return { status: 'rate_limited', isPro: body?.isPro === true };
    }

    if (!response.ok) {
      await response.text();
      return { status: 'error', text: fallback(correctOption) };
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    return { status: 'ok', text: data.content[0].text.trim() };
  } catch {
    return { status: 'error', text: fallback(correctOption) };
  }
}

function fallback(correctOption: string): string {
  return `The correct answer is "${correctOption}". Review this topic in the Highway Code for more details.`;
}
