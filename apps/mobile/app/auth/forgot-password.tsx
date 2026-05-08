import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  async function handleSend() {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://clearpass-app.vercel.app/auth/reset-password',
      });
      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{'Reset Password'}</Text>
        <Text style={styles.subtitle}>{"Enter your email and we'll send you a reset link"}</Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>{'[OK]'}</Text>
            <Text style={styles.successTitle}>{'Check your email'}</Text>
            <Text style={styles.successText}>{"We've sent a password reset link to "}<Text style={styles.successEmail}>{email.trim()}</Text></Text>
            <TouchableOpacity style={styles.backToSignIn} onPress={() => router.replace('/auth/signin')} activeOpacity={0.85}>
              <Text style={styles.backToSignInText}>{'Back to Sign In'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="Email"
              placeholderTextColor="#374151"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
              onPress={() => void handleSend()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendBtnText}>{'Send Reset Link'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 48 },

  backBtn: { marginBottom: 32 },
  backText: { fontSize: 15, color: '#A78BFA', fontWeight: '600' },

  title: { fontSize: 30, fontWeight: '900', color: '#F1F0FF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 32 },

  form: { gap: 12 },
  input: {
    backgroundColor: '#13131A',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    borderRadius: 12,
    padding: 14,
    color: '#F1F0FF',
    fontSize: 15,
  },
  errorText: { fontSize: 13, color: '#F87171', marginTop: 2 },
  sendBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  successBox: {
    backgroundColor: '#0D1F0D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#166534',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  successIcon: { fontSize: 18, color: '#4ADE80', fontWeight: '900' },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#F1F0FF' },
  successText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  successEmail: { color: '#A78BFA', fontWeight: '600' },
  backToSignIn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  backToSignInText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
