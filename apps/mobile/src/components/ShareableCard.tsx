import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/src/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MockCardData = {
  type: 'mock';
  score: number;
  total: number;
  passed: boolean;
  timeTakenSeconds: number;
  streakDays?: number;
};

export type PracticeCardData = {
  type: 'practice';
  correct: number;
  total: number;
  topic?: string;
  streakDays?: number;
};

export type HazardCardData = {
  type: 'hazard';
  score: number;
  maxScore: number;
  passed: boolean;
};

export type ShareCardData = MockCardData | PracticeCardData | HazardCardData;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// ─── Card components (intentionally no useTheme — consistent for sharing) ────

function MockCard({ data }: { data: MockCardData }) {
  const pct = Math.round((data.score / data.total) * 100);
  return (
    <LinearGradient colors={[Colors.indigo, Colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.card}>
      <Text style={cs.bgEmoji}>{'🚗'}</Text>
      <Text style={cs.appLabel}>{'CLEARPASS'}</Text>
      <Text style={cs.cardTitle}>{'Theory Test Result'}</Text>
      {data.passed && (
        <View style={cs.passBadge}>
          <Text style={cs.passBadgeText}>{'PASSED'}</Text>
        </View>
      )}
      <Text style={cs.bigScore}>{data.score}{' / '}{data.total}</Text>
      <View style={cs.statsRow}>
        <View style={cs.statItem}>
          <Text style={cs.statValue}>{pct}{'%'}</Text>
          <Text style={cs.statLabel}>{'Accuracy'}</Text>
        </View>
        <View style={cs.statDivider} />
        <View style={cs.statItem}>
          <Text style={cs.statValue}>{fmtTime(data.timeTakenSeconds)}</Text>
          <Text style={cs.statLabel}>{'Time taken'}</Text>
        </View>
      </View>
      {!!data.streakDays && data.streakDays > 0 && (
        <View style={cs.streakPill}>
          <Text style={cs.streakText}>{'🔥 '}{data.streakDays}{'-day streak'}</Text>
        </View>
      )}
      <Text style={cs.motivational}>
        {data.passed ? 'Ready for the real test!' : "Keep practising, you've got this!"}
      </Text>
      <Text style={cs.footer}>{'clearpass.app'}</Text>
    </LinearGradient>
  );
}

function PracticeCard({ data }: { data: PracticeCardData }) {
  const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
  return (
    <LinearGradient colors={['#CCFBF1', '#E0F2FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.card}>
      <Text style={[cs.bgEmoji, { color: 'rgba(13,148,136,0.18)' }]}>{'📚'}</Text>
      <Text style={[cs.appLabel, { color: '#0F766E' }]}>{'CLEARPASS'}</Text>
      <Text style={[cs.cardTitle, { color: '#134E4A' }]}>{'Practice Complete'}</Text>
      <Text style={[cs.bigScore, { color: Colors.indigo }]}>{data.correct}{' / '}{data.total}</Text>
      <Text style={[cs.pctLabel, { color: '#0F766E' }]}>{pct}{'%'}</Text>
      {!!data.topic && (
        <View style={cs.topicBadge}>
          <Text style={cs.topicBadgeText}>{data.topic}</Text>
        </View>
      )}
      {!!data.streakDays && data.streakDays > 0 && (
        <View style={[cs.streakPill, { backgroundColor: 'rgba(13,148,136,0.15)' }]}>
          <Text style={[cs.streakText, { color: Colors.indigo }]}>{'🔥 '}{data.streakDays}{'-day streak'}</Text>
        </View>
      )}
      <Text style={[cs.footer, { color: '#0F766E' }]}>{'clearpass.app'}</Text>
    </LinearGradient>
  );
}

function HazardCard({ data }: { data: HazardCardData }) {
  const pct = data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
  const scoreColor = data.passed ? '#10B981' : '#F87171';
  return (
    <LinearGradient colors={['#111827', '#1E3A5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.card}>
      <Text style={cs.bgEmoji}>{'⚠'}</Text>
      <Text style={cs.appLabel}>{'CLEARPASS'}</Text>
      <Text style={cs.cardTitle}>{'Hazard Perception'}</Text>
      {data.passed && (
        <View style={cs.passBadge}>
          <Text style={cs.passBadgeText}>{'PASSED'}</Text>
        </View>
      )}
      <Text style={[cs.bigScore, { color: scoreColor }]}>{data.score}{' / '}{data.maxScore}</Text>
      <Text style={[cs.pctLabel, { color: scoreColor }]}>{pct}{'%'}</Text>
      <Text style={cs.motivational}>
        {data.passed ? 'Excellent hazard awareness!' : 'Aim for 60%+ to pass'}
      </Text>
      <Text style={cs.footer}>{'clearpass.app'}</Text>
    </LinearGradient>
  );
}

function CardContent({ data }: { data: ShareCardData }) {
  if (data.type === 'mock') return <MockCard data={data} />;
  if (data.type === 'practice') return <PracticeCard data={data} />;
  return <HazardCard data={data} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ShareCardModal({
  visible,
  onClose,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  async function capture(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      await new Promise<void>((r) => setTimeout(r, 200));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as { captureRef: (ref: React.RefObject<any>, opts: object) => Promise<string> };
      return await captureRef(cardRef, { format: 'png', quality: 1 });
    } catch {
      return null;
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', 'Take a screenshot to share your result!');
        return;
      }
      const uri = await capture();
      if (!uri) { Alert.alert('Error', 'Could not capture card'); return; }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available', 'Use Save to Photos instead.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your result' });
    } catch {
      Alert.alert('Error', 'Something went wrong while sharing');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Save', 'Take a screenshot to save your result!');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to save the card.');
        return;
      }
      const uri = await capture();
      if (!uri) { Alert.alert('Error', 'Could not capture card'); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Result card saved to your photo library.');
    } catch {
      Alert.alert('Error', 'Something went wrong while saving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.handle} />
          <Text style={ms.sheetTitle}>{'Your Result Card'}</Text>

          <View ref={cardRef} collapsable={false} style={ms.cardWrap}>
            <CardContent data={data} />
          </View>

          {Platform.OS === 'web' ? (
            <View style={ms.webMsg}>
              <Text style={ms.webMsgText}>{'Take a screenshot to share this!'}</Text>
            </View>
          ) : (
            <View style={ms.btnRow}>
              <TouchableOpacity style={[ms.btn, ms.shareBtn]} onPress={handleShare} disabled={busy} activeOpacity={0.85}>
                <Text style={ms.shareBtnText}>{busy ? 'Working...' : 'Share'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.btn, ms.saveBtn]} onPress={handleSave} disabled={busy} activeOpacity={0.85}>
                <Text style={ms.saveBtnText}>{'Save to Photos'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={ms.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={ms.closeBtnText}>{'Close'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  card: {
    width: 300,
    borderRadius: 20,
    padding: 28,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 10,
  },
  bgEmoji: {
    position: 'absolute',
    fontSize: 120,
    right: -20,
    bottom: -20,
    opacity: 0.12,
    color: '#FFFFFF',
  },
  appLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  passBadge: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  passBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  bigScore: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 80,
  },
  pctLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },
  streakPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topicBadge: {
    backgroundColor: 'rgba(13,148,136,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.4)',
  },
  topicBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.indigo,
  },
  motivational: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 19,
  },
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    fontWeight: '600',
  },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
    minHeight: 500,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  cardWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  webMsg: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 20,
    width: '100%',
  },
  webMsgText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareBtn: {
    backgroundColor: Colors.indigo,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.indigo,
  },
  saveBtnText: {
    color: Colors.indigo,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});
