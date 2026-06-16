import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { getProxyUrl } from '@/src/proxyUrl';
import { supabase } from '@/src/supabase';

// TODO: replace with real pass stories from pass_stories table once collected
const TESTIMONIALS = [
  {
    name: 'Jamie T.',
    score: '49/50',
    quote: 'I failed my first attempt before I found ClearPass. The weak spot drilling completely changed how I revised. Passed second time with 49/50!',
    location: 'Manchester',
  },
  {
    name: 'Priya S.',
    score: '47/50',
    quote: 'As a dyslexic learner the OpenDyslexic font and text-to-speech made this the only theory app I could actually use. The AI tutor explains things so clearly.',
    location: 'Birmingham',
  },
  {
    name: 'Callum R.',
    score: '45/50',
    quote: 'Did 3 weeks of ClearPass practice before my test. The pass probability went from 42% to 84% by test day. Knew I was ready when I walked in.',
    location: 'Edinburgh',
  },
];

const FEATURES = [
  { icon: '🤖', title: 'AI Tutor', desc: 'Ask anything. Get clear explanations from real conversational AI.' },
  { icon: '📊', title: 'Pass Probability', desc: 'Live prediction of your pass chance, updated after every session.' },
  { icon: '📝', title: 'Full Mock Tests', desc: '50 questions, 57 minutes, full DVSA format.' },
  { icon: '📅', title: 'Smart Study Plan', desc: 'AI builds a personalised day-by-day plan around your test date.' },
  { icon: '⚠️', title: 'Hazard Perception', desc: 'Video clips with real scoring — just like the actual test.' },
  { icon: '♿', title: 'Accessibility Mode', desc: 'OpenDyslexic font, text-to-speech, cream background and more.' },
];

const FREE_FEATURES = ['10 questions per day', 'Highway Code & road signs', '5 AI tutor questions/day'];
const PRO_FEATURES = ['Unlimited questions', 'Full mock tests', 'Hazard perception', 'Unlimited AI tutor', 'AI study plan', 'Offline mode'];

async function handleGetPro() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { router.push('/auth'); return; }
  try {
    const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = await res.json() as { url?: string };
    if (data.url) await Linking.openURL(data.url);
  } catch {
    router.push('/paywall');
  }
}

