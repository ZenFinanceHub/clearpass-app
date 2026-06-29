export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface EscalationPayload {
  userMessage: string;
  conversationSnippet: string;
  platform: 'web' | 'ios' | 'android';
  userId?: string;
  userEmail?: string;
}
