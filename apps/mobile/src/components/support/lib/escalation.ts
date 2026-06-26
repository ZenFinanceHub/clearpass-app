import { EscalationPayload } from '../types/support';

export async function sendEscalation(payload: EscalationPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_CLEARPASS;
  if (!webhookUrl) {
    console.error('[ClearPass Support] SLACK_WEBHOOK_CLEARPASS not set — escalation skipped');
    return;
  }

  const userLine = payload.userEmail
    ? `*User:* ${payload.userEmail}${payload.userId ? ` (${payload.userId})` : ''}`
    : payload.userId
    ? `*User ID:* ${payload.userId}`
    : '*User:* Not authenticated';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🚗 ClearPass — Support Escalation',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚗 ClearPass — Support Escalation', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userLine}\n*Platform:* ${payload.platform}`,
            },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*User message:*\n> ${payload.userMessage}` },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recent conversation:*\n\`\`\`${payload.conversationSnippet}\`\`\``,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `Escalated at ${new Date().toUTCString()}` }],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[ClearPass Support] Slack escalation failed:', err);
  }
}
