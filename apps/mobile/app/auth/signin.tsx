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

export default function SignInScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSignIn() {
    setError('');
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
      } else {
        await new Promise<void>((res) => setTimeout(res, 400));
        router.replace('/(tabs)/home');
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
        <Text style={styles.logo}>{'ClearPass'}</Text>
        <Text style={styles.tagline}>{'Pass your theory test. First time.'}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoComplete="password"
          />

          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={() => void handleSignIn()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{'Sign In'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/auth/forgot-password')} activeOpacity={0.75}>
          <Text style={styles.forgotText}>{'Forgot password?'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchLink} onPress={() => router.replace('/auth/signup')} activeOpacity={0.75}>
          <Text style={styles.switchText}>{"Don't have an account? "}<Text style={styles.switchAccent}>{'Sign up'}</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48 },

  logo: { fontSize: 36, fontWeight: '900', color: '#0D9488', letterSpacing: 2, marginBottom: 6 },
  tagline: { fontSize: 14, color: '#6B7280', marginBottom: 40 },

  form: { gap: 12, marginBottom: 24 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    color: '#111827',
    fontSize: 15,
  },
  errorText: { fontSize: 13, color: '#EF4444', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  forgotLink: { alignItems: 'center', paddingVertical: 8 },
  forgotText: { fontSize: 14, color: '#0D9488', fontWeight: '600' },

  switchLink: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 14, color: '#6B7280' },
  switchAccent: { color: '#0D9488', fontWeight: '600' },
});
