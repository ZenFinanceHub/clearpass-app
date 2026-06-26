'use client';

import React, { useRef, useEffect, useState, KeyboardEvent, CSSProperties } from 'react';
import { useSupportChat } from './hooks/useSupportChat';

const BLUE        = '#2E6DA4';
const LIGHT       = '#EEF4FB';
const BORDER_BLUE = '#5B9BD5';

const QUICK_QUESTIONS = [
  'When does the app launch on Android?',
  'How does hazard perception work?',
  'A road sign image looks wrong',
  'I have a billing question',
];

export function ClearPassSupport() {
  const { messages, isLoading, isOpen, toggleOpen, sendMessage, clearChat } =
    useSupportChat();

  const [input, setInput]   = useState('');
  const bottomRef           = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage(text);
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const panelStyle: CSSProperties = {
    position:      'fixed',
    bottom:        92,
    right:         24,
    zIndex:        9998,
    width:         370,
    height:        520,
    borderRadius:  18,
    background:    '#fff',
    boxShadow:     '0 12px 40px rgba(0,0,0,0.18)',
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    opacity:       isOpen ? 1 : 0,
    transform:     isOpen ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
    transition:    'opacity 0.2s ease-out, transform 0.2s ease-out',
    pointerEvents: isOpen ? 'auto' : 'none',
  };

  return (
    <>
      <div style={panelStyle} role="dialog" aria-label="ClearPass support chat">
        {/* Header */}
        <div style={{
          background:     BLUE,
          color:          '#fff',
          padding:        '14px 16px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>🚗 ClearPass Support</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
              AI-powered · Escalates to team when needed
            </div>
          </div>
          <button
            onClick={clearChat}
            style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              fontSize: 12, padding: '4px 8px', borderRadius: 6,
            }}
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex:          1,
          overflowY:     'auto',
          padding:       '16px 14px',
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}>
          {messages.length === 0 && (
            <div style={{
              background: LIGHT, borderRadius: 12, padding: '14px 16px',
              fontSize: 14, color: '#333', lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Hi! How can I help?</div>
              <div style={{ color: '#555', fontSize: 13 }}>
                Ask me anything about ClearPass — tests, road signs, your account, or the app.
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => void sendMessage(q)}
                    style={{
                      background: '#fff', border: `1px solid ${BORDER_BLUE}`,
                      color: BLUE, borderRadius: 20, padding: '5px 11px',
                      fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div
              key={m.id}
              style={{
                alignSelf:    m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth:     '82%',
                background:   m.role === 'user' ? BLUE  : LIGHT,
                color:        m.role === 'user' ? '#fff' : '#1a1a1a',
                borderRadius: m.role === 'user'
                  ? '16px 16px 4px 16px'
                  : '16px 16px 16px 4px',
                padding:    '10px 14px',
                fontSize:   14,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak:  'break-word',
              }}
            >
              {m.content
                ? m.content
                : m.role === 'assistant' && isLoading
                ? <span style={{ letterSpacing: 4, opacity: 0.5 }}>•••</span>
                : null}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding:    '10px 12px',
          borderTop:  '1px solid #ececec',
          display:    'flex',
          gap:        8,
          alignItems: 'center',
          flexShrink: 0,
          background: '#fafafa',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question..."
            disabled={isLoading}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 22,
              border: '1px solid #ddd', fontSize: 14, outline: 'none',
              background: '#fff', color: '#222',
            }}
            onFocus={e => (e.target.style.borderColor = BORDER_BLUE)}
            onBlur={e  => (e.target.style.borderColor = '#ddd')}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send"
            style={{
              background:     BLUE,
              color:          '#fff',
              border:         'none',
              borderRadius:   '50%',
              width:          38,
              height:         38,
              cursor:         isLoading || !input.trim() ? 'default' : 'pointer',
              opacity:        isLoading || !input.trim() ? 0.4 : 1,
              flexShrink:     0,
              fontSize:       17,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              transition:     'opacity 0.15s',
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
        style={{
          position:       'fixed',
          bottom:         24,
          right:          24,
          zIndex:         9999,
          width:          56,
          height:         56,
          borderRadius:   '50%',
          background:     BLUE,
          border:         'none',
          cursor:         'pointer',
          boxShadow:      '0 4px 16px rgba(0,0,0,0.25)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#fff',
          fontSize:       22,
          transition:     'transform 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </>
  );
}
