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

export default function ResetPasswordScreen() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleUpdate() {
    setError('');
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{'New Password'}</Text>
        <Text style={styles.subtitle}>{'Choose a strong password for your account'}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            placeholder="New password"
            placeholderTextColor="#374151"
            secureTextEntry
            autoComplete="new-password"
          />
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setError(''); }}
            placeholder="Confirm new password"
            placeholderTextColor="#374151"
            secureTextEntry
            autoComplete="new-password"
          />

          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.updateBtn, loading && styles.updateBtnDisabled]}
            onPress={() => void handleUpdate()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.updateBtnText}>{'Update Password'}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48 },

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
  updateBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
