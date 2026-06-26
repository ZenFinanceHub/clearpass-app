import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useSupportChatNative } from './hooks/useSupportChatNative';
import { useSupportDismissed } from './hooks/useSupportDismissed';

const BLUE  = '#2E6DA4';
const LIGHT = '#EEF4FB';
const WHITE = '#ffffff';

const QUICK_QUESTIONS = [
  'When does the app launch on Android?',
  'How does hazard perception work?',
  'A road sign image looks wrong',
  'I have a billing question',
];

interface Props {
  /**
   * standalone = true (default): renders the persistent floating button + modal.
   * standalone = false: renders only the modal (used from Settings to avoid a
   * duplicate floating button alongside the global instance in _layout.tsx).
   */
  standalone?: boolean;
  /** When true the modal opens immediately on mount — used from Settings. */
  initialOpen?: boolean;
}

export function ClearPassSupportNative({ standalone = true, initialOpen = false }: Props) {
  const { messages, isLoading, sendMessage, clearChat } = useSupportChatNative();
  const { isDismissed, dismiss }                         = useSupportDismissed();

  const [isOpen,  setIsOpen]  = useState(initialOpen);
  const [input,   setInput]   = useState('');
  const scrollRef             = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage(text);
    setInput('');
  }, [input, isLoading, sendMessage]);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    void dismiss();
  }, [dismiss]);

  // Standalone mode: don't render while loading dismissed state or if dismissed
  if (standalone && (isDismissed === null || isDismissed)) return null;

  return (
    <>
      {/* Floating button — only in standalone mode */}
      {standalone && (
        <TouchableOpacity
          onPress={() => setIsOpen(true)}
          style={styles.floatingButton}
          accessibilityLabel="Open support chat"
          accessibilityRole="button"
        >
          <Text style={styles.floatingButtonIcon}>{'💬'}</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{'🚗 ClearPass Support'}</Text>
                <Text style={styles.headerSubtitle}>{'AI-powered · Escalates to team when needed'}</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={clearChat}
                  style={styles.headerBtn}
                  accessibilityLabel="Clear conversation"
                >
                  <Text style={styles.headerBtnText}>{'Clear'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  style={styles.headerBtn}
                  accessibilityLabel="Close support chat"
                >
                  <Text style={styles.headerBtnText}>{'✕'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && (
                <View style={styles.welcomeCard}>
                  <Text style={styles.welcomeTitle}>{'👋 Hi! How can I help?'}</Text>
                  <Text style={styles.welcomeBody}>
                    {'Ask me anything about ClearPass — tests, road signs, your account, or the app.'}
                  </Text>
                  <View style={styles.quickQuestions}>
                    {QUICK_QUESTIONS.map(q => (
                      <TouchableOpacity
                        key={q}
                        onPress={() => void sendMessage(q)}
                        style={styles.quickBtn}
                        accessibilityRole="button"
                      >
                        <Text style={styles.quickBtnText}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {standalone && (
                    <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn}>
                      <Text style={styles.dismissText}>{"Don't show this button again"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {messages.map(m => (
                <View
                  key={m.id}
                  style={[
                    styles.bubble,
                    m.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
                  ]}
                >
                  {m.content ? (
                    <Text style={[
                      styles.bubbleText,
                      m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot,
                    ]}>
                      {m.content}
                    </Text>
                  ) : (
                    m.role === 'assistant' && isLoading && (
                      <ActivityIndicator size="small" color={BLUE} />
                    )
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Input row */}
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask a question..."
                placeholderTextColor="#999"
                style={styles.input}
                editable={!isLoading}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline={false}
                accessibilityLabel="Support message input"
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={isLoading || !input.trim()}
                style={[
                  styles.sendBtn,
                  (isLoading || !input.trim()) && styles.sendBtnDisabled,
                ]}
                accessibilityLabel="Send message"
                accessibilityRole="button"
              >
                <Text style={styles.sendBtnText}>{'↑'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex:     { flex: 1 },
  safeArea: { flex: 1, backgroundColor: WHITE },

  floatingButton: {
    position:        'absolute',
    bottom:          32,
    right:           20,
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: BLUE,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    8,
    elevation:       8,
    zIndex:          999,
  },
  floatingButtonIcon: { fontSize: 22 },

  header: {
    backgroundColor:   BLUE,
    paddingHorizontal: 16,
    paddingVertical:   14,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  headerTitle:    { color: WHITE, fontSize: 15, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  headerActions:  { flexDirection: 'row', gap: 4 },
  headerBtn:      { padding: 6, borderRadius: 6 },
  headerBtnText:  { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  messages:        { flex: 1 },
  messagesContent: { padding: 14, gap: 10, paddingBottom: 8 },

  welcomeCard: {
    backgroundColor: LIGHT,
    borderRadius:    12,
    padding:         14,
    marginBottom:    4,
  },
  welcomeTitle:   { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  welcomeBody:    { fontSize: 13, color: '#555', lineHeight: 19 },
  quickQuestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  quickBtn: {
    backgroundColor:   WHITE,
    borderWidth:       1,
    borderColor:       '#5B9BD5',
    borderRadius:      16,
    paddingHorizontal: 11,
    paddingVertical:   5,
  },
  quickBtnText: { color: BLUE, fontSize: 12, fontWeight: '500' },
  dismissBtn:   { marginTop: 14, alignSelf: 'center' },
  dismissText:  { color: '#999', fontSize: 12, textDecorationLine: 'underline' },

  bubble: {
    maxWidth:          '82%',
    borderRadius:      16,
    padding:           10,
    paddingHorizontal: 14,
    marginBottom:      2,
  },
  bubbleUser: {
    alignSelf:               'flex-end',
    backgroundColor:         BLUE,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    alignSelf:              'flex-start',
    backgroundColor:        LIGHT,
    borderBottomLeftRadius: 4,
  },
  bubbleText:     { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: WHITE },
  bubbleTextBot:  { color: '#1a1a1a' },

  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    padding:           10,
    paddingHorizontal: 12,
    borderTopWidth:    1,
    borderTopColor:    '#ececec',
    backgroundColor:   '#fafafa',
  },
  input: {
    flex:              1,
    backgroundColor:   WHITE,
    borderWidth:       1,
    borderColor:       '#ddd',
    borderRadius:      22,
    paddingHorizontal: 14,
    paddingVertical:   9,
    fontSize:          14,
    color:             '#222',
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: BLUE,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText:     { color: WHITE, fontSize: 18, fontWeight: '600' },
});
