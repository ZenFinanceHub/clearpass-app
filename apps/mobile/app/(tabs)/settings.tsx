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
    description: 'Replaces the light background with a warm cream tone, easier on the eyes.',
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
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },

  sectionHeader: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sectionSub: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

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

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 10, fontWeight: '700', color: '#6366F1' },

  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: '#111827' },
  description: { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  noteBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0D9488',
  },
  noteText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

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
});
