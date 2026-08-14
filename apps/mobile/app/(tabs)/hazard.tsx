import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { DVSA_HAZARD_PASS_RATIO, HazardClip, HazardClipResult, HazardSessionResult, HazardWindow, UserProgress, calculateHazardTotal, scoreClip } from '@clearpass/core';
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
import { Pip } from '@/src/components/Pip';
import { HazardTimeline } from '@/src/components/HazardTimeline';
import { PaywallPrompt } from '@/src/components/PaywallPrompt';
import { usePipVisibility } from '@/src/PipVisibilityContext';

type Phase = 'info' | 'pre-clip' | 'player' | 'clip-result' | 'solution' | 'results';

/** Fisher-Yates shuffle, then swap the first slot away from `excludeId` if it landed there. */
function shuffleClipsAvoidingRepeat<T extends { id: string }>(clips: T[], excludeId: string | null): T[] {
  if (clips.length <= 1) return clips;
  const shuffled = [...clips];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (excludeId && shuffled[0]?.id === excludeId) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

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
// Sample real playback position on a fixed 50ms cadence instead of relying on
// the DOM 'timeupdate' event, whose firing rate the browser controls (not
// bounded below ~250ms in practice) — bounds worst-case staleness of the
// currentTime the RN side scores against to ~50ms, down from up to ~1s.
var tick = setInterval(function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'timeupdate', currentTime: v.currentTime }));
}, 50);
v.addEventListener('ended', function() {
  clearInterval(tick);
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
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

/**
 * Wraps any WebView/video element actually rendering hazard footage — the
 * scored clip AND the solution/reveal clip both use this. Hides the global
 * Pip FAB for exactly as long as this is mounted, tied to real video
 * playback rather than a hand-maintained list of phase names. A future
 * phase that plays video is covered automatically just by wrapping its
 * video element in this, instead of needing a separate gate kept in sync.
 */
function VideoSurface({ children }: { children: React.ReactNode }) {
  const { setHidden } = usePipVisibility();
  useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);
  return <>{children}</>;
}

/**
 * Shared detail view for a single clip's result — used both by the live
 * clip-result phase right after a clip ends, and by the end-of-session
 * "revisit" modal, so both render identically (including the timeline and
 * the unscorable-clip state) from a single source rather than two UIs that
 * could drift apart.
 */
function ClipResultDetail({ clip, result }: { clip: HazardClip; result: HazardClipResult }) {
  const theme = useTheme();

  if (!result.scorable) {
    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultScoreLabel}>{"This clip couldn't be scored"}</Text>
        <Text style={[styles.bodyText, { color: theme.subTextColor, textAlign: 'center' }]}>
          {"This clip is missing scoring data, so it won't count toward your total. Your other clips aren't affected."}
        </Text>
      </View>
    );
  }

  // No standalone tap-count line here: the timeline below already shows
  // every recorded tap per hazard (including too-early/too-late ones), and
  // a single clip-level count had no correct definition to give it — it
  // previously showed HazardClipResult.countedTaps, which deliberately
  // excludes out-of-window taps, so it could (and did) contradict the
  // timeline's "you tapped too early ×2" on the exact same screen.
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultScore}>
        {result.score}
        {' / '}
        {result.maxScore}
      </Text>
      <Text style={styles.resultScoreLabel}>{'Score for this clip'}</Text>
      {clip.hazards.map((hazard, i) => {
        const hazardResult = result.hazards[i];
        return (
          <View key={i} style={styles.hazardBlock}>
            <View style={styles.hazardRow}>
              <Text style={styles.hazardLabel}>
                {hazardResult.zeroed
                  ? 'Hazard ' + String(i + 1) + ': zeroed (too many taps this clip)'
                  : hazardResult.points > 0
                    ? 'Hazard ' + String(i + 1) + ': ' + String(hazardResult.points) + ' pts'
                    : 'Hazard ' + String(i + 1) + ': missed'}
              </Text>
            </View>
            <HazardTimeline hazard={hazard} clicks={result.clicks} result={hazardResult} />
          </View>
        );
      })}
    </View>
  );
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
  const lastTapAtRef = useRef<number>(0);
  const lastExitedClipIdRef = useRef<string | null>(null);
  const theme = useTheme();

  const [celebQueue, setCelebQueue] = useState<CelebrationEvent[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  // Index into clipResults/activeClips of the clip currently open in the
  // end-of-session "revisit" modal; null when closed.
  const [reviewClipIndex, setReviewClipIndex] = useState<number | null>(null);

  // Supabase clip loading
  const [clipsLoading, setClipsLoading] = useState(true);
  const [supabaseClips, setSupabaseClips] = useState<HazardClipMeta[]>([]);
  const [activeClips, setActiveClips] = useState(hazardClips);
  const [solutionVideoUrl, setSolutionVideoUrl] = useState<string | null>(null);
  const [singleClipMode, setSingleClipMode] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [warningAcked, setWarningAcked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadUserProgress().then(p => setUserProgress(p));
      void getHazardVideoList().then(clips => {
        setSupabaseClips(clips);
        setClipsLoading(false);
      });
    }, []),
  );

  function getClipStats(clipId: string): { best: number; max: number; attempts: number } | null {
    const entries = (userProgress?.hazardPerceptionHistory ?? []).filter(h => h.clipId === clipId);
    if (entries.length === 0) return null;
    const best = Math.max(...entries.map(e => e.score));
    const maxScore = entries.find(e => e.score === best)!.maxScore;
    return { best, max: maxScore, attempts: entries.length };
  }

  const clip = activeClips[clipIndex] ?? hazardClips[0];

  // Once every hazard's scoring window has closed, the rest of the clip (including any
  // solution/reveal footage baked into the same file) must not accept taps at all.
  const scoringWindowClosed =
    clip.hazards.length > 0 &&
    currentTime > Math.max(...clip.hazards.map((h: HazardWindow) => h.endSec));

  function handleVideoTap() {
    if (scoringWindowClosed) return;

    // A single physical tap should only ever add one entry. If this handler is
    // invoked twice for the same gesture (duplicate native dispatch), the second
    // call arrives within a handful of milliseconds — well under the time a real
    // finger-lift-and-repress takes (mobile double-tap recognition windows are
    // ~300ms+). Collapse anything under that into a single registered tap.
    const now = Date.now();
    const gapMs = now - lastTapAtRef.current;
    if (gapMs < 150) return;
    lastTapAtRef.current = now;

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
    if (!singleClipMode && clipIndex + 1 < totalClips) {
      setClipIndex((i) => i + 1);
      setClicks([]);
      setCurrentTime(0);
      setMuted(true);
      setSolutionVideoUrl(null);
      setWarningAcked(false);
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
      const newEntries: HazardSessionResult[] = singleClipMode
        ? results.map(r => ({
            date: new Date().toISOString(),
            score: r.score,
            maxScore: r.maxScore,
            passed: r.maxScore > 0 && r.score / r.maxScore >= DVSA_HAZARD_PASS_RATIO,
            clipId: r.clipId,
          }))
        : [{ date: new Date().toISOString(), score: total.score, maxScore: total.maxScore, passed: total.passed }];
      const updated = {
        ...progress,
        xp: (progress.xp ?? 0) + xp,
        hazardPerceptionHistory: [...(progress.hazardPerceptionHistory ?? []), ...newEntries],
      };
      await saveUserProgress(updated);
      setUserProgress(updated);

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
    if (singleClipMode) {
      setSingleClipMode(false);
      setPhase('info');
    } else {
      router.replace('/(tabs)/home');
    }
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
        if (singleClipMode) {
          setSingleClipMode(false);
          setPhase('info');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    }
  }

  function handleRestart() {
    if (singleClipMode) {
      setClipIndex(0);
      setClicks([]);
      setCurrentTime(0);
      setClipResults([]);
      setMuted(true);
      setWarningAcked(false);
      setPhase('pre-clip');
    } else {
      setPhase('info');
      setClipIndex(0);
      setClicks([]);
      setCurrentTime(0);
      setClipResults([]);
      setMuted(true);
    }
  }

  async function handleStartSingleClip(meta: HazardClipMeta) {
    const premium = await isPremium();
    if (!premium) { setShowPaywall(true); return; }
    const url = await getVideoUrl(meta.storage_path);
    const built = buildHazardClip(meta, url ?? '');
    setActiveClips([built]);
    setSingleClipMode(true);
    setClipIndex(0);
    setClicks([]);
    setCurrentTime(0);
    setClipResults([]);
    setMuted(true);
    setSolutionVideoUrl(null);
    setWarningAcked(false);
    setPhase('pre-clip');
  }

  async function handleStartPractice() {
    const premium = await isPremium();
    if (!premium) { setShowPaywall(true); return; }

    if (supabaseClips.length > 0) {
      const built = await Promise.all(
        supabaseClips.map(async (sc) => {
          const url = await getVideoUrl(sc.storage_path);
          return buildHazardClip(sc, url ?? '');
        }),
      );
      setActiveClips(shuffleClipsAvoidingRepeat(built, lastExitedClipIdRef.current));
    }
    setClipIndex(0);
    setClicks([]);
    setCurrentTime(0);
    setClipResults([]);
    setMuted(true);
    setWarningAcked(false);
    setPhase('pre-clip');
  }

  /** Bail out of the current clip without recording a result or affecting stats/progress. */
  function handleExitClip() {
    lastExitedClipIdRef.current = clip?.id ?? null;
    setSingleClipMode(false);
    setClicks([]);
    setCurrentTime(0);
    setMuted(true);
    setSolutionVideoUrl(null);
    setWarningAcked(false);
    setPhase('info');
  }

  // ── WEB GUARD ────────────────────────────────────────────────────────────
  // The web build has no ground-truth video clock (see WebVideoPlayer — its
  // `currentTime` is a setInterval stopwatch never synced to real playback),
  // so any score computed on web isn't trustworthy. Disable the feature
  // outright on web rather than present a score that may not reflect what
  // actually happened. Remove once the web player reads real position via
  // the YouTube IFrame API.

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.heading, { fontSize: theme.fontSize(24), fontFamily: theme.fontFamily, color: theme.textColor }]}>
          {'Mobile app only'}
        </Text>
        <Text style={[styles.bodyText, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {'Hazard Perception practice is only available in the ClearPass mobile app — open ClearPass on your phone to try it.'}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{'Go Back'}</Text>
        </TouchableOpacity>
        {/* Same store URLs as the existing "rate the app" flow in ipassed.tsx —
            not re-deciding them here. Both shown (not branched by platform)
            since a web visitor's device isn't known from Platform.OS === 'web'. */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => { Linking.openURL('https://apps.apple.com/app/clearpass-theory-test/id000000000').catch(() => {}); }}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{'Get it on the App Store'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => { Linking.openURL('https://play.google.com/store/apps/details?id=co.uk.getclearpass.app').catch(() => {}); }}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{'Get it on Google Play'}</Text>
        </TouchableOpacity>
      </View>
    );
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

    const attempted = (userProgress?.hazardPerceptionHistory ?? []).filter(h => h.clipId).length;
    return (
      <View style={styles.bg}>
        <OfflineBanner />
        <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundColor }} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Hazard Perception'}</Text>
          <Text style={[styles.sub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>{'Tap a clip to practise it, or run the full test'}</Text>

          <View style={styles.statsRow}>
            {([
              [String(supabaseClips.length), 'clips'],
              [String(attempted), 'played'],
              // No concrete session chosen yet on this browse screen (Practice
              // All vs a single clip have different maxScores), so this stays
              // a percentage — but rounded DOWN, never up: rounding up would
              // display a bar higher than the real 44/75 ratio, which can
              // tell a learner who just passed that they fell short.
              [`${Math.floor(DVSA_HAZARD_PASS_RATIO * 100)}%`, 'to pass'],
            ] as [string, string][]).map(([num, lbl]) => (
              <View key={lbl} style={styles.statPill}>
                <Text style={styles.statNum}>{num}</Text>
                <Text style={styles.statLabel}>{lbl}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleStartPractice()} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{'Practice All ({n} clips)'.replace('{n}', String(supabaseClips.length))}</Text>
          </TouchableOpacity>

          <View style={styles.grid}>
            {supabaseClips.map((meta, i) => {
              const stats = getClipStats(meta.id);
              const passed = stats && stats.best >= Math.ceil(stats.max * DVSA_HAZARD_PASS_RATIO);
              return (
                <TouchableOpacity
                  key={meta.id}
                  style={[styles.clipCard, stats ? (passed ? styles.clipCardPassed : styles.clipCardFailed) : null]}
                  onPress={() => void handleStartSingleClip(meta)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.clipNum}>{'#' + String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.clipCardTitle} numberOfLines={2}>{meta.title}</Text>
                  {stats ? (
                    <View style={styles.clipScoreRow}>
                      <Text style={[styles.clipScoreNum, passed ? styles.passText : styles.failText]}>
                        {stats.best + '/' + stats.max}
                      </Text>
                      <Text style={styles.clipAttempts}>{stats.attempts + '×'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.clipNotAttempted}>{'Not played'}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Modal visible={showPaywall} transparent animationType="fade" onRequestClose={() => setShowPaywall(false)}>
          <View style={styles.paywallOverlay}>
            <PaywallPrompt
              onUpgrade={() => { setShowPaywall(false); router.push('/paywall'); }}
              onDismiss={() => setShowPaywall(false)}
            />
          </View>
        </Modal>
      </View>
    );
  }

  // ── PRE-CLIP ─────────────────────────────────────────────────────────────

  if (phase === 'pre-clip') {
    // activeClips is set (single clip or the full shuffled practice set)
    // before entering this phase, so this reflects the session actually
    // about to be played — not a hardcoded, possibly-wrong session size.
    const sessionMaxScore = activeClips.reduce((sum, c) => sum + c.hazards.length * 5, 0);
    const sessionPassScore = Math.ceil(sessionMaxScore * DVSA_HAZARD_PASS_RATIO);
    return (
      <View style={[styles.bg, styles.centerFill, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleExitClip} activeOpacity={0.85}>
          <Text style={styles.exitBtnText}>{'← Exit'}</Text>
        </TouchableOpacity>
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{clip.title}</Text>
        <Text style={[styles.bodyText, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, color: theme.subTextColor }]}>{clip.description}</Text>
        <View style={[styles.reminderBox, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Pip size={44} mood="teaching" />
          <Text style={[styles.reminderText, { flex: 1 }]}>
            {`Spot each developing hazard early — score up to 5 points based on how quickly you react. Click too early, too late, or spam the screen and you'll score 0. You need ${sessionPassScore}/${sessionMaxScore} to pass.`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.ackRow}
          onPress={() => setWarningAcked((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.ackBox, warningAcked && styles.ackBoxChecked]}>
            {warningAcked && <Text style={styles.ackCheck}>{'✓'}</Text>}
          </View>
          <Text style={styles.ackText}>{'I understand — I will only tap when I spot a hazard'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, !warningAcked && styles.primaryBtnDisabled]}
          disabled={!warningAcked}
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
    // Widened to `string` — the WEB GUARD above already returns before `phase`
    // can reach 'player' on web, which makes TS prove this branch is currently
    // unreachable for 'web' and flag the literal comparison as redundant. Kept
    // as a runtime check (not deleted) so the WebVideoPlayer branch is intact
    // and reachable again the moment the web guard is lifted.
    if ((Platform.OS as string) !== 'web') {
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
          <VideoSurface>{videoContent}</VideoSurface>

          {/* Tap overlay — disabled outright once scoring windows have closed, so
              taps during any reveal footage register nothing at all. */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
            activeOpacity={1}
            disabled={scoringWindowClosed}
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

          {/* Exit */}
          <TouchableOpacity style={styles.exitBtnPlayer} onPress={handleExitClip} activeOpacity={0.85}>
            <Text style={styles.exitBtnPlayerText}>{'← Exit'}</Text>
          </TouchableOpacity>

          {/* Mute toggle */}
          <TouchableOpacity style={styles.muteBtn} onPress={handleMuteToggle}>
            <Text style={styles.muteBtnText}>{muted ? '[ mute ]' : '[ sound ]'}</Text>
          </TouchableOpacity>

          {/* HUD — deliberately shows no tap count or score-shaped number here.
              The clip position isn't tap-reactive; nothing in this bar changes
              in response to a tap, so it can't be used to infer scoring. */}
          <View style={styles.hud} pointerEvents="none">
            <Text style={styles.hudText}>
              {clipIndex + 1}
              {'/'}
              {activeClips.length > 0 ? activeClips.length : hazardClips.length}
            </Text>
            <Text style={styles.hudText}>{formatTime(currentTime)}</Text>
          </View>
        </View>

        <View style={styles.tapHintBar}>
          <Text style={styles.tapHintText}>
            {scoringWindowClosed ? 'Scoring closed for this clip' : 'Tap anywhere to mark a hazard'}
          </Text>
        </View>
      </View>
    );
  }

  // ── CLIP RESULT ──────────────────────────────────────────────────────────

  if (phase === 'clip-result') {
    const result = clipResults[clipResults.length - 1];
    const isLast = clipIndex + 1 === hazardClips.length;
    return (
      <ScrollView
        style={[styles.bg, { backgroundColor: theme.backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.clipCounter}>
          {'Clip '}
          {clipIndex + 1}
          {' of '}
          {hazardClips.length}
        </Text>
        <Text style={[styles.heading, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>{clip.title}</Text>

        <ClipResultDetail clip={clip} result={result} />

        {supabaseClips[clipIndex]?.has_solution_clip && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleWatchSolution} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>{'Watch Solution'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleNextClip} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{isLast ? 'See Results' : 'Next Clip'}</Text>
        </TouchableOpacity>
      </ScrollView>
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
            <VideoSurface>
              <WebView
                key={`solution-${clipIndex}`}
                source={{ html: solHtml }}
                style={StyleSheet.absoluteFillObject}
                scrollEnabled={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onMessage={() => handleNextClip()}
              />
            </VideoSurface>
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
  // Minimum whole-number score that clears DVSA_HAZARD_PASS_RATIO for THIS
  // session's actual maxScore — e.g. 44/75 x 25 = 14.67, so 15 is the real
  // pass mark for a 25-point session, not a rounded percentage.
  const sessionPassScore = Math.ceil(total.maxScore * DVSA_HAZARD_PASS_RATIO);
  const reviewClip = reviewClipIndex !== null ? activeClips[reviewClipIndex] : null;
  const reviewResult = reviewClipIndex !== null ? clipResults[reviewClipIndex] : null;

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
          : `Keep practising — aim for ${sessionPassScore}/${total.maxScore} or above.`}
      </Text>

      <View style={styles.xpBadge}>
        <Text style={styles.xpText}>{'+' + String(xpEarned) + ' XP earned'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'Clip Breakdown'}</Text>
        {clipResults.map((r, i) => (
          <TouchableOpacity
            key={r.clipId}
            style={styles.breakdownRow}
            onPress={() => setReviewClipIndex(i)}
            activeOpacity={0.7}
          >
            <Text style={styles.breakdownLabel} numberOfLines={1}>
              {'Clip '}
              {i + 1}
              {': '}
              {activeClips[i]?.title ?? 'Unknown'}
            </Text>
            {r.scorable ? (
              <Text style={[styles.breakdownScore, r.score > 0 ? styles.passText : styles.failText]}>
                {r.score}
                {'/'}
                {r.maxScore}
              </Text>
            ) : (
              <Text style={[styles.breakdownScore, { color: theme.subTextColor }]}>{'Not scored'}</Text>
            )}
            <Text style={styles.breakdownChevron}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {clipResults.some((r) => !r.scorable) && (
        <Text style={[styles.bodyText, { color: theme.subTextColor, textAlign: 'center' }]}>
          {'One or more clips were missing scoring data and were excluded from your total above.'}
        </Text>
      )}

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
    {reviewClip && reviewResult && (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setReviewClipIndex(null)}
      >
        <View style={styles.reviewOverlay}>
          <View style={[styles.reviewCard, { backgroundColor: theme.cardColor }]}>
            <Text
              style={[styles.heading, { fontSize: theme.fontSize(20), fontFamily: theme.fontFamily, color: theme.textColor }]}
              numberOfLines={1}
            >
              {reviewClip.title}
            </Text>
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewScrollContent}>
              <ClipResultDetail clip={reviewClip} result={reviewResult} />
            </ScrollView>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setReviewClipIndex(null)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  paywallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  reviewCard: {
    width: '100%' as any,
    maxWidth: 480,
    maxHeight: '80%' as any,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  reviewScroll: { flexGrow: 0 },
  reviewScrollContent: { gap: 16, paddingBottom: 4 },

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
  primaryBtnDisabled: { opacity: 0.4 },

  ackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%' as any,
    maxWidth: 360,
  },
  ackBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackBoxChecked: { backgroundColor: Colors.indigo },
  ackCheck: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  ackText: { fontSize: 13, color: '#374151', flex: 1 },

  exitBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 5,
    backgroundColor: Colors.cardWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exitBtnText: { fontSize: 12, fontWeight: '600', color: Colors.mutedText },

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
  exitBtnPlayer: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exitBtnPlayerText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
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
  hazardBlock: {
    width: '100%' as any,
    gap: 6,
  },
  hazardRow: {
    width: '100%' as any,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hazardLabel: { fontSize: 13, color: '#374151', flex: 1 },

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
  breakdownChevron: { fontSize: 15, color: '#9CA3AF', fontWeight: '600', marginLeft: 6 },
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

  // Clip grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' as any, maxWidth: 480, marginTop: 4 },
  clipCard: {
    width: '47%' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  clipCardPassed: { borderColor: '#10B981', borderWidth: 1.5, backgroundColor: '#F0FDF4' },
  clipCardFailed: { borderColor: '#F87171', borderWidth: 1.5, backgroundColor: '#FFF5F5' },
  clipNum: { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 0.5 },
  clipCardTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  clipScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  clipScoreNum: { fontSize: 14, fontWeight: '800' },
  clipAttempts: { fontSize: 11, color: '#9CA3AF' },
  clipNotAttempted: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

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
