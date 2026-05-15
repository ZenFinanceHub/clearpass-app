import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CelebrationEvent, CELEBRATION_CONFIGS } from '@/src/celebrations';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIECE_COUNT = 30;

type PieceConfig = {
  id: number;
  x: number;
  size: number;
  color: string;
  isCircle: boolean;
  duration: number;
  delay: number;
};

// ── Confetti piece ─────────────────────────────────────────────────────────────

function ConfettiPiece({ cfg }: { cfg: PieceConfig }) {
  const fallAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let fallLoop: Animated.CompositeAnimation;
    let spinLoop: Animated.CompositeAnimation;

    const tid = setTimeout(() => {
      fallAnim.setValue(0);
      spinAnim.setValue(0);

      fallLoop = Animated.loop(
        Animated.timing(fallAnim, {
          toValue: 1,
          duration: cfg.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1100 + (cfg.id % 5) * 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      fallLoop.start();
      spinLoop.start();
    }, cfg.delay);

    return () => {
      clearTimeout(tid);
      fallLoop?.stop();
      spinLoop?.stop();
    };
  }, []);

  const translateY = fallAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-cfg.size - 10, SCREEN_H + 20],
  });
  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cfg.x,
        top: 0,
        width: cfg.size,
        height: cfg.size,
        borderRadius: cfg.isCircle ? cfg.size / 2 : 2,
        backgroundColor: cfg.color,
        transform: [{ translateY }, { rotate }],
        zIndex: 1,
      }}
    />
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function CelebrationModal({
  event,
  onDismiss,
}: {
  event: CelebrationEvent;
  onDismiss: () => void;
}) {
  const config = CELEBRATION_CONFIGS[event];

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Stable confetti pieces generated once
  const pieces = useMemo<PieceConfig[]>(() => {
    const colours = config.confettiColours;
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: i,
      x: 4 + ((i * (SCREEN_W - 8)) / PIECE_COUNT) + (Math.sin(i * 2.7) * 14),
      size: 7 + ((i * 7) % 8),
      color: colours[i % colours.length],
      isCircle: i % 3 === 0,
      duration: 2200 + ((i * 113) % 900),
      delay: (i * 37) % 1000,
    }));
  }, []);

  // Emoji bounce: 1 → 1.25 → 1, 3 iterations
  const bounceAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.28,
          duration: 360,
          easing: Easing.out(Easing.back(2.5)),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1.0,
          duration: 360,
          easing: Easing.in(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 },
    ).start();
  }, []);

  // Button fades in after 1 s
  const btnOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const tid = setTimeout(() => {
      Animated.timing(btnOpacity, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 1000);
    return () => clearTimeout(tid);
  }, []);

  // Auto-dismiss after 6 s
  useEffect(() => {
    const tid = setTimeout(() => onDismissRef.current(), 6000);
    return () => clearTimeout(tid);
  }, []);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onDismissRef.current()}>
      <View style={styles.backdrop}>
        {/* Confetti layer */}
        {pieces.map(p => (
          <ConfettiPiece key={p.id} cfg={p} />
        ))}

        {/* Card */}
        <View style={styles.card}>
          <Animated.Text
            style={[styles.emoji, { transform: [{ scale: bounceAnim }] }]}
          >
            {config.emoji}
          </Animated.Text>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>

          {config.xpBonus > 0 && (
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>{'+'}{config.xpBonus}{' XP'}</Text>
            </View>
          )}

          <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => onDismissRef.current()}
              activeOpacity={0.85}
            >
              <Text style={styles.dismissBtnText}>{'Awesome! 🎉'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 16,
  },

  emoji: {
    fontSize: 80,
    lineHeight: 96,
    textAlign: 'center',
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },

  xpBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    marginTop: 4,
  },
  xpBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D9488',
  },

  btnWrap: { width: '100%', marginTop: 8 },
  dismissBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
