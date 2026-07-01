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
import { Pip } from '@/src/components/Pip';
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

const SYSTEM_PROMPT = `
You are Pip, the ClearPass assistant. ClearPass is a UK driving theory test preparation
app that uses officially licensed DVSA content.

## THEORY TUTORING
For theory test questions, Highway Code, road signs, hazard perception:
- Your ONLY source of truth is the official DVSA theory test question bank, the Highway
  Code, and official DVSA guidance documents.
- Do NOT draw on general knowledge or external sources for theory answers.
- When explaining wrong answers, always explain WHY the correct answer is right and WHY
  the wrong answer is wrong.
- If a question cannot be answered from DVSA materials, say so clearly rather than guessing.

## APP SUPPORT
For questions about ClearPass itself, answer helpfully using the following knowledge:
- Mock tests: timed, full-length, exam conditions. Practice modes include standard,
  battle mode, weak-spot drilling, and speed round.
- Road Signs: all 88 official UK road signs using DVSA-licensed imagery, organised by
  category and fully searchable.
- Hazard Perception: official DVSA clips are coming soon under the signed licence agreement.
- Platform: iOS (TestFlight + App Store), Android (submitted to Google Play), Web (clearpass-app.vercel.app).
- Known issue: 7 road signs still render as SVG diagrams awaiting official photo assets
  (school crossing patrol, elderly pedestrians, horse riders, camera ahead, risk of ice,
  risk of grounding, tunnel). A full audit corrected 25 of 33 wrong mappings in June 2026.
- Subscriptions: pricing shown in-app on the paywall screen.

If the user mentions a billing problem, a charge they don't recognise, wanting a refund,
or an account they cannot access, respond helpfully and end your reply with [ESCALATE] on
its own line — this flags it to the ClearPass team for follow-up within 24 hours.

## TONE
- Encouraging and supportive — users are learner drivers who may be anxious.
- Keep responses concise and practical.
- Use plain English — avoid jargon.
`.trim();

const WELCOME =
  "Hi! I'm Pip 🦔 Ask me anything about the Highway Code, road signs, or theory test questions — I only use official DVSA materials.";

const STARTER_PROMPTS = [
  'How does hazard perception work?',
  'When does the app launch on Android?',
  'I have a billing question',
  'Explain a wrong answer',
  'A road sign image looks wrong',
];

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
      // no-op: empty state shown in JSX when messages.length === 0
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

  const showEmpty    = messages.length === 0 && !isLoading && !params.questionText && !params.freeMessage;
  const showStarters = showEmpty;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Pip header */}
      <View style={styles.scopeBanner}>
        <Pip size={40} mood="wave" />
        <View style={styles.pipHeaderTextCol}>
          <Text style={styles.pipHeaderTitle}>{'Ask Pip'}</Text>
          <Text style={styles.pipHeaderSub}>{'DVSA content only'}</Text>
        </View>
      </View>

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
                <Pip size={28} mood="happy" />
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

        {/* Empty state — shown when no messages yet */}
        {showEmpty && (
          <View style={styles.emptyState}>
            <Pip size={80} mood="wave" />
            <Text style={styles.emptyTitle}>{"Hi! I'm Pip 👋"}</Text>
            <Text style={styles.emptySub}>{"Ask me anything about your theory test."}</Text>
          </View>
        )}

        {/* Starter prompt chips */}
        {showStarters && (
          <View style={styles.starterGrid}>
            {STARTER_PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={styles.starterChip}
                onPress={() => void sendText(prompt)}
                activeOpacity={0.75}
              >
                <Text style={styles.starterChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isLoading && (
          <View style={[styles.bubbleRow, styles.rowTutor]}>
            <View style={styles.avatar}>
              <Pip size={28} mood="happy" />
            </View>
            <View style={[styles.bubble, styles.bubbleTutor, styles.bubbleTyping]}>
              <Text style={styles.typingDots}>{'.'.repeat(dotCount)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Thinking progress bar */}
      {isLoading && (
        <View style={styles.thinkingBar}>
          <View style={styles.thinkingBarFill} />
          <Text style={styles.thinkingBarText}>{'Pip is thinking…'}</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={[styles.textInput, { color: theme.textColor, fontFamily: theme.fontFamily, fontSize: theme.fontSize(14) }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Pip anything..."
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
            <Pip size={72} mood="sympathetic" />
            <Text style={styles.paywallTitle}>{"You've used your 5 free Ask Pip questions"}</Text>
            <Text style={styles.paywallBody}>
              {'Upgrade to Pro for unlimited sessions with Pip.'}
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
  timeTutor: { color: '#6B7280' },

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

  thinkingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.indigoBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingBarFill: {
    height: 3,
    width: 36,
    borderRadius: 2,
    backgroundColor: Colors.indigo,
  },
  thinkingBarText: { fontSize: 12, color: Colors.indigo, fontWeight: '600' },

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
  dismissText: { fontSize: 14, color: '#6B7280' },

  // Pip header banner
  scopeBanner: {
    backgroundColor: Colors.indigo,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pipHeaderTextCol: { flex: 1 },
  pipHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  pipHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.mutedText, textAlign: 'center', lineHeight: 20 },

  // Starter prompts
  starterGrid: { gap: 8, marginTop: 8 },
  starterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  starterChipText: { fontSize: 14, color: Colors.indigo, fontWeight: '600' },
});
