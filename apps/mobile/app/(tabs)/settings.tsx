import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
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
    description: 'Replaces the dark background with a warm cream tone, easier on the eyes.',
    icon: '[ bg ]',
  },
];

export default function SettingsScreen() {
  const { settings, setSetting } = useAccessibility();
  const theme = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/onboarding');
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Accessibility'}</Text>
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
              trackColor={{ false: '#1F2937', true: '#6D28D9' }}
              thumbColor={settings[item.key] ? '#A78BFA' : '#6B7280'}
              ios_backgroundColor={'#1F2937'}
            />
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {'Settings are saved automatically and restored each time you open the app.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.manageBtn} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
        <Text style={styles.manageBtnText}>{'Manage Subscription'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()} activeOpacity={0.85}>
        <Text style={styles.signOutBtnText}>{'Sign Out'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },

  sectionHeader: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  sectionSub: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

  group: {
    backgroundColor: '#111827',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#1F2937',
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
    borderBottomColor: '#1F2937',
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 10, fontWeight: '700', color: '#60A5FA' },

  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: '#F1F0FF' },
  description: { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  noteBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#374151',
  },
  noteText: { fontSize: 13, color: '#4B5563', lineHeight: 18 },

  manageBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  manageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  signOutBtn: {
    backgroundColor: '#1F0A0A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  signOutBtnText: { color: '#F87171', fontSize: 16, fontWeight: '700' },
});
