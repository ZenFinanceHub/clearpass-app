import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const DVSA_PERMISSION_REF = '639UJ6EF';

export default function LegalScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Go back">
          <Text style={[styles.backArrow, { color: theme.textColor }]}>{'<- Back'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.brand}>
        <Text style={styles.brandName}>{'ClearPass'}</Text>
        <Text style={[styles.brandSub, { color: theme.textColor }]}>{'Legal & Licences'}</Text>
      </View>

      <Section title="DVSA Question Bank" theme={theme}>
        {'The Driver and Vehicle Standards Agency (DVSA) has given permission for the reproduction of Crown copyright material. DVSA does not accept responsibility for the accuracy of the reproduction.\n\nThis product includes the Driver and Vehicle Standards Agency (DVSA) revision question bank.\n\nPermission reference: '}{DVSA_PERMISSION_REF}
      </Section>

      <Section title="Highway Code & Traffic Signs" theme={theme}>
        {'Contains public sector information licensed under the Open Government Licence v3.0.\n\n© Crown copyright. Source: the Highway Code and Know Your Traffic Signs, Department for Transport.'}
      </Section>

      <Section title="What each licence permits" theme={theme}>
        {'The Open Government Licence above covers the Highway Code and road sign content only. It allows copying, publishing, distributing, transmitting, adapting and exploiting that information commercially or non-commercially, as long as the source is acknowledged.\n\nThe DVSA question bank is reproduced under separate written permission from DVSA, not the Open Government Licence.\n\nClearPass has made original adaptations to this material — explanations, examples and formatting written for theory test preparation. These adaptations are owned by ZenFinanceHub.'}
      </Section>

      <Section title="Licence text" theme={theme}>
        {'The full text of the Open Government Licence v3.0 is available at:'}
      </Section>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => void Linking.openURL(OGL_URL)}
        activeOpacity={0.75}
      >
        <Text style={styles.linkBtnText}>{OGL_URL}</Text>
      </TouchableOpacity>

      <Section title="Other content" theme={theme}>
        {'ClearPass’s own explanations, app design, gamification and other original written content are © ZenFinanceHub. All rights reserved. This does not extend to the DVSA question bank text or Highway Code / road sign content described above, which remain Crown copyright.'}
      </Section>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.subTextColor }]}>{'ClearPass — UK Theory Test Preparation'}</Text>
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

  linkBtn: { marginBottom: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.indigo },
  linkBtnText: { fontSize: 13, color: Colors.indigo, lineHeight: 18 },

  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12 },
});
