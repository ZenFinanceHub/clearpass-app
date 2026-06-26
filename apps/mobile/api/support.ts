import Anthropic from '@anthropic-ai/sdk';
import { CLEARPASS_SYSTEM_PROMPT } from '../src/components/support/lib/systemPrompt';
import { sendEscalation } from '../src/components/support/lib/escalation';

export const config = { runtime: 'edge' };

interface RequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[];
  platform?: 'web' | 'ios' | 'android';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { messages, platform = 'web' }: RequestBody = await req.json();

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  let fullText = '';
  let escalationFired = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: CLEARPASS_SYSTEM_PROMPT,
          messages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const delta = event.delta.text;
            fullText += delta;

            const cleanDelta = delta.replace('[ESCALATE]', '');
            if (cleanDelta) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ delta: { text: cleanDelta } })}\n\n`
                )
              );
            }

            if (!escalationFired && fullText.includes('[ESCALATE]') && lastUserMessage) {
              escalationFired = true;
              const snippet = messages
                .slice(-4)
                .map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content.slice(0, 200)}`)
                .join('\n');

              sendEscalation({
                userMessage: lastUserMessage.content,
                conversationSnippet: snippet,
                platform,
              }).catch(console.error);
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        console.error('[ClearPass Support] Stream error:', err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
