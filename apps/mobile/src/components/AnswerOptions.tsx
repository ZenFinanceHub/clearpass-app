import React, { useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Question, isImageChoiceQuestion } from '@clearpass/core';
import { Colors } from '@/src/constants/theme';
import { useTheme } from '@/src/theme';

export const LABELS = ['A', 'B', 'C', 'D'];

export function AnswerOptions({
  question,
  selectedIndex,
  onSelect,
  disabled = false,
  isAnswered = false,
  highContrast = false,
  ttsEnabled = false,
  animateOnPress = false,
}: {
  question: Question;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  isAnswered?: boolean;
  highContrast?: boolean;
  ttsEnabled?: boolean;
  animateOnPress?: boolean;
}) {
  const theme = useTheme();
  const imageChoice = isImageChoiceQuestion(question);
  const scales = useRef(question.options.map(() => new Animated.Value(1))).current;

  function handlePress(idx: number, optionLabel: string) {
    if (isAnswered) {
      if (ttsEnabled) {
        Speech.stop();
        Speech.speak(optionLabel, { language: 'en-GB' });
      }
      return;
    }
    if (animateOnPress) {
      Animated.sequence([
        Animated.timing(scales[idx], { toValue: 0.95, duration: 70, useNativeDriver: true }),
        Animated.spring(scales[idx], { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }),
      ]).start();
    }
    onSelect(idx);
  }

  return (
    <View style={imageChoice ? styles.imageGrid : styles.textList}>
      {question.options.map((option, idx) => {
        const isCorrect = idx === question.correctIndex;
        const isSelected = idx === selectedIndex;

        let cardStyle: object = styles.optionDefault;
        let badgeStyle: object = styles.badgeDefault;
        let textStyle: object = styles.optionTextDefault;
        let badgeTextStyle: object = styles.badgeTextDefault;

        if (isAnswered) {
          if (isCorrect) {
            cardStyle = styles.optionCorrect; badgeStyle = styles.badgeCorrect;
            textStyle = styles.optionTextCorrect; badgeTextStyle = styles.badgeTextColored;
          } else if (isSelected) {
            cardStyle = styles.optionWrong; badgeStyle = styles.badgeWrong;
            textStyle = styles.optionTextWrong; badgeTextStyle = styles.badgeTextColored;
          } else {
            cardStyle = styles.optionDimmed; textStyle = styles.optionTextDimmed;
          }
        } else if (isSelected) {
          // Pre-answer "selected" highlight — Mock Test's only state (it never
          // reveals correctness); the other 4 screens go straight from
          // unanswered to isAnswered=true in one tap, so they never render this.
          cardStyle = styles.optionSelected;
        }

        const isDisabled = disabled || (isAnswered && !ttsEnabled);
        const contrastBorder = highContrast
          ? { borderWidth: 2, borderColor: isAnswered ? undefined : theme.borderColor }
          : undefined;

        const badge = (
          <View style={[styles.badge, badgeStyle]}>
            <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
          </View>
        );
        const textNode = (
          <Text
            style={[
              styles.optionText,
              textStyle,
              { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing },
            ]}
          >
            {option}
          </Text>
        );

        if (imageChoice) {
          return (
            <Animated.View key={idx} style={[styles.imageOptionWrap, { transform: [{ scale: scales[idx] }] }]}>
              <TouchableOpacity
                style={[styles.imageOption, cardStyle, contrastBorder]}
                onPress={() => handlePress(idx, option)}
                activeOpacity={isDisabled ? 1 : 0.75}
                disabled={isDisabled}
                accessibilityLabel={option}
                accessibilityRole="button"
              >
                {badge}
                <Image source={{ uri: question.optionImages![idx] }} style={styles.optionImage} resizeMode="contain" />
              </TouchableOpacity>
            </Animated.View>
          );
        }

        return (
          <Animated.View key={idx} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={[styles.textOption, cardStyle, contrastBorder]}
              onPress={() => handlePress(idx, option)}
              activeOpacity={isDisabled ? 1 : 0.75}
              disabled={isDisabled}
            >
              {badge}
              {textNode}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  textList: { gap: 10 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  imageOptionWrap: { width: '48%' },
  textOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  imageOption: {
    width: '100%', borderRadius: 16, borderWidth: 1, padding: 8, alignItems: 'center',
  },
  optionImage: { width: '100%', height: 110, marginTop: 6 },
  optionDefault:  { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  optionSelected: { backgroundColor: Colors.indigoBg, borderColor: Colors.indigo, borderWidth: 2 },
  optionCorrect:  { backgroundColor: Colors.emeraldBg, borderColor: Colors.emerald, borderWidth: 2 },
  optionWrong:    { backgroundColor: Colors.redBg, borderColor: Colors.red, borderWidth: 2 },
  optionDimmed:   { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeDefault:   { backgroundColor: Colors.surfaceGray },
  badgeCorrect:   { backgroundColor: Colors.emerald },
  badgeWrong:     { backgroundColor: Colors.red },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeTextDefault: { color: Colors.mutedText },
  badgeTextColored: { color: Colors.cardWhite },
  optionText: { flex: 1, lineHeight: 22 },
  optionTextDefault: { color: Colors.textPrimary },
  optionTextCorrect: { color: Colors.emerald, fontWeight: '600' },
  optionTextWrong:   { color: Colors.red, fontWeight: '600' },
  optionTextDimmed:  { color: Colors.subtleText },
});
