import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';

const LAST_UPDATED = '4 June 2026';

export default function TermsScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: theme.textColor }]}>{'<- Back'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.brand}>
        <Text style={styles.brandName}>{'ClearPass'}</Text>
        <Text style={[styles.brandSub, { color: theme.textColor }]}>{'Terms of Service'}</Text>
        <Text style={[styles.updated, { color: theme.subTextColor }]}>{'Last updated: '}{LAST_UPDATED}</Text>
      </View>

      <Section title="1. Acceptance of terms" theme={theme}>
        {'By downloading, installing or using ClearPass, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.'}
      </Section>

      <Section title="2. Eligibility" theme={theme}>
        {'You must be at least 13 years old to use ClearPass. If you are under 16, you must have the consent of a parent or legal guardian. By creating an account, you confirm that you meet these requirements.'}
      </Section>

      <Section title="3. Accounts" theme={theme}>
        {'You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorised use at privacy@clearpass.app.\n\n'}
        {'We reserve the right to terminate or suspend accounts that violate these terms.'}
      </Section>

      <Section title="4. Subscription and payment" theme={theme}>
        {'ClearPass offers a one-off Premium access purchase of GBP 7.99 for three months of full access. This is a one-time payment, not a recurring subscription.\n\n'}
        {'All payments are processed securely by Stripe. ClearPass does not store your card details.\n\n'}
        {'Premium access includes: unlimited practice questions, full timed mock tests, AI tutor explanations, progress tracking, and all future features released during your access period.\n\n'}
        {'Refunds: if you experience a technical issue that prevents you from using the premium features, contact privacy@clearpass.app within 14 days of purchase.'}
      </Section>

      <Section title="5. Free tier limitations" theme={theme}>
        {'Free users may access up to 10 practice questions per day. Mock tests, AI tutor, and certain features require a Premium account. We reserve the right to adjust free tier limits at any time with reasonable notice.'}
      </Section>

      <Section title="6. Acceptable use" theme={theme}>
        {'You agree not to:\n\n'}
        {'- Use ClearPass for any unlawful purpose\n'}
        {'- Attempt to reverse engineer, decompile or copy the app or its content\n'}
        {'- Circumvent any paywall or access control mechanisms\n'}
        {'- Share your account credentials with others\n'}
        {'- Use automated tools to scrape questions or content\n'}
        {'- Post offensive or inappropriate content in any user-facing features'}
      </Section>

      <Section title="7. No guarantee of test outcome" theme={theme}>
        {'ClearPass is a preparation tool and does not guarantee that you will pass the DVSA theory test. Pass probability scores are estimates based on your practice performance and are not a prediction of your actual test result.\n\n'}
        {'The DVSA theory test is administered by third parties and is not affiliated with ClearPass.'}
      </Section>

      <Section title="8. Content and intellectual property" theme={theme}>
        {'All questions, explanations, road sign illustrations, design elements and other content in ClearPass are owned by or licensed to ZenFinanceHub. You may not reproduce, distribute or create derivative works from this content without our written permission.\n\n'}
        {'Highway Code content is Crown copyright and is reproduced under the Open Government Licence.'}
      </Section>

      <Section title="9. Third-party services" theme={theme}>
        {'ClearPass integrates with third-party services including Supabase (database), Stripe (payments) and Anthropic (AI tutor). Your use of these services is also governed by their respective terms of service.'}
      </Section>

      <Section title="10. Instructor and parent features" theme={theme}>
        {'If you use the instructor dashboard, you agree to use learner progress data only for legitimate coaching purposes and not to share it with unauthorised third parties.\n\n'}
        {'Parent progress emails require the learner to add a parent email address and the parent to confirm. Both parties consent to this data sharing.'}
      </Section>

      <Section title="11. Disclaimers and limitation of liability" theme={theme}>
        {'ClearPass is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the service will be uninterrupted, error-free or free from viruses.\n\n'}
        {'To the fullest extent permitted by law, ZenFinanceHub shall not be liable for any indirect, incidental, special or consequential damages arising from your use of ClearPass.'}
      </Section>

      <Section title="12. Changes to the service" theme={theme}>
        {'We may modify, suspend or discontinue ClearPass at any time. We will provide reasonable notice of significant changes via the app or email.'}
      </Section>

      <Section title="13. Termination" theme={theme}>
        {'We may terminate or suspend your access immediately, without prior notice or liability, for any breach of these terms. Upon termination, your right to use ClearPass ceases immediately.'}
      </Section>

      <Section title="14. Governing law" theme={theme}>
        {'These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.'}
      </Section>

      <Section title="15. Contact" theme={theme}>
        {'For questions about these terms, contact us at privacy@clearpass.app.'}
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
  brandName: { fontSize: 28, fontWeight: '900', color: '#0D9488' },
  brandSub:  { fontSize: 20, fontWeight: '700', color: '#111827' },
  updated:   { fontSize: 13, marginTop: 4 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  sectionBody:  { fontSize: 14, lineHeight: 22 },

  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12 },
});
