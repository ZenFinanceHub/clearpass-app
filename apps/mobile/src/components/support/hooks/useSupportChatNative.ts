import { useState, useCallback, useRef } from 'react';
import { Message } from '../types/support';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export function useSupportChatNative() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content:   content.trim(),
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() },
    ]);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/support`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body:    JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          platform: 'ios',
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      // React Native fetch doesn't support ReadableStream — read full response then parse SSE
      const text = await res.text();
      let fullContent = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const { delta } = JSON.parse(data) as { delta?: { text?: string } };
          if (delta?.text) fullContent += delta.text;
        } catch { /* skip malformed */ }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: fullContent } : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong — please try again.' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
