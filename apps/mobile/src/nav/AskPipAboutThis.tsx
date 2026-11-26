import React from 'react';
import { router } from 'expo-router';
import { useNetwork } from '@/src/NetworkContext';
import { Button } from '@/src/ui';
import { ASK_PIP_LABEL, askPipAboutQuestion, type AskPipQuestion } from './askPip';

/**
 * "Ask Pip about this" for one incorrect question on a results screen
 * (ui_v2 only; callers gate it on `uiV2`). Opens the existing tutor with the
 * question prefilled. Disabled offline, like the Learn hub's Ask Pip entry.
 */
export function AskPipAboutThis({ question, selectedIndex, from, onBeforeNavigate, testID }: {
  question: AskPipQuestion;
  selectedIndex: number | null;
  from: string;
  /** e.g. mock.tsx marks that it's leaving for the tutor (keeps its results on return). */
  onBeforeNavigate?: () => void;
  testID?: string;
}) {
  const { isOffline } = useNetwork();
  return (
    <Button
      label={isOffline ? 'Ask Pip (needs internet)' : ASK_PIP_LABEL}
      variant="outline"
      icon="chatbubble-ellipses-outline"
      iconPosition="left"
      disabled={isOffline}
      accessibilityLabel={`${ASK_PIP_LABEL}: ${question.questionText}`}
      testID={testID}
      style={{ alignSelf: 'flex-start', marginTop: 6 }}
      onPress={() => {
        onBeforeNavigate?.();
        router.push(askPipAboutQuestion(question, selectedIndex, from) as never);
      }}
    />
  );
}
