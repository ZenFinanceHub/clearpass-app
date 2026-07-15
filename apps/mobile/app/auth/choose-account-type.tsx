import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { Colors } from '@/src/constants/theme';
import { generateInstructorCode, generateReferralCode } from '@/src/accountCodes';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';
const REFERRAL_CODE_KEY    = 'referral_code';

type AccountType = 'learner' | 'instructor';

async function tryInsertProfile(payload: Record<string, string>): Promise<boolean> {
  const { error } = await supabase.from('profiles').insert(payload);
  return !error || error.code === '23505';
}

export default function ChooseAccountTypeScreen() {
  const [checking, setChecking] = useState(true);
  const [saving, setSaving]     = useState<AccountType | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    void resolveReferral();
  }, []);

  async function resolveReferral() {
    const code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (code) {
      await finish('learner', code);
      return;
    }
    setChecking(false);
  }

  async function finish(accountType: AccountType, referralCode: string | null) {
    setSaving(accountType);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/signin'); return; }

      const username = (await AsyncStorage.getItem(PENDING_USERNAME_KEY))
        ?? `user${Math.floor(Math.random() * 99999)}`;

      const payload: Record<string, string> = {
        id: user.id,
        username,
        account_type: accountType,
      };
      if (referralCode) payload.referred_by = referralCode;
      if (accountType === 'instructor') {
        payload.instructor_code = generateInstructorCode();
        payload.referral_code = generateReferralCode(username);
      }

      let ok = await tryInsertProfile(payload);
      if (!ok) {
        await new Promise<void>((res) => setTimeout(res, 1000));
        ok = await tryInsertProfile(payload);
      }
      if (!ok) {
        setError('Could not set up your account. Please try again.');
        setSaving(null);
        setChecking(false);
        return;
      }

      if (referralCode) {
        try {
          const { data: refProfile } = await supabase
            .from('profiles')
            .select('id, account_type')
            .eq('referral_code', referralCode)
            .maybeSingle();
          if (refProfile && (refProfile as { account_type?: string }).account_type === 'instructor') {
            // Auto-link immediately — the referral code came from an
            // instructor's link/code, which is the pupil's explicit consent.
            await supabase.from('instructor_relationships').insert({
              instructor_id: (refProfile as { id: string }).id,
              learner_id: user.id,
              status: 'accepted',
              invite_code: referralCode,
            });
          }
        } catch {}
      }

      router.replace(accountType === 'instructor' ? '/instructor' : '/auth/testdate');
    } catch {
      setError('An unexpected error occurred.');
      setSaving(null);
      setChecking(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.indigo} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>{'ClearPass'}</Text>
      <Text style={styles.title}>{'How will you use ClearPass?'}</Text>

      {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.card, saving !== null && styles.cardDisabled]}
        onPress={() => void finish('learner', null)}
        disabled={saving !== null}
        activeOpacity={0.85}
      >
        {saving === 'learner'
          ? <ActivityIndicator color={Colors.indigo} />
          : (
              <>
                <Text style={styles.cardEmoji}>{'🎓'}</Text>
                <Text style={styles.cardTitle}>{"I'm a learner"}</Text>
                <Text style={styles.cardBody}>{'Practice questions, mock tests and hazard perception to pass first time.'}</Text>
              </>
            )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, saving !== null && styles.cardDisabled]}
        onPress={() => void finish('instructor', null)}
        disabled={saving !== null}
        activeOpacity={0.85}
      >
        {saving === 'instructor'
          ? <ActivityIndicator color={Colors.indigo} />
          : (
              <>
                <Text style={styles.cardEmoji}>{'🚗'}</Text>
                <Text style={styles.cardTitle}>{"I'm an instructor"}</Text>
                <Text style={styles.cardBody}>{"Track your pupils' progress and share your referral link."}</Text>
              </>
            )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', paddingHorizontal: 28, paddingTop: 100, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },

  logo: { fontSize: 28, fontWeight: '900', color: Colors.indigo, letterSpacing: 2, marginBottom: 4, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 16 },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginBottom: 4 },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  cardDisabled: { opacity: 0.6 },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  cardBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
});
