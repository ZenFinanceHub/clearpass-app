import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const LICENCE_REF = '639UJ6EF';

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

      <Section title="Open Government Licence" theme={theme}>
        {'ClearPass uses content derived from Crown copyright material published by the Driver and Vehicle Standards Agency (DVSA), reproduced under the Open Government Licence v3.0.\n\nLicence reference: '}{LICENCE_REF}
      </Section>

      <Section title="Highway Code" theme={theme}>
        {'Contains public sector information licensed under the Open Government Licence v3.0.\n© Crown copyright. Source: DVSA Highway Code.'}
      </Section>

      <Section title="Road Signs" theme={theme}>
        {'Road sign images © Crown copyright. Licensed under the Open Government Licence v3.0.\nSource: DVSA Traffic Signs Regulations and General Directions 2002 (as amended).'}
      </Section>

      <Section title="What the licence permits" theme={theme}>
        {'The Open Government Licence allows you to copy, publish, distribute, transmit, adapt and exploit the information commercially or non-commercially, as long as you acknowledge the source.\n\nClearPass has made adaptations to the original material for the purpose of theory test preparation. These adaptations are owned by ZenFinanceHub and are not Crown copyright.'}
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
        {'All practice questions, explanations, app design, and original written content in ClearPass are © ZenFinanceHub. All rights reserved.'}
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
