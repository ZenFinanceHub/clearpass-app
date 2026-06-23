import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { getHazardVideoList, getVideoUrl, buildHazardClip, type HazardClipMeta } from '@/src/hazardVideos';
import { isPremium } from '@/src/subscription';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { checkAndTriggerCelebrations, CelebrationEvent } from '@/src/celebrations';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { ShareCardModal } from '@/src/components/ShareableCard';
import { OfflineBanner } from '@/src/components/OfflineBanner';

type Phase = 'info' | 'pre-clip' | 'player' | 'clip-result' | 'solution' | 'results';

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
  youtubeId: string;
  durationSec: number;
  onEnded: () => void;
  onTimeUpdate: (t: number) => void;
}

function WebVideoPlayer({ youtubeId, durationSec, onEnded, onTimeUpdate }: WebVideoPlayerProps) {
  useEffect(() => {
    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += 1;
      onTimeUpdate(elapsed);
    }, 1000);
    return () => clearInterval(tick);
  }, [onTimeUpdate]);

  useEffect(() => {
    const timer = setTimeout(onEnded, durationSec * 1000);
    return () => clearTimeout(timer);
  }, [durationSec, onEnded]);

  const src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1`;

  return React.createElement('iframe' as any, {
    src,
    title: 'Hazard clip',
    allow: 'autoplay',
    frameBorder: '0',
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      pointerEvents: 'none',
    } as any,
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
  const pendingHomeRef = useRef(false);
  const theme = useTheme();

  const [celebQueue, setCelebQueue] = useState<CelebrationEvent[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);

  // Supabase clip loading
  const [clipsLoading, setClipsLoading] = useState(true);
  const [supabaseClips, setSupabaseClips] = useState<HazardClipMeta[]>([]);
  const [activeClips, setActiveClips] = useState(hazardClips);
  const [solutionVideoUrl, setSolutionVideoUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadUserProgress();
      void getHazardVideoList().then(clips => {
        setSupabaseClips(clips);
        setClipsLoading(false);
      });
    }, []),
  );

  const clip = activeClips[clipIndex] ?? hazardClips[0];

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
    const totalClips = activeClips.length > 0 ? activeClips.length : hazardClips.length;
    if (clipIndex + 1 < totalClips) {
      setClipIndex((i) => i + 1);
      setClicks([]);
      setCurrentTime(0);
      setMuted(true);
      setSolutionVideoUrl(null);
      setPhase('pre-clip');
    } else {
      setPhase('results');
    }
  }

  function handleWatchSolution() {
    const meta = supabaseClips[clipIndex];
    if (!meta?.has_solution_clip || !meta.solution_start_s) return;
    // The video URL is the same as the clip — we seek to solution_start_s in the solution phase
    const existingClip = activeClips[clipIndex];
    setSolutionVideoUrl(existingClip?.videoUrl ?? null);
    setPhase('solution');
  }

  async function handleFinish(results: HazardClipResult[]) {
    const progress = await loadUserProgress();
    if (progress) {
      const total = calculateHazardTotal(results);
      const xp = 20 + (total.passed ? 50 : 0);
      const updated = {
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
      };
      await saveUserProgress(updated);

      try {
        const celebEvents = await checkAndTriggerCelebrations(updated);
        if (celebEvents.length > 0) {
          pendingHomeRef.current = true;
          setActiveCelebration(celebEvents[0]);
          setCelebQueue(celebEvents.slice(1));
          return;
        }
      } catch {}
    }
    router.replace('/(tabs)/home');
  }

  function handleCelebDismiss() {
    const [next, ...rest] = celebQueue;
    if (next) {
      setActiveCelebration(next);
      setCelebQueue(rest);
    } else {
      setActiveCelebration(null);
      if (pendingHomeRef.current) {
        pendingHomeRef.current = false;
        router.replace('/(tabs)/home');
      }
    }
  }

  function handleRestart() {
    setPhase('info');
    setClipIndex(0);
    setClicks([]);
    setCurrentTime(0);
    setClipResults([]);
    setMuted(true);
  }

  async function handleStartPractice() {
    const premium = await isPremium();
    if (!premium) { router.push('/paywall'); return; }

    if (supabaseClips.length > 0) {
      const built = await Promise.all(
        supabaseClips.map(async (sc) => {
          const url = await getVideoUrl(sc.storage_path);
          return buildHazardClip(sc, url ?? '');
        }),
      );
      setActiveClips(built);
    }
    setClipIndex(0);
    setClicks([]);
    setCurrentTime(0);
    setClipResults([]);
    setMuted(true);
    setPhase('pre-clip');
  }

  // ── INFO ─────────────────────────────────────────────────────────────────

  if (phase === 'info') {
    // Loading state
    if (clipsLoading) {
      return (
        <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
          <ActivityIndicator size="large" color={Colors.indigo} />
          <Text style={[styles.sub, { color: theme.subTextColor }]}>{'Loading...'}</Text>
        </View>
      );
    }

    // Coming soon — no clips in Supabase yet
    if (supabaseClips.length === 0) {
      return (
        <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
          <OfflineBanner />
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonEmoji}>{'[V]'}</Text>
            <Text style={[styles.heading, { fontSize: theme.fontSize(22), color: theme.textColor, textAlign: 'center' }]}>
              {'Hazard Perception'}
            </Text>
            <Text style={[styles.sub, { color: theme.subTextColor, textAlign: 'center' }]}>
              {'Videos coming soon -- check back before your test!'}
            </Text>
            <Text style={[styles.bodyText, { color: theme.subTextColor, textAlign: 'center' }]}>
              {'Real driving footage with hazard scoring, just like the actual DVSA test. We are uploading the clips now.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/home')} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>{'Back to Home'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const clipsToUse = supabaseClips.length > 0 ? supabaseClips : hazardClips;
    const maxPts = clipsToUse.length * 5;
    return (
      <View style={styles.bg}>
        <OfflineBanner />
      <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundColor }} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Hazard Perception'}</Text>
        <Text style={[styles.sub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>{'UK Theory Test Practice'}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{'How it works'}</Text>
          {(
            [
              ['Watch', 'Each clip shows a driving scene'],
              ['Tap', 'Press when you see a developing hazard'],
              ['Score', 'Earlier tap = higher score (3, 4 or 5 pts)'],
              ['Warning', 'Rapid clicking scores 0 -- anti-cheat active'],
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
              [String(clipsToUse.length), 'clips'],
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
          onPress={() => void handleStartPractice()}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{'Start Practice'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    );
  }

  // ── PRE-CLIP ─────────────────────────────────────────────────────────────

  if (phase === 'pre-clip') {
    return (
      <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{clip.title}</Text>
        <Text style={[styles.bodyText, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, color: theme.subTextColor }]}>{clip.description}</Text>
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
  // Player phase intentionally stays black (#000000)

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
          youtubeId={clip.youtubeId ?? ''}
          durationSec={clip.durationSec}
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
      <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{clip.title}</Text>

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

        <Text style={[styles.bodyText, { color: theme.subTextColor }]}>
          {result.clicks.length}
          {' tap(s) recorded'}
        </Text>

        {supabaseClips[clipIndex]?.has_solution_clip && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleWatchSolution} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>{'Watch Solution'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleNextClip} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{isLast ? 'See Results' : 'Next Clip'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── SOLUTION CLIP ─────────────────────────────────────────────────────────

  if (phase === 'solution') {
    const meta = supabaseClips[clipIndex];
    const seekTo = meta?.solution_start_s ?? 60;
    const solHtml = solutionVideoUrl ? `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { background:#000; width:100vw; height:100vh; overflow:hidden; } video { width:100%; height:100%; object-fit:cover; display:block; }</style>
</head><body>
<video id="v" src="${solutionVideoUrl}" autoplay playsinline muted></video>
<script>
var v = document.getElementById('v');
v.addEventListener('loadedmetadata', function() { v.currentTime = ${String(seekTo)}; v.play().catch(function(){}); });
v.addEventListener('ended', function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' })); });
</script></body></html>` : '';

    const isLast = clipIndex + 1 === (activeClips.length > 0 ? activeClips.length : hazardClips.length);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebView = (require('react-native-webview') as { default: React.ComponentType<any> }).default;

    return (
      <View style={styles.playerScreen}>
        <View style={styles.videoWrap}>
          {solutionVideoUrl ? (
            <WebView
              key={`solution-${clipIndex}`}
              source={{ html: solHtml }}
              style={StyleSheet.absoluteFillObject}
              scrollEnabled={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onMessage={() => handleNextClip()}
            />
          ) : null}
          <View style={[styles.hud, { top: 16, bottom: undefined }]} pointerEvents="none">
            <Text style={styles.hudText}>{'Solution clip'}</Text>
            <Text style={styles.hudText}>{'Hazard shown with red circle'}</Text>
          </View>
        </View>
        <View style={styles.tapHintBar}>
          <TouchableOpacity onPress={handleNextClip} activeOpacity={0.85}>
            <Text style={[styles.tapHintText, { color: Colors.indigo, fontWeight: '700' }]}>
              {isLast ? 'See Results →' : 'Next Clip →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────

  const total = calculateHazardTotal(clipResults);
  const xpEarned = 20 + (total.passed ? 50 : 0);

  return (
    <>
    <OfflineBanner />
    <ScrollView style={[styles.bg, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.resultBadge, total.passed ? styles.passBadge : styles.failBadge]}>
        <Text style={styles.resultBadgeText}>{total.passed ? 'PASS' : 'FAIL'}</Text>
      </View>

      <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Practice Complete'}</Text>
      <Text style={[styles.totalScore, total.passed ? styles.passText : styles.failText]}>
        {total.score}
        {'/'}
        {total.maxScore}
      </Text>
      <Text style={[styles.bodyText, { color: theme.subTextColor }]}>
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

      <TouchableOpacity
        style={[styles.secondaryBtn, { width: '100%' as any, maxWidth: 480 }]}
        onPress={() => setShowShareCard(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryBtnText}>{'Share Result'}</Text>
      </TouchableOpacity>

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
    {activeCelebration && (
      <CelebrationModal event={activeCelebration} onDismiss={handleCelebDismiss} />
    )}
    {showShareCard && (
      <ShareCardModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        data={{ type: 'hazard', score: total.score, maxScore: total.maxScore, passed: total.passed }}
      />
    )}
    </>
  );
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return String(m) + ':' + s.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrollContent: { alignItems: 'center', padding: 24, gap: 16, paddingBottom: 40 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },

  heading: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center' },
  bodyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  clipCounter: { fontSize: 13, fontWeight: '700', color: Colors.indigo, letterSpacing: 0.5 },

  card: {
    width: '100%' as any,
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.indigo },
  stepText: { fontSize: 13, color: '#374151', flex: 1 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 72,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  primaryBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%' as any,
    maxWidth: 360,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  reminderBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    width: '100%' as any,
    maxWidth: 360,
  },
  reminderText: { fontSize: 14, color: '#D97706', textAlign: 'center', lineHeight: 20 },

  // Player — stays black
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
  tapHintBar: { backgroundColor: '#FFFFFF', paddingVertical: 12, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  tapHintText: { fontSize: 13, color: '#374151' },

  // Clip result card
  resultCard: {
    width: '100%' as any,
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  resultScore: { fontSize: 52, fontWeight: '900', color: '#111827' },
  resultScoreLabel: { fontSize: 14, color: '#6B7280' },
  hazardRow: {
    width: '100%' as any,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hazardLabel: { fontSize: 13, color: '#374151', flex: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotFilled: { backgroundColor: Colors.emerald },
  dotEmpty: { backgroundColor: '#E5E7EB' },

  // Results
  resultBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  passBadge: { backgroundColor: '#ECFDF5', borderColor: Colors.emerald },
  failBadge: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  resultBadgeText: { fontSize: 18, fontWeight: '900', color: '#111827' },
  totalScore: { fontSize: 48, fontWeight: '900' },
  passText: { color: Colors.emerald },
  failText: { color: '#EF4444' },
  xpBadge: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.indigo,
  },
  xpText: { fontSize: 15, fontWeight: '700', color: Colors.indigo },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  breakdownScore: { fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' as any, maxWidth: 480 },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.indigo,
  },
  secondaryBtnText: { color: Colors.indigo, fontSize: 16, fontWeight: '700' },

  comingSoonCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    marginHorizontal: 16,
    marginBottom: 24,
    maxWidth: 360,
    width: '90%' as any,
  },
  comingSoonEmoji: { fontSize: 48, fontWeight: '900', color: Colors.indigo },
});
