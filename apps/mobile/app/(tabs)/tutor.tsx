import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Sentry from '@sentry/react-native';
import { Pip } from '@/src/components/Pip';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getAccessToken } from '@/src/getAccessToken';
import { handleSessionExpired } from '@/src/handleSessionExpired';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

function getProxyUrl(): string {
  return __DEV__
    ? 'http://localhost:3001'
    : 'https://clearpass-app-production.up.railway.app';
}

const SYSTEM_PROMPT = `
You are Pip, the ClearPass assistant. ClearPass is a UK driving theory test preparation
app that uses DVSA-licensed content.

Do not use markdown formatting - no asterisks, no bold, no headers, no bullet points.
Write in plain conversational sentences only.

THEORY TUTORING
For theory test questions, Highway Code, road signs, hazard perception:
- Your ONLY source of truth is the DVSA theory test question bank, the Highway
  Code, and DVSA guidance documents.
- Do NOT draw on general knowledge or external sources for theory answers.
- When explaining wrong answers, always explain WHY the correct answer is right and WHY
  the wrong answer is wrong.
- If a question cannot be answered from DVSA materials, say so clearly rather than guessing.

APP SUPPORT
For questions about ClearPass itself, answer helpfully using the following knowledge:
- Mock tests: timed, full-length, exam conditions. Practice modes include standard,
  battle mode, weak-spot drilling, and speed round.
- Road Signs: all 88 UK road signs using DVSA-licensed imagery, organised by
  category and fully searchable.
- Hazard Perception: DVSA clips, licensed under the signed agreement, are now live in the app.
- Platform: iOS (TestFlight + App Store), Android (submitted to Google Play), Web (getclearpass.co.uk).
- Known issue: 7 road signs still render as SVG diagrams awaiting photo assets
  (school crossing patrol, elderly pedestrians, horse riders, camera ahead, risk of ice,
  risk of grounding, tunnel). A full audit corrected 25 of 33 wrong mappings in June 2026.
- Subscriptions: pricing shown in-app on the paywall screen.
- ClearPass is not affiliated with or endorsed by DVSA. If asked, explain that ClearPass
  reproduces DVSA material under written permission, and is not an official DVSA product.

If the user mentions a billing problem, a charge they don't recognise, wanting a refund,
or an account they cannot access, respond helpfully and end your reply with [ESCALATE] on
its own line — this flags it to the ClearPass team for follow-up within 24 hours.

TONE
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

// The server rejects any /api/explain request over 40 messages
// (proxy.js's MAX_MESSAGES) and every turn resends the full history, so
// payload size and cost grow unbounded over a long session. Window what's
// sent, but always pin the opening message — for the "explain a wrong
// answer" entry point (see useFocusEffect below) it carries the question,
// correct answer, and the user's answer that the rest of the conversation
// is grounded in, so dropping it makes later replies incoherent even
// though the recent turns are still in the window.
const MAX_API_MESSAGES = 20;

// Builds [anchor, ...tail] and defensively re-establishes strict
// user/assistant alternation rather than trusting it holds. The known way
// it can break: sendText appends the user's message to local state before
// the fetch, then returns early on a 401/429 without appending a reply
// (see the session-expired/rate-limited branches below), leaving a
// dangling unanswered user turn. Today the UI has no path back to the
// input bar after that — sessionExpired/rateLimited only ever get set,
// never cleared — so it can't currently be followed by another user
// message, but that's incidental to this function and not something it
// should assume stays true.
//
// The anchor (all[0]) is always role 'user' — it's unconditionally the
// first thing sendText ever pushes to local state. Walking forward from
// it, any message that would repeat the previously kept message's role
// replaces it instead of being appended, so a same-role collision
// resolves in favour of the more recent message instead of silently
// producing two consecutive same-role entries in the payload.
function windowMessages(all: Msg[]): Msg[] {
  const anchor = all[0];
  const rest = all.length <= MAX_API_MESSAGES ? all.slice(1) : all.slice(-(MAX_API_MESSAGES - 1));

  const out: Msg[] = [anchor];
  for (const m of rest) {
    if (m.role !== out[out.length - 1].role) {
      out.push(m);
    } else {
      out[out.length - 1] = m;
    }
  }
  return out;
}

export default function TutorScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
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
  const [dotCount, setDotCount] = useState(1);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [rateLimited, setRateLimited] = useState<{ isPro: boolean } | null>(null);

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

  // Android only — bypasses KeyboardAvoidingView's internal overlap math
  // entirely (which depends on the keyboard's screenY, unreliable under
  // edgeToEdgeEnabled) by reading the IME inset height directly off the
  // keyboard event and applying it as padding ourselves. See the
  // KeyboardAvoidingView comment below for why iOS doesn't need this.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

    isSending.current = true;
    const userMsg: Msg = { id: String(Date.now()), role: 'user', content: trimmed, time: nowTime() };
    const next = [...messagesRef.current, userMsg];
    updateMsgs(next);
    setInput('');
    setIsLoading(true);

    const apiMessages = windowMessages(next).map((m) => ({ role: m.role, content: m.content }));

    const url = `${getProxyUrl()}/api/explain`;
    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    };
    // Server doesn't require this yet (step 1 of rolling out auth on
    // /api/explain) — sent now so step 2 (making it mandatory) doesn't
    // need a client change too. Omitted rather than sent as "Bearer null"
    // if there's no session for some reason.
    const accessToken = await getAccessToken();

    // Hoisted out of the try block so the catch below can still report
    // whatever was actually captured before the failure — e.g. fetch()
    // itself throwing leaves both undefined, but a bad status or an
    // unparseable body still leaves res/rawText populated for diagnosis.
    let res: Response | undefined;
    let rawText: string | undefined;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      // Distinct from the generic failure path below — an expired session
      // isn't a bug worth a Sentry capture or a fake assistant reply, it
      // needs its own UI (see the sessionExpired-gated render below).
      if (res.status === 401) {
        console.log('[Ask Pip] session expired (401)');
        setSessionExpired(true);
        return;
      }

      // Same treatment as 401 above — a quota hit isn't a bug, it needs
      // its own UI (see the rateLimited-gated render below).
      if (res.status === 429) {
        const quotaBody = await res.json().catch(() => null) as { isPro?: boolean } | null;
        console.log('[Ask Pip] rate limited (429)', quotaBody);
        setRateLimited({ isPro: quotaBody?.isPro === true });
        return;
      }

      rawText = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = JSON.parse(rawText) as { content: Array<{ type: string; text: string }> };
      const reply = data.content[0]?.text?.trim() ?? "Sorry, I couldn't connect. Please try again.";
      updateMsgs([...messagesRef.current, { id: String(Date.now() + 1), role: 'assistant', content: reply, time: nowTime() }]);
    } catch (err) {
      // The catch-all above was silent — nothing here to diagnose a real
      // failure with. Same user-facing string, but now the actual error,
      // HTTP status, and raw body are captured before it's discarded.
      const status = res?.status;
      console.error('[Ask Pip] request failed', { status, rawText, error: err });
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        extra: { status, rawText },
      });
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
      style={[
        styles.flex,
        { backgroundColor: theme.backgroundColor },
        // Android only. The tab bar is still rendered under this screen
        // (hidden: true in _layout.tsx only removes its button, not the
        // bar itself) and doesn't shrink away on its own on this device —
        // manual compensation needs to be the keyboard's real height minus
        // however much of that region the tab bar already occupies, not
        // the full keyboard height (which overshoots by tabBarHeight).
        Platform.OS === 'android' && { paddingBottom: Math.max(0, androidKeyboardHeight - tabBarHeight) },
      ]}
      // iOS: no native equivalent of adjustResize, so KeyboardAvoidingView
      // does the whole job — offset by the real, live tab bar height
      // (useBottomTabBarHeight) instead of a hand-guessed constant.
      // Android: behavior is back to undefined — KeyboardAvoidingView's own
      // overlap math depends on the keyboard's screenY, which falls back to
      // the (edge-to-edge-unreliable) getWindowVisibleDisplayFrame() for
      // the adjustResize case this app is in. The androidKeyboardHeight
      // state above bypasses that entirely, reading endCoordinates.height
      // from the raw keyboard event instead — a separate computation
      // (WindowInsets.Type.ime(), edge-to-edge-aware) that doesn't touch
      // screenY at all — and applies it as paddingBottom directly.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
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
                <Pip size={28} mood="teaching" />
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
              <Pip size={28} mood="teaching" />
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

      {/* Input bar — replaced by a sign-in prompt on an expired session, or
          a quota message on a 429. The conversation above stays exactly as
          it was in both cases; nothing is cleared or navigated away from
          until the user acts on the banner. */}
      {sessionExpired ? (
        <View style={styles.sessionExpiredBar}>
          <Text style={styles.sessionExpiredText}>
            {'Your session has expired. Sign in again to keep chatting with Pip.'}
          </Text>
          <TouchableOpacity
            style={styles.sessionExpiredBtn}
            onPress={() => void handleSessionExpired()}
            activeOpacity={0.85}
          >
            <Text style={styles.sessionExpiredBtnText}>{'Sign In'}</Text>
          </TouchableOpacity>
        </View>
      ) : rateLimited ? (
        <View style={styles.sessionExpiredBar}>
          <Text style={styles.sessionExpiredText}>
            {rateLimited.isPro
              ? "You've reached today's limit for Ask Pip. It resets tomorrow."
              : "You've used all 10 free questions with Ask Pip. Upgrade to Pro to keep chatting with Pip."}
          </Text>
          {!rateLimited.isPro && (
            <TouchableOpacity
              style={styles.sessionExpiredBtn}
              onPress={() => router.push('/paywall')}
              activeOpacity={0.85}
            >
              <Text style={styles.sessionExpiredBtnText}>{'Upgrade'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
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
      )}
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

  // Reused by both the session-expired and rate-limited banners — same
  // compact bottom-bar shape for an inline message with an optional CTA,
  // replacing the input bar in place.
  sessionExpiredBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: 12,
  },
  sessionExpiredText: { flex: 1, fontSize: 13, color: Colors.mutedText, lineHeight: 18 },
  sessionExpiredBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sessionExpiredBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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
