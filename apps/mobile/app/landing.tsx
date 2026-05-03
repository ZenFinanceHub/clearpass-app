import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

const NAVBAR_H = 64;

type Feature = { emoji: string; title: string; desc: string; accent: string };
const FEATURES: Feature[] = [
  { emoji: '[ AI ]', title: 'Smart Practice', desc: 'AI selects questions based on your weak areas so every session counts.', accent: '#F87171' },
  { emoji: '[ ? ]', title: 'AI Tutor', desc: 'Get instant explanations for every wrong answer from Claude AI.', accent: '#A78BFA' },
  { emoji: '[ 57 ]', title: 'Mock Tests', desc: 'Full 57-minute timed tests matching the real DVSA format.', accent: '#34D399' },
  { emoji: '⚡', title: 'Battle Mode', desc: 'Race through your weakest topics with a combo score multiplier.', accent: '#FBBF24' },
  { emoji: '[ % ]', title: 'Progress Tracking', desc: 'Track your readiness score and see exactly where to improve.', accent: '#F87171' },
  { emoji: '🏆', title: 'Leaderboard', desc: 'Compete with friends and see who is most prepared to pass.', accent: '#A78BFA' },
];

type Stat = { value: string; label: string; color: string };
const STATS: Stat[] = [
  { value: '55%', label: 'of learners fail first time', color: '#F87171' },
  { value: '210+', label: 'practice questions', color: '#A78BFA' },
  { value: '14', label: 'topic categories covered', color: '#FBBF24' },
  { value: '43/50', label: 'pass mark needed', color: '#34D399' },
];

type Step = { num: string; title: string; desc: string };
const STEPS: Step[] = [
  { num: '1', title: 'Create your account', desc: 'Sign up free in 30 seconds' },
  { num: '2', title: 'Practice daily', desc: '10 smart questions every day builds your knowledge fast' },
  { num: '3', title: 'Pass first time', desc: 'When your readiness hits 80% you are ready to book' },
];

const FREE_FEATURES = ['10 questions per day', 'Basic progress tracking', 'Mock test preview'];
const PRO_FEATURES = ['Unlimited questions', 'AI tutor explanations', 'Battle mode', 'Full mock tests', 'Leaderboard'];
const PROOF = ['210+ questions', 'AI explanations', 'Mock tests'];

