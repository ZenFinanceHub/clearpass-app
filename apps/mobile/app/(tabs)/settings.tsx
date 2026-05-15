import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/supabase';
import { useAccessibility } from '@/src/AccessibilityContext';
import type { AccessibilitySettings } from '@/src/AccessibilityContext';
import { useTheme } from '@/src/theme';

type SettingKey = keyof AccessibilitySettings;

interface SettingConfig {
  key: SettingKey;
  label: string;
  description: string;
  icon: string;
}

const SETTINGS: SettingConfig[] = [
  {
    key: 'dyslexiaFont',
    label: 'Dyslexia-Friendly Font',
    description: 'Switches to OpenDyslexic font throughout the app to improve readability.',
    icon: '[ Aa ]',
  },
  {
    key: 'largeText',
    label: 'Large Text',
    description: 'Increases the base font size by 20% across all screens.',
    icon: '[ T+ ]',
  },
  {
    key: 'highContrast',
    label: 'High Contrast',
    description: 'Switches to a high contrast colour scheme for improved visibility.',
    icon: '[ HC ]',
  },
  {
    key: 'textToSpeech',
    label: 'Text to Speech',
    description: 'Reads questions aloud automatically when you start a practice session.',
    icon: '[ >> ]',
  },
  {
    key: 'wordSpacing',
    label: 'Increased Spacing',
    description: 'Adds extra letter and word spacing to make text easier to read.',
    icon: '[ sp ]',
  },
  {
    key: 'creamBackground',
    label: 'Cream Background',
    description: 'Replaces the light background with a warm cream tone, easier on the eyes.',
    icon: '[ bg ]',
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsScreen() {
  const { settings, setSetting } = useAccessibility();
  const theme = useTheme();

  const [username, setUsername]           = useState<string | null>(null);
  const [email, setEmail]                 = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName]           = useState('');
  const [saving, setSaving]               = useState(false);
  const [successMsg, setSuccessMsg]       = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (profile?.username) {
          setUsername(profile.username as string);
          return;
        }
      }
      const pending = await AsyncStorage.getItem('@clearpass/pending_username');
      if (pending) setUsername(pending);
    })();
  }, []);

  async function handleSaveProfile() {
    const trimmed = editName.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
      }
      await AsyncStorage.setItem('@clearpass/pending_username', trimmed);
      setUsername(trimmed);
      setSuccessMsg('Profile updated!');
      setTimeout(() => {
        setSuccessMsg('');
        setShowEditModal(false);
        setSaving(false);
      }, 1200);
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Could not update profile. Please try again.');
    }
  }

  async function handleChangePassword() {
    if (!email) {
      Alert.alert('No email', 'No email address found for your account.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Email sent', `Password reset instructions sent to ${email}`);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await supabase.auth.signOut();
              Alert.alert(
                'Account deletion requested',
                'Please contact support@clearpass.app to complete account deletion.',
                [{ text: 'OK', onPress: () => router.replace('/onboarding') }],
              );
            })();
          },
        },
      ],
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/onboarding');
  }

  const displayInitials = username ? getInitials(username) : '?';

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {/* ── Profile Section ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Profile'}
      </Text>

      <View style={[styles.profileCard, { backgroundColor: theme.cardColor }]}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayInitials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { fontSize: theme.fontSize(16), color: theme.textColor }]} numberOfLines={1}>
              {username ?? 'User'}
            </Text>
            {email ? (
              <Text style={[styles.profileEmail, { fontSize: theme.fontSize(13), color: theme.subTextColor }]} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => {
              setEditName(username ?? '');
              setSuccessMsg('');
              setShowEditModal(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.editProfileBtnText}>{'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Accessibility Section ────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Accessibility'}
      </Text>
      <Text style={[styles.sectionSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
        {'Customise the app to suit your reading and learning needs.'}
      </Text>

      <View style={styles.group}>
        {SETTINGS.map((item, index) => (
          <View
            key={item.key}
            style={[styles.row, index < SETTINGS.length - 1 && styles.rowBorder]}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{item.label}</Text>
              <Text style={[styles.description, { fontSize: theme.fontSize(12), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(17), color: theme.subTextColor }]}>{item.description}</Text>
            </View>
            <Switch
              value={settings[item.key]}
              onValueChange={(val) => setSetting(item.key, val)}
              trackColor={{ false: '#E5E7EB', true: '#0D9488' }}
              thumbColor={settings[item.key] ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={'#E5E7EB'}
            />
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {'Settings are saved automatically and restored each time you open the app.'}
        </Text>
      </View>

      {/* ── Account Section ──────────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Account'}
      </Text>

      <View style={styles.group}>
        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => void handleChangePassword()}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Change Password'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleDeleteAccount}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: '#EF4444' }]}>{'Delete Account'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Bottom Actions ───────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.manageBtn} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
        <Text style={styles.manageBtnText}>{'Manage Subscription'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()} activeOpacity={0.85}>
        <Text style={styles.signOutBtnText}>{'Sign Out'}</Text>
      </TouchableOpacity>

      {/* ── Edit Profile Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!saving) setShowEditModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { fontSize: theme.fontSize(20), color: theme.textColor }]}>
              {'Edit Profile'}
            </Text>

            <Text style={[styles.modalFieldLabel, { color: theme.subTextColor }]}>{'Display Name'}</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.textColor, borderColor: editName.trim().length > 0 ? '#0D9488' : '#E5E7EB' }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your display name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              editable={!saving}
            />

            {successMsg.length > 0 && (
              <View style={styles.successRow}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]}
              onPress={() => void handleSaveProfile()}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.modalSaveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { if (!saving) setShowEditModal(false); }}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.modalCancelBtnText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 20, paddingBottom: 40, gap: 16 },

  sectionHeader: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sectionSub:    { fontSize: 14, color: '#6B7280', lineHeight: 20, marginTop: -8 },

  // ── Profile Card ─────────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1, gap: 3 },
  profileName:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#6B7280' },
  editProfileBtn: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },

  // ── Settings Group ────────────────────────────────────────────────────────────
  group: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '400', lineHeight: 26 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText:    { fontSize: 10, fontWeight: '700', color: '#6366F1' },
  textWrap:    { flex: 1, gap: 2 },
  label:       { fontSize: 15, fontWeight: '600', color: '#111827' },
  description: { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── Note Box ──────────────────────────────────────────────────────────────────
  noteBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0D9488',
    marginTop: -8,
  },
  noteText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // ── Bottom Buttons ────────────────────────────────────────────────────────────
  manageBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  manageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  signOutBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  signOutBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },

  // ── Edit Profile Modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: -4 },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 16,
    fontWeight: '600',
    padding: 14,
    color: '#111827',
  },
  successRow: {
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#0D9488',
    marginBottom: -4,
  },
  successText: { fontSize: 14, fontWeight: '700', color: '#0D9488', textAlign: 'center' },
  modalSaveBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: { opacity: 0.6 },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancelBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});
