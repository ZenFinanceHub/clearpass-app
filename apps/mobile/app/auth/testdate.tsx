import React, { useState } from 'react';
import {
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
import { loadUserProgress, saveUserProgress } from '@/src/storage';

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year  = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

async function saveTestDate(isoDate: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').upsert({ id: user.id, test_date: isoDate });
  }
  const progress = await loadUserProgress();
  if (progress) {
    await saveUserProgress({ ...progress, testDate: isoDate });
  }
}

export default function TestDateScreen() {
  const [dateInput, setDateInput] = useState('');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    const parsed = parseDdMmYyyy(dateInput.trim());
    if (!parsed) { setError('Enter a valid date in DD/MM/YYYY format'); return; }
    setSaving(true);
    try {
      await saveTestDate(parsed);
      router.replace('/(tabs)/home');
    } catch {
      setError('Could not save date. Continuing anyway...');
      setTimeout(() => router.replace('/(tabs)/home'), 1200);
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    router.replace('/(tabs)/home');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>{'📅'}</Text>
        <Text style={styles.title}>{'When is your theory test?'}</Text>
        <Text style={styles.subtitle}>{"We'll help you prepare in time"}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={dateInput}
            onChangeText={(t) => { setDateInput(t); setError(''); }}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#374151"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{'Save & Start Learning'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipLink} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{"I don't have a date yet"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 48,
    alignItems: 'center',
  },

  emoji: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#F1F0FF', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 40 },

  form: { width: '100%', gap: 12, marginBottom: 20 },
  input: {
    backgroundColor: '#13131A',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    borderRadius: 12,
    padding: 14,
    color: '#F1F0FF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  skipLink: { paddingVertical: 12 },
  skipText: { fontSize: 14, color: '#4B5563', textDecorationLine: 'underline' },
});