export default function LandingPage() {
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleWaitlist() {
    if (!waitlistEmail.includes('@') || waitlistStatus === 'loading') return;
    setWaitlistStatus('loading');
    try {
      const res = await fetch(`${getProxyUrl()}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      if (res.ok) { setWaitlistStatus('done'); setWaitlistEmail(''); }
      else setWaitlistStatus('error');
    } catch { setWaitlistStatus('error'); }
  }

  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navBrand}>{'ClearPass'}</Text>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => router.push('/auth')} activeOpacity={0.75}>
            <Text style={styles.navSignIn}>{'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navCta} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={styles.navCtaText}>{'Start Free'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgePill}><Text style={styles.heroBadgePillText}>{'NEW'}</Text></View>
            <Text style={styles.heroBadgeText}>{'AI Study Plans now live'}</Text>
          </View>
          <Text style={styles.heroH1}>{'Pass Your Theory Test'}</Text>
          <Text style={styles.heroH1Accent}>{'First Time'}</Text>
          <Text style={styles.heroSub}>{'The UK\'s smartest revision app. AI tutor, personalised study plan, and the only app built for dyslexic learners.'}</Text>
          <View style={styles.heroBtns}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/auth')} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>{'Start Free →'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => router.push('/auth')} activeOpacity={0.85}>
              <Text style={styles.btnOutlineText}>{'See How It Works'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroMicro}>{'No credit card · Free to start · Cancel anytime'}</Text>
          <View style={styles.heroSocial}>
            <Text style={styles.heroStars}>{'⭐⭐⭐⭐⭐'}</Text>
            <Text style={styles.heroSocialText}>{'Trusted by learner drivers across the UK'}</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{'54%'}</Text>
            <Text style={styles.statLbl}>{'of learners fail first time'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{'2.8M'}</Text>
            <Text style={styles.statLbl}>{'theory tests per year in the UK'}</Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{'FEATURES'}</Text>
          <Text style={styles.sectionTitle}>{'Everything you need to pass first time'}</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How it works */}
        <View style={[styles.section, styles.sectionAlt]}>
          <Text style={styles.sectionLabel}>{'GET STARTED'}</Text>
          <Text style={styles.sectionTitle}>{'Get test ready in 3 steps'}</Text>
          {[
            { n: '1', t: 'Create your free account', d: 'Set your test date and we\'ll build your personalised plan instantly.' },
            { n: '2', t: 'Follow your AI study plan', d: 'Your plan adapts as you learn, focusing time where it matters most.' },
            { n: '3', t: 'Pass first time', d: 'When your pass probability hits 85%+ you\'re ready to book.' },
          ].map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>{step.n}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.t}</Text>
                <Text style={styles.stepDesc}>{step.d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Testimonials */}
        <View style={[styles.section, styles.sectionAlt]}>
          <Text style={styles.sectionLabel}>{'PASS STORIES'}</Text>
          <Text style={styles.sectionTitle}>{'Join thousands who passed first time'}</Text>
          <View style={styles.testimonialGrid}>
            {TESTIMONIALS.map((t) => (
              <View key={t.name} style={styles.testimonialCard}>
                <Text style={styles.testimonialStars}>{'★★★★★'}</Text>
                <Text style={styles.testimonialQuote}>{'"'}{t.quote}{'"'}</Text>
                <View style={styles.testimonialFooter}>
                  <View style={styles.testimonialAvatar}>
                    <Text style={styles.testimonialAvatarText}>{t.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialName}>{t.name}</Text>
                    <Text style={styles.testimonialMeta}>{t.location}{' · Scored '}{t.score}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Email waitlist */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{'GET NOTIFIED'}</Text>
          <Text style={styles.sectionTitle}>{'Be first to know when we launch'}</Text>
          <Text style={styles.waitlistSub}>{'Sign up for early access and a free extended trial.'}</Text>
          {waitlistStatus === 'done' ? (
            <View style={styles.waitlistSuccess}>
              <Text style={styles.waitlistSuccessText}>{'[OK] You are on the list!'}</Text>
            </View>
          ) : (
            <View style={styles.waitlistRow}>
              <TextInput
                style={styles.waitlistInput}
                value={waitlistEmail}
                onChangeText={setWaitlistEmail}
                placeholder="your@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={waitlistStatus !== 'loading'}
              />
              <TouchableOpacity
                style={[styles.waitlistBtn, (waitlistStatus === 'loading' || !waitlistEmail.includes('@')) && { opacity: 0.6 }]}
                onPress={() => void handleWaitlist()}
                activeOpacity={0.85}
                disabled={waitlistStatus === 'loading' || !waitlistEmail.includes('@')}
              >
                <Text style={styles.waitlistBtnText}>{waitlistStatus === 'loading' ? '...' : 'Notify me'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {waitlistStatus === 'error' && (
            <Text style={styles.waitlistError}>{'Something went wrong -- try again'}</Text>
          )}
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{'PRICING'}</Text>
          <Text style={styles.sectionTitle}>{'Simple, honest pricing'}</Text>
          <View style={styles.pricingRow}>
            {/* Free card */}
            <View style={styles.priceCard}>
              <Text style={styles.planName}>{'Free'}</Text>
              <Text style={styles.planFreeTag}>{'Free forever'}</Text>
              <Text style={styles.planAmount}>{'£0'}</Text>
              <View style={styles.planDivider} />
              {FREE_FEATURES.map((f) => (
                <View key={f} style={styles.planFeatureRow}>
                  <Text style={styles.planCheck}>{'✓'}</Text>
                  <Text style={styles.planFeatureText}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.planCtaFree} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.planCtaFreeText}>{'Get started free'}</Text>
              </TouchableOpacity>
            </View>

            {/* Pro card */}
            <View style={[styles.priceCard, styles.priceCardPro]}>
              <View style={styles.planBadge}><Text style={styles.planBadgeText}>{'Most Popular'}</Text></View>
              <Text style={[styles.planName, styles.planNamePro]}>{'Premium'}</Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planAmountPro}>{'£7.99'}</Text>
                <Text style={styles.planPeriod}>{' / 3 months'}</Text>
              </View>
              <Text style={styles.planNote}>{'Less than £2.67/month'}</Text>
              <View style={styles.planDivider} />
              {PRO_FEATURES.map((f) => (
                <View key={f} style={styles.planFeatureRow}>
                  <Text style={styles.planCheckPro}>{'✓'}</Text>
                  <Text style={styles.planFeatureTextPro}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.planCtaPro} onPress={() => void handleGetPro()} activeOpacity={0.85}>
                <Text style={styles.planCtaProText}>{'Start Learning Now'}</Text>
              </TouchableOpacity>
              <Text style={styles.planSmall}>{'The theory test costs £23. ClearPass pays for itself.'}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>{'ClearPass'}</Text>
          <Text style={styles.footerSub}>{'Pass your UK theory test first time'}</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)} activeOpacity={0.75}><Text style={styles.footerLink}>{'Privacy Policy'}</Text></TouchableOpacity>
            <Text style={styles.footerDot}>{'·'}</Text>
            <TouchableOpacity onPress={() => router.push('/terms' as any)} activeOpacity={0.75}><Text style={styles.footerLink}>{'Terms'}</Text></TouchableOpacity>
            <Text style={styles.footerDot}>{'·'}</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@getclearpass.co.uk').catch(() => {})} activeOpacity={0.75}><Text style={styles.footerLink}>{'Contact'}</Text></TouchableOpacity>
          </View>
          <Text style={styles.footerCopy}>{'hello@getclearpass.co.uk'}</Text>
          <Text style={styles.footerCopy}>{'Copyright 2026 ClearPass -- Built in the UK'}</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const TEAL = '#0D9488';
const INDIGO = '#6366F1';
const BG = '#F7F8FA';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  navbar: {
    height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB',
  },
  navBrand: { fontSize: 20, fontWeight: '900', color: TEAL, letterSpacing: -0.5 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navSignIn: { fontSize: 14, fontWeight: '600', color: '#374151' },
  navCta: { backgroundColor: TEAL, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 8 },
  navCtaText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  hero: {
    backgroundColor: '#F0FDF9',
    paddingHorizontal: 24, paddingTop: 48, paddingBottom: 56, alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24,
  },
  heroBadgePill: { backgroundColor: TEAL, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  heroBadgePillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  heroBadgeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  heroH1: { fontSize: 40, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: -1, lineHeight: 48 },
  heroH1Accent: { fontSize: 40, fontWeight: '900', color: TEAL, textAlign: 'center', letterSpacing: -1, lineHeight: 52, marginBottom: 20 },
  heroSub: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 26, maxWidth: 360, marginBottom: 32 },
  heroBtns: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  btnPrimary: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnOutline: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  btnOutlineText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  heroMicro: { fontSize: 12, color: '#9CA3AF', marginBottom: 28, textAlign: 'center' },
  heroSocial: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  heroStars: { fontSize: 14 },
  heroSocialText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  statsStrip: { backgroundColor: TEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  statVal: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  statLbl: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', textAlign: 'center', lineHeight: 17 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },

  section: { paddingHorizontal: 20, paddingVertical: 56 },
  sectionAlt: { backgroundColor: '#FFFFFF' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEAL, letterSpacing: 1, marginBottom: 8 },
  sectionTitle: { fontSize: 26, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 28, lineHeight: 34 },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    flex: 1, minWidth: 140, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  featureIcon: { fontSize: 28, marginBottom: 12 },
  featureTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 6 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  stepCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNum: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  stepText: { flex: 1, paddingTop: 4 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  stepDesc: { fontSize: 14, color: '#6B7280', lineHeight: 20 },

  pricingRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  priceCard: {
    flex: 1, minWidth: 220, backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 24, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  priceCardPro: {
    borderColor: TEAL,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 4,
  },
  planBadge: { backgroundColor: TEAL, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 14 },
  planBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  planName: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  planNamePro: { color: '#111827' },
  planFreeTag: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  planAmount: { fontSize: 44, fontWeight: '900', color: '#111827', letterSpacing: -1, lineHeight: 52, marginBottom: 4 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  planAmountPro: { fontSize: 44, fontWeight: '900', color: '#111827', letterSpacing: -1, lineHeight: 52 },
  planPeriod: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  planNote: { fontSize: 13, color: TEAL, fontWeight: '700', marginBottom: 16 },
  planDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  planCheck: { fontSize: 14, color: TEAL, fontWeight: '800' },
  planCheckPro: { fontSize: 14, color: TEAL, fontWeight: '800' },
  planFeatureText: { fontSize: 14, color: '#374151', flex: 1 },
  planFeatureTextPro: { fontSize: 14, color: '#374151', flex: 1 },
  planCtaFree: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  planCtaFreeText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  planCtaPro: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, backgroundColor: TEAL },
  planCtaProText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  planSmall: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 12, lineHeight: 18 },

  // ── Testimonials ──────────────────────────────────────────────────────────────
  testimonialGrid: { gap: 14 },
  testimonialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  testimonialStars: { fontSize: 14, color: TEAL, letterSpacing: 2 },
  testimonialQuote: { fontSize: 14, color: '#374151', lineHeight: 22, fontStyle: 'italic' },
  testimonialFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  testimonialAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
  },
  testimonialAvatarText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  testimonialName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  testimonialMeta: { fontSize: 12, color: '#6B7280' },

  // ── Waitlist ──────────────────────────────────────────────────────────────────
  waitlistSub: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 16 },
  waitlistRow: { flexDirection: 'row', gap: 8 },
  waitlistInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  waitlistBtn: {
    backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  waitlistBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  waitlistSuccess: {
    backgroundColor: '#F0FDFA', borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: TEAL,
  },
  waitlistSuccessText: { color: TEAL, fontSize: 15, fontWeight: '700' },
  waitlistError: { fontSize: 13, color: '#EF4444', marginTop: 8 },

  footer: {
    backgroundColor: '#111827', paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', gap: 10,
  },
  footerBrand: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  footerSub: { fontSize: 13, color: '#6B7280' },
  footerLinks: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  footerLink: { fontSize: 13, color: '#6B7280' },
  footerDot: { fontSize: 13, color: '#374151' },
  footerCopy: { fontSize: 12, color: '#374151', marginTop: 4 },
});
