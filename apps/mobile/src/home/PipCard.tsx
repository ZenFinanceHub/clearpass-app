import React from 'react';
import { View } from 'react-native';
import { Pip, type PipMood } from '@/src/components/Pip';
import { useDesignTheme } from '@/src/design';
import { Card, Text } from '@/src/ui';
import type { PipPose } from './homeViewModel';

/** View-model pose (asset name) -> existing Pip mood key. Every pose is an existing PNG. */
export const POSE_TO_MOOD: Record<PipPose, PipMood> = {
  celebrating: 'celebrate',
  encouraging: 'sympathetic',
  neutral: 'happy',
  sleepy: 'sleepy',
  streak: 'streak',
  teaching: 'teaching',
  thinking: 'curious',
};

const POSE_FRAME_SCALE: Partial<Record<PipPose, number>> = { encouraging: 1.7 };

/**
 * Contextual Pip encouragement. Uses the original Pip artwork via the
 * existing <Pip> component (assets/pip/*.png), unaltered. No entrance
 * animation, so nothing to gate on reduced motion.
 */
export function PipCard({ pose, title, message, compact }: { pose: PipPose; title: string; message: string; compact?: boolean }) {
  const { colors } = useDesignTheme();
  const size = compact ? 60 : 76;
  return (
    <Card surface="brandSubtle" elevation="flat" padding={14} testID="pip-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Pip the hedgehog"
          style={{ width: size, height: Math.round(size * 1.2), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Some poses carry a lot of transparent padding in the artwork
              itself; show them larger inside a fixed frame (the PNG is not altered). */}
          <Pip size={Math.round(size * (POSE_FRAME_SCALE[pose] ?? 1))} mood={POSE_TO_MOOD[pose]} />
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg.card,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <Text variant="bodyStrong" weight={700}>{title}</Text>
          <Text variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{message}</Text>
        </View>
      </View>
    </Card>
  );
}
