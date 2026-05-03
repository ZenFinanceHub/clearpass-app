import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { HazardClipResult, HazardWindow, calculateHazardTotal, scoreClip } from '@clearpass/core';
import { hazardClips } from '@clearpass/content';
import { loadUserProgress, saveUserProgress } from '@/src/storage';

type Phase = 'info' | 'pre-clip' | 'player' | 'clip-result' | 'results';

function makeVideoHtml(url: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; width: 100vw; height: 100vh; overflow: hidden; }
video { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
</head>
<body>
<video id="v" src="${url}" autoplay playsinline muted></video>
<script>
var v = document.getElementById('v');
var lastSecond = -1;
v.addEventListener('ended', function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
});
v.addEventListener('timeupdate', function() {
  var sec = Math.floor(v.currentTime);
  if (sec !== lastSecond) {
    lastSecond = sec;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'timeupdate', currentTime: v.currentTime }));
  }
});
v.play().catch(function() {});
</script>
</body>
</html>`;
}

interface WebVideoPlayerProps {
  url: string;
  muted: boolean;
  onEnded: () => void;
  onTimeUpdate: (t: number) => void;
}

function WebVideoPlayer({ url, muted, onEnded, onTimeUpdate }: WebVideoPlayerProps) {
  const ref = useRef<any>(null);
  const lastSecRef = useRef(-1);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return React.createElement('video' as any, {
    ref,
    src: url,
    autoPlay: true,
    muted: true,
    playsInline: true,
    controls: false,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none',
    } as any,
    onTimeUpdate: (e: any) => {
      const t = e.target.currentTime as number;
      const sec = Math.floor(t);
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        onTimeUpdate(t);
      }
    },
    onEnded,
  });
}

export default function HazardScreen() {
  const [phase, setPhase] = useState<Phase>('info');
  const [clipIndex, setClipIndex] = useState(0);
  const [clicks, setClicks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipResults, setClipResults] = useState<HazardClipResult[]>([]);
  const [muted, setMuted] = useState(true);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<any>(null);

  useFocusEffect(
    useCallback(() => {
      void loadUserProgress();
    }, []),
  );

  const clip = hazardClips[clipIndex];

  function handleVideoTap() {
    setClicks((prev) => [...prev, currentTime]);
    flashAnim.setValue(0.5);
    Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }

  function handleVideoEnded() {
    const result = scoreClip(clip, clicks);
    setClipResults((prev) => [...prev, result]);
    setPhase('clip-result');
  }

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    webViewRef.current?.injectJavaScript(`document.getElementById('v').muted = ${String(next)}; void(0);`);
  }

  function handleNextClip() {
    if (clipIndex + 1 < hazardClips.length) {
      setClipIndex((i) => i + 1);
      setClicks([]);
      setCurrentTime(0);
      setMuted(true);
      setPhase('pre-clip');
    } else {
      setPhase('results');
    }
  }

  async function handleFinish(results: HazardClipResult[]) {
    const progress = await loadUserProgress();
    if (progress) {
      const total = calculateHazardTotal(results);
      const xp = 20 + (total.passed ? 50 : 0);
      await saveUserProgress({
        ...progress,
        xp: (progress.xp ?? 0) + xp,
        hazardPerceptionHistory: [
          ...(progress.hazardPerceptionHistory ?? []),
          {
            date: new Date().toISOString(),
            score: total.score,
            maxScore: total.maxScore,
            passed: total.passed,
          },
        ],
      });
    }
    router.replace('/(tabs)/home');
  }

  function handleRestart() {
    setPhase('info');
    setClipIndex(0);
    setClicks([]);
    setCurrentTime(0);
    setClipResults([]);
    setMuted(true);
  }

  // ── INFO ─────────────────────────────────────────────────────────────────

  if (phase === 'info') {
    const maxPts = hazardClips.reduce((s, c) => s + c.hazards.length * 5, 0);
    return (
      <ScrollView style={styles.bg} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>{'Hazard Perception'}</Text>
        <Text style={styles.sub}>{'UK Theory Test Practice'}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{'How it works'}</Text>
          {(
            [
              ['Watch', 'Each clip shows a driving scene'],
              ['Tap', 'Press when you see a developing hazard'],
              ['Score', 'Earlier tap = higher score (3, 4 or 5 pts)'],
              ['Warning', 'Rapid clicking scores 0 — anti-cheat active'],
            ] as [string, string][]
          ).map(([label, text]) => (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{label}</Text>
              </View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          {(
            [
              [String(hazardClips.length), 'clips'],
              [String(maxPts), 'max pts'],
              ['~60%', 'to pass'],
            ] as [string, string][]
          ).map(([num, lbl]) => (
            <View key={lbl} style={styles.statPill}>
              <Text style={styles.statNum}>{num}</Text>
              <Text style={styles.statLabel}>{lbl}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => setPhase('pre-clip')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{'Start Practice'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── PRE-CLIP ─────────────────────────────────────────────────────────────

  if (phase === 'pre-clip') {
    return (
      <View style={[styles.bg, styles.centerFill]}>
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={styles.heading}>{clip.title}</Text>
        <Text style={styles.bodyText}>{clip.description}</Text>
        <View style={styles.reminderBox}>
          <Text style={styles.reminderText}>
            {'Tap anywhere on screen as soon as you spot a developing hazard.'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            setClicks([]);
            setCurrentTime(0);
            setPhase('player');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{"I'm Ready"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── PLAYER ───────────────────────────────────────────────────────────────

  if (phase === 'player') {
    let videoContent: React.ReactElement;
    if (Platform.OS !== 'web') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebView = (require('react-native-webview') as { default: React.ComponentType<any> }).default;
      videoContent = (
        <WebView
          ref={webViewRef}
          key={clipIndex}
          source={{ html: makeVideoHtml(clip.videoUrl) }}
          style={StyleSheet.absoluteFillObject}
          scrollEnabled={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onMessage={(e: any) => {
            const data = JSON.parse(e.nativeEvent.data) as { type: string; currentTime?: number };
            if (data.type === 'ended') handleVideoEnded();
            if (data.type === 'timeupdate' && data.currentTime !== undefined) {
              setCurrentTime(data.currentTime);
            }
          }}
        />
      );
    } else {
      videoContent = (
        <WebVideoPlayer
          url={clip.videoUrl}
          muted={muted}
          onEnded={handleVideoEnded}
          onTimeUpdate={setCurrentTime}
        />
      );
    }

    return (
      <View style={styles.playerScreen}>
        <View style={styles.videoWrap}>
          {videoContent}

          {/* Tap overlay */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
            activeOpacity={1}
            onPress={handleVideoTap}
          />

          {/* Click flash */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.flashOverlay,
              { opacity: flashAnim, zIndex: 11 },
            ]}
            pointerEvents="none"
          />

          {/* Mute toggle */}
          <TouchableOpacity style={styles.muteBtn} onPress={handleMuteToggle}>
            <Text style={styles.muteBtnText}>{muted ? '[ mute ]' : '[ sound ]'}</Text>
          </TouchableOpacity>

          {/* HUD */}
          <View style={styles.hud} pointerEvents="none">
            <Text style={styles.hudText}>
              {clipIndex + 1}
              {'/'}
              {hazardClips.length}
            </Text>
            <Text style={styles.hudText}>
              {clicks.length}
              {' taps'}
            </Text>
            <Text style={styles.hudText}>{formatTime(currentTime)}</Text>
          </View>
        </View>

        <View style={styles.tapHintBar}>
          <Text style={styles.tapHintText}>{'Tap anywhere to mark a hazard'}</Text>
        </View>
      </View>
    );
  }

  // ── CLIP RESULT ──────────────────────────────────────────────────────────

  if (phase === 'clip-result') {
    const result = clipResults[clipResults.length - 1];
    const isLast = clipIndex + 1 === hazardClips.length;
    return (
      <View style={[styles.bg, styles.centerFill]}>
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={styles.heading}>{clip.title}</Text>

        <View style={styles.resultCard}>
          <Text style={styles.resultScore}>
            {result.score}
            {' / '}
            {result.maxScore}
          </Text>
          <Text style={styles.resultScoreLabel}>{'Score for this clip'}</Text>
          {clip.hazards.map((_: HazardWindow, i: number) => (
            <View key={i} style={styles.hazardRow}>
              <Text style={styles.hazardLabel}>
                {result.score > 0
                  ? 'Hazard ' + String(i + 1) + ': ' + String(result.score) + ' pts'
                  : 'Hazard ' + String(i + 1) + ': missed'}
              </Text>
              <View style={styles.dots}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <View
                    key={n}
                    style={[styles.dot, n <= result.score ? styles.dotFilled : styles.dotEmpty]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.bodyText}>
          {result.clicks.length}
          {' tap(s) recorded'}
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleNextClip} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{isLast ? 'See Results' : 'Next Clip'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────

  const total = calculateHazardTotal(clipResults);
  const xpEarned = 20 + (total.passed ? 50 : 0);

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.resultBadge, total.passed ? styles.passBadge : styles.failBadge]}>
        <Text style={styles.resultBadgeText}>{total.passed ? 'PASS' : 'FAIL'}</Text>
      </View>

      <Text style={styles.heading}>{'Practice Complete'}</Text>
      <Text style={[styles.totalScore, total.passed ? styles.passText : styles.failText]}>
        {total.score}
        {'/'}
        {total.maxScore}
      </Text>
      <Text style={styles.bodyText}>
        {total.passed
          ? 'Great hazard awareness! You would pass.'
          : 'Keep practising — aim for 60% or above.'}
      </Text>

      <View style={styles.xpBadge}>
        <Text style={styles.xpText}>{'+' + String(xpEarned) + ' XP earned'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'Clip Breakdown'}</Text>
        {clipResults.map((r, i) => (
          <View key={r.clipId} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel} numberOfLines={1}>
              {'Clip '}
              {i + 1}
              {': '}
              {hazardClips[i]?.title ?? 'Unknown'}
            </Text>
            <Text style={[styles.breakdownScore, r.score > 0 ? styles.passText : styles.failText]}>
              {r.score}
              {'/'}
              {r.maxScore}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: 1 }]}
          onPress={handleRestart}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{'Try Again'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1, maxWidth: undefined }]}
          onPress={() => void handleFinish(clipResults)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{'Done'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return String(m) + ':' + s.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0A0F' },
  scrollContent: { alignItems: 'center', padding: 24, gap: 16, paddingBottom: 40 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },

  heading: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  bodyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  clipCounter: { fontSize: 13, fontWeight: '700', color: '#7B5EA7', letterSpacing: 0.5 },

  card: {
    width: '100%' as any,
    maxWidth: 480,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: '#60A5FA' },
  stepText: { fontSize: 13, color: '#D1D5DB', flex: 1 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 72,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  primaryBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%' as any,
    maxWidth: 360,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  reminderBox: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    width: '100%' as any,
    maxWidth: 360,
  },
  reminderText: { fontSize: 14, color: '#FCD34D', textAlign: 'center', lineHeight: 20 },

  // Player
  playerScreen: { flex: 1, backgroundColor: '#000000' },
  videoWrap: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  flashOverlay: { backgroundColor: '#FCD34D' },
  muteBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  muteBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  hud: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hudText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  tapHintBar: { backgroundColor: '#111827', paddingVertical: 12, alignItems: 'center' },
  tapHintText: { fontSize: 13, color: '#9CA3AF' },

  // Clip result
  resultCard: {
    width: '100%' as any,
    maxWidth: 480,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  resultScore: { fontSize: 52, fontWeight: '900', color: '#FFFFFF' },
  resultScoreLabel: { fontSize: 14, color: '#6B7280' },
  hazardRow: {
    width: '100%' as any,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hazardLabel: { fontSize: 13, color: '#D1D5DB', flex: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotFilled: { backgroundColor: '#34D399' },
  dotEmpty: { backgroundColor: '#374151' },

  // Results
  resultBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  passBadge: { backgroundColor: '#064E3B', borderColor: '#34D399' },
  failBadge: { backgroundColor: '#450A0A', borderColor: '#F87171' },
  resultBadgeText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  totalScore: { fontSize: 48, fontWeight: '900' },
  passText: { color: '#34D399' },
  failText: { color: '#F87171' },
  xpBadge: {
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  xpText: { fontSize: 15, fontWeight: '700', color: '#60A5FA' },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  breakdownScore: { fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' as any, maxWidth: 480 },
  secondaryBtn: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#9CA3AF', fontSize: 16, fontWeight: '700' },
});
