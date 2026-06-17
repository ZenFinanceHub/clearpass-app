import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getTutorQuestionsUsed, incrementTutorQuestionsUsed } from '@/src/storage';
import { isPremium } from '@/src/subscription';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const FREE_LIMIT = 5;

function getProxyUrl(): string {
  return __DEV__
    ? 'http://localhost:3001'
    : 'https://clearpass-app-production.up.railway.app';
}

const SYSTEM_PROMPT =
  'You are a friendly UK driving theory test tutor for the ClearPass app. ' +
  'Help learner drivers understand theory test questions and Highway Code rules. ' +
  'Keep explanations clear, concise and encouraging. ' +
  'Focus on UK driving rules and regulations. ' +
  'When explaining wrong answers, always explain WHY the correct answer is right and WHY the wrong answer is wrong. ' +
  'Use simple language suitable for learner drivers.';

const WELCOME =
  "Hi! I'm your AI driving theory tutor 👋 Ask me anything about the Highway Code, road signs, or theory test questions.";

type Msg = { id: string; role: 'user' | 'assistant'; content: string; time: string };

function nowTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function TutorScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    questionText?: string;
    userAnswerText?: string;
    correctAnswerText?: string;
    explanation?: string;
    freeMessage?: string;
  }>();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [dotCount, setDotCount] = useState(1);

  const messagesRef    = useRef<Msg[]>([]);
  const scrollRef      = useRef<ScrollView>(null);
  const lastQuestion   = useRef('');
  const lastFreeMsg    = useRef('');
  const isSending      = useRef(false);

  function updateMsgs(msgs: Msg[]) {
    messagesRef.current = msgs;
    setMessages(msgs);
  }

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setDotCount((d) => (d >= 3 ? 1 : d + 1)), 400);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, isLoading]);

  useFocusEffect(
    useCallback(() => {
      const q  = params.questionText;
      const fm = params.freeMessage;
      if (q && q !== lastQuestion.current) {
        lastQuestion.current = q;
        isSending.current = false;
        setIsLoading(false);
        updateMsgs([]);
        const opening =
          `Can you explain this question: ${q}` +
          ` - The correct answer is ${params.correctAnswerText ?? ''}.` +
          ` I answered ${params.userAnswerText ?? ''}.`;
        void sendText(opening);
      } else if (fm && fm !== lastFreeMsg.current) {
        lastFreeMsg.current = fm;
        isSending.current = false;
        setIsLoading(false);
        updateMsgs([]);
        void sendText(fm);
      } else if (!q && !fm && messagesRef.current.length === 0) {
        updateMsgs([{ id: '0', role: 'assistant', content: WELCOME, time: nowTime() }]);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.questionText, params.correctAnswerText, params.userAnswerText, params.freeMessage]),
  );

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending.current) return;

    const [used, premium] = await Promise.all([getTutorQuestionsUsed(), isPremium()]);
    if (used >= FREE_LIMIT && !premium) {
      setShowPaywall(true);
      return;
    }

    isSending.current = true;
    const userMsg: Msg = { id: String(Date.now()), role: 'user', content: trimmed, time: nowTime() };
    const next = [...messagesRef.current, userMsg];
    updateMsgs(next);
    setInput('');
    setIsLoading(true);

    await incrementTutorQuestionsUsed();

    const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));

    const url = `${getProxyUrl()}/api/explain`;
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = JSON.parse(rawText) as { content: Array<{ type: string; text: string }> };
      const reply = data.content[0]?.text?.trim() ?? "Sorry, I couldn't connect. Please try again.";
      updateMsgs([...messagesRef.current, { id: String(Date.now() + 1), role: 'assistant', content: reply, time: nowTime() }]);
    } catch {
      updateMsgs([...messagesRef.current, { id: String(Date.now() + 1), role: 'assistant', content: "Sorry, I couldn't connect. Please try again.", time: nowTime() }]);
    } finally {
      setIsLoading(false);
      isSending.current = false;
    }
  }

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.bubbleRow, msg.role === 'user' ? styles.rowUser : styles.rowTutor]}>
            {msg.role === 'assistant' && (
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{'🤖'}</Text>
              </View>
            )}
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleTutor]}>
              <Text style={[
                styles.bubbleText,
                msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextTutor,
                { fontFamily: theme.fontFamily, fontSize: theme.fontSize(14), lineHeight: theme.lineHeight(21) },
              ]}>
                {msg.content}
              </Text>
              <Text style={[styles.bubbleTime, msg.role === 'user' ? styles.timeUser : styles.timeTutor]}>
                {msg.time}
              </Text>
            </View>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.bubbleRow, styles.rowTutor]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>{'🤖'}</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleTutor, styles.bubbleTyping]}>
              <Text style={styles.typingDots}>{'.'.repeat(dotCount)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={[styles.textInput, { color: theme.textColor, fontFamily: theme.fontFamily, fontSize: theme.fontSize(14) }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about driving theory..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => { if (canSend) void sendText(input); }}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={() => void sendText(input)}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up-circle" size={36} color={canSend ? Colors.indigo : Colors.border} />
        </TouchableOpacity>
      </View>

      {/* Free tier paywall modal */}
      <Modal visible={showPaywall} transparent animationType="fade" onRequestClose={() => setShowPaywall(false)}>
        <View style={styles.paywallOverlay}>
          <View style={styles.paywallCard}>
            <Text style={styles.paywallEmoji}>{'🤖'}</Text>
            <Text style={styles.paywallTitle}>{"You've used your 5 free tutor questions"}</Text>
            <Text style={styles.paywallBody}>
              {'Upgrade to Premium for unlimited AI tutor access.'}
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => { setShowPaywall(false); router.push('/paywall'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeBtnText}>{'Upgrade Now'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={() => setShowPaywall(false)} activeOpacity={0.7}>
              <Text style={styles.dismissText}>{'Maybe Later'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  messagesContent: {
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  rowUser: { justifyContent: 'flex-end' },
  rowTutor: { justifyContent: 'flex-start' },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  avatarEmoji: { fontSize: 16 },

  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.indigo,
    borderBottomRightRadius: 4,
  },
  bubbleTutor: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  bubbleTyping: { paddingVertical: 14, minWidth: 60, alignItems: 'center' },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextTutor: { color: '#111827' },
  typingDots: { fontSize: 20, fontWeight: '800', color: Colors.indigo, letterSpacing: 2 },

  bubbleTime: { fontSize: 10, fontWeight: '500', alignSelf: 'flex-end' },
  timeUser: { color: 'rgba(255,255,255,0.6)' },
  timeTutor: { color: '#9CA3AF' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 120,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  sendBtn: { paddingBottom: 2 },
  sendBtnDisabled: { opacity: 0.4 },

  paywallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  paywallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
  },
  paywallEmoji: { fontSize: 48, marginBottom: 4 },
  paywallTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  paywallBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  upgradeBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dismissBtn: { paddingVertical: 8 },
  dismissText: { fontSize: 14, color: '#9CA3AF' },
});
