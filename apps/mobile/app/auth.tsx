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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';

type Tab = 'signin' | 'signup';

export default function AuthScreen() {
  const [tab, setTab] = useState<Tab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  const [suUsername, setSuUsername] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
  }

  async function handleSignIn() {
    setError('');
    if (!siEmail.trim() || !siPassword) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: siEmail.trim(),
        password: siPassword,
      });
      if (authError) {
        setError(authError.message);
      } else {
        router.replace('/(tabs)/home');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function tryInsertProfile(userId: string, username: string): Promise<boolean> {
    const { error } = await supabase.from('profiles').insert({ id: userId, username });
    return !error || error.code === '23505';
  }

  async function handleSignUp() {
    setError('');
    if (suUsername.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!suEmail.trim()) {
      setError('Please enter an email address.');
      return;
    }
    if (suPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (suPassword !== suConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPassword,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      // Wait for session to be confirmed before inserting profile
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        const username = suUsername.trim();
        let ok = await tryInsertProfile(userId, username);
        if (!ok) {
          await new Promise<void>((res) => setTimeout(res, 1000));
          ok = await tryInsertProfile(userId, username);
        }
        if (!ok) {
          // Non-critical: save locally and sync on next app load
          await AsyncStorage.setItem(PENDING_USERNAME_KEY, username);
        }
      }

      // Always navigate — a missing username is not critical
      router.replace('/(tabs)/home');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>ClearPass</Text>
        <Text style={styles.tagline}>Pass your theory test. First time.</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signin')} activeOpacity={0.75}>
            <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>Sign In</Text>
            {tab === 'signin' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signup')} activeOpacity={0.75}>
            <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Sign Up</Text>
            {tab === 'signup' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        {tab === 'signin' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={siEmail}
              onChangeText={setSiEmail}
              placeholder="Email"
              placeholderTextColor="#374151"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              value={siPassword}
              onChangeText={setSiPassword}
              placeholder="Password"
              placeholderTextColor="#374151"
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
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={suUsername}
              onChangeText={setSuUsername}
              placeholder="Username"
              placeholderTextColor="#374151"
              autoCapitalize="none"
              autoComplete="username"
            />
            <TextInput
              style={styles.input}
              value={suEmail}
              onChangeText={setSuEmail}
              placeholder="Email"
              placeholderTextColor="#374151"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              value={suPassword}
              onChangeText={setSuPassword}
              placeholder="Password"
              placeholderTextColor="#374151"
              secureTextEntry
              autoComplete="new-password"
            />
            <TextInput
              style={styles.input}
              value={suConfirm}
              onChangeText={setSuConfirm}
              placeholder="Confirm Password"
              placeholderTextColor="#374151"
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
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 48,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F1F0FF',
    letterSpacing: 2,
    marginBottom: 6,
  },
  tagline: { fontSize: 14, color: '#6B7280', marginBottom: 40 },

  tabRow: { flexDirection: 'row', gap: 28, marginBottom: 32 },
  tabBtn: { paddingBottom: 8 },
  tabText: { fontSize: 17, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#A78BFA' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#A78BFA',
    borderRadius: 1,
  },

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
  submitBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
