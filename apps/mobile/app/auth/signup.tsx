import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/supabase';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';
const REFERRAL_CODE_KEY    = 'referral_code';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();

  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (params.ref) {
      void AsyncStorage.setItem(REFERRAL_CODE_KEY, params.ref);
    }
  }, [params.ref]);

  async function handleSignUp() {
    setError('');
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!email.trim())               { setError('Please enter an email address.'); return; }
    if (password.length < 6)         { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) { setError(authError.message); return; }

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        const name = username.trim();
        const referralCode = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
        const profileData: Record<string, string> = { id: userId, username: name };
        if (referralCode) profileData.referred_by = referralCode;
        const { error: profileError } = await supabase.from('profiles').insert(profileData);
        if (profileError && profileError.code !== '23505') {
          await AsyncStorage.setItem(PENDING_USERNAME_KEY, name);
        }
      } else {
        await AsyncStorage.setItem(PENDING_USERNAME_KEY, username.trim());
      }

      await new Promise<void>((res) => setTimeout(res, 400));
      router.replace('/auth/testdate');
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
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoComplete="username"
          />
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
            placeholder="Password (6+ characters)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoComplete="new-password"
          />

          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={() => void handleSignUp()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{'Create Account'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switchLink} onPress={() => router.replace('/auth/signin')} activeOpacity={0.75}>
          <Text style={styles.switchText}>{'Already have an account? '}<Text style={styles.switchAccent}>{'Sign in'}</Text></Text>
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

  switchLink: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 14, color: '#6B7280' },
  switchAccent: { color: '#0D9488', fontWeight: '600' },
});
