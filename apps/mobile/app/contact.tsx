import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const SUPPORT_EMAIL = 'privacy@clearpass.app';

export default function ContactScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Go back">
          <Text style={[styles.backArrow, { color: theme.textColor }]}>{'<- Back'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.brand}>
        <Text style={styles.brandName}>{'ClearPass'}</Text>
        <Text style={[styles.brandSub, { color: theme.textColor }]}>{'Contact & Support'}</Text>
      </View>

      <Section title="Get in touch" theme={theme}>
        {'Questions, feedback, bug reports or account issues -- we read every message and reply as quickly as we can.'}
      </Section>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => void Linking.openURL('mailto:' + SUPPORT_EMAIL)}
        activeOpacity={0.75}
      >
        <Text style={styles.linkBtnText}>{SUPPORT_EMAIL}</Text>
      </TouchableOpacity>

      <Section title="Common requests" theme={theme}>
        {'- Account or billing issues: include the email address on your account\n'}
        {'- Bug reports: let us know what device and app version you’re using, and the steps to reproduce\n'}
        {'- Data access or deletion requests: see our Privacy Policy for details on your rights'}
      </Section>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.subTextColor }]}>{'ClearPass -- UK Theory Test Preparation'}</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textColor }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: theme.subTextColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },

  headerRow: { marginBottom: 16 },
  backBtn: { paddingVertical: 4 },
  backArrow: { fontSize: 15, fontWeight: '600' },

  brand: { alignItems: 'center', marginBottom: 28, gap: 4 },
  brandName: { fontSize: 28, fontWeight: '900', color: Colors.indigo },
  brandSub:  { fontSize: 20, fontWeight: '700' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  sectionBody:  { fontSize: 14, lineHeight: 22 },

  linkBtn: { marginBottom: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.indigo, alignSelf: 'flex-start' },
  linkBtnText: { fontSize: 14, fontWeight: '700', color: Colors.indigo },

  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12 },
});
