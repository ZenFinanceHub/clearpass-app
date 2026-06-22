import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { getProxyUrl } from '@/src/proxyUrl';
import { Colors } from '@/src/constants/theme';
import { ScaleButton } from '@/src/components/ScaleButton';

const FEATURES = [
  'Unlimited practice questions',
  'Full mock tests (50 questions, timed)',
  'Hazard perception videos',
  'AI tutor explains every answer',
  'Progress tracking & streaks',
];



export default function PaywallScreen() {
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [referredBy,   setReferredBy]   = useState<string | null>(null);
  const [isTestMode,   setIsTestMode]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('referral_code').then(code => {
      if (code) setReferredBy(code);
    }).catch(() => {});

    fetch(`${getProxyUrl()}/api/config`)
      .then(r => r.json() as Promise<{ stripeTestMode?: boolean }>)
      .then(d => { if (d.stripeTestMode) setIsTestMode(true); })
      .catch(() => {});
  }, []);

  async function handleSubscribe() {
    setError('');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/signin');
        return;
      }
      const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        setError(data.error ?? 'Could not start checkout. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleMaybeLater() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Test mode banner */}
      {isTestMode && (
        <View style={styles.testBanner}>
          <Text style={styles.testBannerText}>{'[!] Test mode -- no real charges'}</Text>
        </View>
      )}

      {/* Referral badge */}
      {referredBy && (
        <View style={styles.referralBadge}>
          <Text style={styles.referralBadgeText}>{'Recommended by your driving instructor'}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{'🏆'}</Text>
        <Text style={styles.headerTitle}>{'Go Premium'}</Text>
        <Text style={styles.headerSub}>{'Everything you need to pass first time'}</Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureList}>
        {FEATURES.map((feat) => (
          <View key={feat} style={styles.featureRow}>
            <Text style={styles.featureCheck}>{'✅'}</Text>
            <Text style={styles.featureText}>{feat}</Text>
          </View>
        ))}
      </View>

      {/* Pricing */}
      <View style={styles.pricingBox}>
        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>{'£7.99'}</Text>
          <Text style={styles.pricePeriod}>{' / 3 months'}</Text>
        </View>
        <Text style={styles.priceSub}>{"That's less than £2.67/month"}</Text>
      </View>

      {/* TODO: replace with Google Play IAP once policy decision is made */}
      {Platform.OS === 'android' ? (
        <>
          <View style={styles.androidBanner}>
            <Text style={styles.androidBannerTitle}>{'[!] Android payments coming soon'}</Text>
            <Text style={styles.androidBannerBody}>
              {'Premium is not yet available for direct purchase on Android. You can subscribe via our website.'}
            </Text>
          </View>
          <ScaleButton
            style={styles.ctaBtn}
            onPress={() => void Linking.openURL('https://getclearpass.co.uk')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>{'Visit getclearpass.co.uk'}</Text>
          </ScaleButton>
        </>
      ) : (
        <>
          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}
          <ScaleButton
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={() => void handleSubscribe()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.ctaBtnText}>{'Start Learning Now'}</Text>
            }
          </ScaleButton>
        </>
      )}

      <TouchableOpacity style={styles.skipBtn} onPress={handleMaybeLater} activeOpacity={0.7}>
        <Text style={styles.skipText}>{'Maybe later'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F8FA' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 24,
  },

  header: { alignItems: 'center', gap: 10 },
  headerEmoji: { fontSize: 64 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#111827', textAlign: 'center' },
  headerSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  featureList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 14,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { fontSize: 18 },
  featureText: { fontSize: 15, color: '#111827', fontWeight: '500', flex: 1 },

  pricingBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.indigo,
    paddingVertical: 24,
    paddingHorizontal: 40,
    width: '100%',
    gap: 6,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontSize: 48, fontWeight: '900', color: '#111827' },
  pricePeriod: { fontSize: 18, color: '#6B7280', fontWeight: '500' },
  priceSub: { fontSize: 13, color: Colors.indigo, fontWeight: '600' },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

  ctaBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#6B7280' },

  referralBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  referralBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.indigo },

  testBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  testBannerText: { fontSize: 13, fontWeight: '700', color: '#D97706' },

  androidBanner: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0891B2',
    padding: 16,
    alignSelf: 'stretch',
    gap: 6,
  },
  androidBannerTitle: { fontSize: 14, fontWeight: '800', color: '#0891B2' },
  androidBannerBody:  { fontSize: 13, color: '#374151', lineHeight: 20 },
});
