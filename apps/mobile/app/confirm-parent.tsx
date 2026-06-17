import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/src/constants/theme';

const PROXY_URL = 'https://clearpass-app-production.up.railway.app';

export default function ConfirmParentScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No confirmation token found in the link.');
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${PROXY_URL}/api/confirm-parent?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          setStatus('success');
        } else {
          setStatus('error');
          setMessage('This link may have already been used or has expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Could not connect. Please try again later.');
      }
    })();
  }, [token]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={Colors.indigo} />
          <Text style={styles.loadingText}>{'Confirming...'}</Text>
        </>
      )}

      {status === 'success' && (
        <>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{'[OK]'}</Text>
          </View>
          <Text style={styles.title}>{'Confirmed!'}</Text>
          <Text style={styles.body}>
            {"You'll now receive weekly progress updates for your learner on ClearPass."}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.replace('/(tabs)/home')} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{'Go to ClearPass'}</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'error' && (
        <>
          <View style={[styles.iconWrap, styles.iconWrapError]}>
            <Text style={[styles.icon, styles.iconError]}>{'[!]'}</Text>
          </View>
          <Text style={styles.title}>{'Confirmation failed'}</Text>
          <Text style={styles.body}>{message || 'Something went wrong. Please try again.'}</Text>
        </>
      )}

      <Text style={styles.footer}>{'ClearPass -- UK Theory Test Preparation'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: Colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconWrapError: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  icon: { fontSize: 22, fontWeight: '900', color: Colors.indigo },
  iconError: { color: '#EF4444' },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
  body: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  loadingText: { fontSize: 15, color: '#6B7280', marginTop: 12 },
  cta: {
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 32, fontSize: 12, color: '#9CA3AF' },
});