export default function LandingPage() {
  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navBrand}>ClearPass</Text>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => router.push('/auth')} activeOpacity={0.75}>
            <Text style={styles.navSignIn}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navCta} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={styles.navCtaText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBgWrap}>
            <Text style={styles.heroBgEmoji}>{'🚗'}</Text>
          </View>
          <View style={styles.heroInner}>
            <Text style={styles.heroLine1}>Pass your theory test.</Text>
            <Text style={styles.heroLine2}>First time.</Text>
            <Text style={styles.heroSub}>
              {'Join thousands of UK learners using AI-powered practice to pass first time. Smart questions, instant explanations, real results.'}
            </Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Start for free</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.btnOutlineText}>See how it works</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <Text style={styles.proofTick}>{'✓'}</Text>
                  <Text style={styles.proofText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            {STATS.map((s, i) => (
              <React.Fragment key={s.value}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                {i < STATS.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Everything you need to pass</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.featureCard, { borderTopColor: f.accent }]}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How it works */}
        <View style={[styles.section, styles.sectionDark]}>
          <Text style={styles.sectionTitle}>Start passing in 3 steps</Text>
          <View style={styles.stepsRow}>
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.num}>
                <View style={styles.stepCard}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNum}>{step.num}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
                {idx < STEPS.length - 1 && <View style={styles.stepLine} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Simple pricing</Text>
          <View style={styles.pricingRow}>
            <View style={styles.pricingCard}>
              <Text style={styles.planName}>Free</Text>
              <Text style={styles.planPrice}>{'£0'}</Text>
              <View style={styles.planPriceSpacer} />
              {FREE_FEATURES.map((f) => (
                <View key={f} style={styles.planFeatureRow}>
                  <Text style={styles.planTick}>{'✓'}</Text>
                  <Text style={styles.planFeatureText}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.planCtaOutline} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.planCtaOutlineText}>Get started free</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.pricingCard, styles.pricingCardPro]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most popular</Text>
              </View>
              <Text style={[styles.planName, styles.planNamePro]}>Pro</Text>
              <Text style={[styles.planPrice, styles.planPricePro]}>{'£4.99'}</Text>
              <Text style={styles.planPriceNote}>one-time purchase</Text>
              {PRO_FEATURES.map((f) => (
                <View key={f} style={styles.planFeatureRow}>
                  <Text style={styles.planTickPro}>{'✓'}</Text>
                  <Text style={styles.planFeatureTextPro}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.planCtaPro} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.planCtaProText}>Get Pro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>ClearPass</Text>
          <Text style={styles.footerSub}>Pass your UK theory test first time</Text>
          <Text style={styles.footerDisclaimer}>Built for UK learners. Not affiliated with DVSA.</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>{'·'}</Text>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerCopy}>{'© 2026 ClearPass'}</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },

  // ── Navbar ──────────────────────────────────────────────────────────────────
  navbar: {
    height: NAVBAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingRight: 24,
    backgroundColor: '#0D0D14',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1F1F2E',
  },
  navBrand: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navSignIn: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
  navCta: {
    backgroundColor: '#7B5EA7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navCtaText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    minHeight: '100vh' as any,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 80,
    overflow: 'hidden',
  },
  heroBgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBgEmoji: { fontSize: 120, opacity: 0.05 },
  heroInner: { alignItems: 'center', width: '100%', maxWidth: 640 },
  heroLine1: {
    fontSize: 48,
    fontWeight: '900',
    color: '#F1F0FF',
    textAlign: 'center',
    lineHeight: 58,
  },
  heroLine2: {
    fontSize: 48,
    fontWeight: '900',
    color: '#A78BFA',
    textAlign: 'center',
    lineHeight: 58,
    marginBottom: 28,
  },
  heroSub: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 560,
    marginBottom: 40,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    backgroundColor: '#13131A',
  },
  btnOutlineText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  proofRow: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  proofItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proofTick: { fontSize: 13, color: '#34D399', fontWeight: '800' },
  proofText: { fontSize: 13, color: '#6B7280' },

  // ── Stats ───────────────────────────────────────────────────────────────────
  statsWrap: { paddingHorizontal: 16, marginBottom: 8 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 32,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: { flex: 1, minWidth: 80, alignItems: 'center' },
  statValue: { fontSize: 36, fontWeight: '900', lineHeight: 44 },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  statDivider: { width: 1, height: 40, backgroundColor: '#1F1F2E' },

  // ── Sections ────────────────────────────────────────────────────────────────
  section: { paddingHorizontal: 16, paddingVertical: 64 },
  sectionDark: { backgroundColor: '#0D0D14' },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F1F0FF',
    textAlign: 'center',
    marginBottom: 48,
  },

  // ── Features ────────────────────────────────────────────────────────────────
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  featureCard: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
    flex: 1,
    minWidth: 200,
    maxWidth: 320,
  },
  featureEmoji: { fontSize: 32, marginBottom: 12 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: '#F1F0FF', marginBottom: 8 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // ── Steps ───────────────────────────────────────────────────────────────────
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  stepCard: {
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
    maxWidth: 260,
    paddingHorizontal: 12,
  },
  stepCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1C1C27',
    borderWidth: 2,
    borderColor: '#A78BFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepNum: { fontSize: 22, fontWeight: '900', color: '#A78BFA' },
  // marginTop aligns the line with circle centre: (56 - 2) / 2 = 27
  stepLine: {
    height: 2,
    width: 60,
    backgroundColor: '#1F1F2E',
    flexShrink: 0,
    marginTop: 27,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F0FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  // ── Pricing ─────────────────────────────────────────────────────────────────
  pricingRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  pricingCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 32,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    flex: 1,
    minWidth: 260,
    maxWidth: 360,
  },
  pricingCardPro: {
    backgroundColor: '#7B5EA7',
    borderWidth: 2,
    borderColor: '#A78BFA',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBBF24',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  popularText: { fontSize: 11, fontWeight: '800', color: '#0A0A0F' },
  planName: { fontSize: 20, fontWeight: '800', color: '#F1F0FF', marginBottom: 8 },
  planNamePro: { color: '#FFFFFF' },
  planPrice: { fontSize: 48, fontWeight: '900', color: '#F1F0FF', lineHeight: 56 },
  planPricePro: { color: '#FFFFFF' },
  planPriceSpacer: { height: 22 },
  planPriceNote: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 24 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  planTick: { fontSize: 14, color: '#34D399', fontWeight: '700' },
  planTickPro: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  planFeatureText: { fontSize: 14, color: '#9CA3AF', flex: 1 },
  planFeatureTextPro: { fontSize: 14, color: '#FFFFFF', flex: 1 },
  planCtaOutline: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    backgroundColor: '#1C1C27',
  },
  planCtaOutlineText: { fontSize: 15, fontWeight: '700', color: '#F1F0FF' },
  planCtaPro: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: '#FFFFFF',
  },
  planCtaProText: { fontSize: 15, fontWeight: '700', color: '#7B5EA7' },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: '#0D0D14',
    borderTopWidth: 0.5,
    borderTopColor: '#1F1F2E',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerBrand: { fontSize: 20, fontWeight: '900', color: '#F1F0FF', letterSpacing: 1 },
  footerSub: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  footerDisclaimer: { fontSize: 12, color: '#374151', marginBottom: 8 },
  footerLinks: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerLink: { fontSize: 13, color: '#6B7280' },
  footerDot: { fontSize: 13, color: '#374151' },
  footerCopy: { fontSize: 12, color: '#374151', marginTop: 8 },
});
