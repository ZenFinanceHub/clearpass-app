import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const LAST_UPDATED = '4 June 2026';

export default function PrivacyPolicyScreen() {
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
        <Text style={[styles.brandSub, { color: theme.subTextColor }]}>{'Privacy Policy'}</Text>
        <Text style={[styles.updated, { color: theme.subTextColor }]}>{'Last updated: '}{LAST_UPDATED}</Text>
      </View>

      <Section title="Who we are" theme={theme}>
        {'ClearPass is a UK driving theory test preparation app operated by ZenFinanceHub. Our registered contact email is privacy@clearpass.app.'}
      </Section>

      <Section title="Information we collect" theme={theme}>
        {'We collect the following information when you use ClearPass:'}
        {'\n\n'}
        {'- Email address (when you create an account via Supabase Auth)\n'}
        {'- Display name (if you choose to set one)\n'}
        {'- Practice and test progress data: questions answered, scores, streaks, topic performance\n'}
        {'- Mock test results and timestamps\n'}
        {'- Device type and platform (iOS, Android or Web) for analytics\n'}
        {'- Anonymous usage statistics (question accuracy aggregated across all users)\n'}
        {'- Payment status (whether your account is Pro) -- we do not store card details'}
      </Section>

      <Section title="How we use your information" theme={theme}>
        {'- To provide and improve the ClearPass service\n'}
        {'- To calculate and display your pass probability and progress\n'}
        {'- To generate AI tutor explanations (questions are sent to Anthropic for processing -- no conversation history is retained by ClearPass)\n'}
        {'- To process payments via Stripe (we receive only a confirmation of payment, not card data)\n'}
        {'- To send weekly progress emails to a parent or guardian, if you have opted in\n'}
        {'- To produce anonymous aggregate statistics showing platform-wide accuracy by topic'}
      </Section>

      <Section title="Legal basis for processing (GDPR)" theme={theme}>
        {'We process your data under the following legal bases:\n\n'}
        {'- Contract: to provide the service you have signed up for\n'}
        {'- Legitimate interest: to improve app quality and identify popular features\n'}
        {'- Consent: for marketing communications and parent progress emails (you can withdraw at any time)'}
      </Section>

      <Section title="Data storage" theme={theme}>
        {'Your account and progress data is stored in Supabase, which uses AWS infrastructure based in the EU. Locally cached data is stored on your device using AsyncStorage.'}
        {'\n\n'}
        {'Stripe handles all payment data on their PCI-DSS compliant servers. ClearPass never receives or stores your card number, CVV or billing address.'}
      </Section>

      <Section title="Anthropic AI Tutor" theme={theme}>
        {'When you request an AI explanation, the question text and answer options are sent to Anthropic\'s API to generate a response. ClearPass does not store these requests. Anthropic\'s own privacy policy governs how they handle API data. No personal account information is sent to Anthropic.'}
      </Section>

      <Section title="Analytics" theme={theme}>
        {'We collect anonymous aggregate accuracy statistics per topic (e.g., "70% of users answered Hazard Awareness questions correctly"). These statistics cannot be linked back to any individual user and are used solely to show comparative performance within the app.'}
      </Section>

      <Section title="Data sharing" theme={theme}>
        {'We do not sell, trade or rent your personal information to third parties. We share data only with:\n\n'}
        {'- Supabase (database and authentication provider)\n'}
        {'- Stripe (payment processing)\n'}
        {'- Anthropic (AI tutor explanations, question text only)\n'}
        {'- Resend (email delivery for parent notifications)\n\n'}
        {'All third-party providers are bound by their own privacy policies and data processing agreements.'}
      </Section>

      <Section title="Instructor and parent access" theme={theme}>
        {'If you link your account to a driving instructor, they can view your progress data (readiness score, topic performance, mock test history). You can unlink instructors at any time from Settings.\n\n'}
        {'If you add a parent email, they will receive weekly summary emails. You can remove the parent email at any time from Settings > Parent Updates.'}
      </Section>

      <Section title="Your rights" theme={theme}>
        {'Under UK GDPR you have the right to:\n\n'}
        {'- Access the data we hold about you\n'}
        {'- Request correction of inaccurate data\n'}
        {'- Request deletion of your data\n'}
        {'- Object to processing\n'}
        {'- Data portability\n\n'}
        {'To exercise these rights, email privacy@clearpass.app. Deleting your account from Settings removes all your personal data from our servers within 30 days.'}
      </Section>

      <Section title="Data retention" theme={theme}>
        {'We retain your data for as long as your account is active. If you delete your account, all associated progress data, profile information and parent subscriptions are permanently deleted.'}
      </Section>

      <Section title="Children" theme={theme}>
        {'ClearPass is intended for users aged 13 and over. Users under 16 should have parental consent before creating an account. If you believe a child under 13 has created an account, please contact privacy@clearpass.app.'}
      </Section>

      <Section title="Cookies and tracking" theme={theme}>
        {'The ClearPass mobile app does not use cookies. The web version uses only essential session cookies required for authentication. We do not use tracking cookies or third-party advertising networks.'}
      </Section>

      <Section title="Changes to this policy" theme={theme}>
        {'We may update this privacy policy from time to time. Significant changes will be notified within the app. The date at the top of this page shows when it was last updated.'}
      </Section>

      <Section title="Contact" theme={theme}>
        {'For any privacy-related questions or requests, contact us at privacy@clearpass.app.'}
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
  brandSub:  { fontSize: 20, fontWeight: '700', color: '#111827' },
  updated:   { fontSize: 13, marginTop: 4 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8, color: '#111827' },
  sectionBody:  { fontSize: 14, lineHeight: 22, color: '#374151' },

  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12 },
});
