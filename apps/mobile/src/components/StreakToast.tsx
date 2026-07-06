import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Pip } from './Pip';
import { Colors } from '@/src/constants/theme';

export function StreakToast({ days, onHide }: { days: number; onHide: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onHide(); });
  }, []);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Pip size={36} mood="streak" />
      <View style={styles.textCol}>
        <Text style={styles.title}>{days}-day streak!</Text>
        <Text style={styles.sub}>
          {days >= 100 ? 'Triple digits — legendary.' : 'Two weeks strong — keep going.'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: Colors.indigo,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  textCol: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sub: { color: '#E0E7FF', fontSize: 12, marginTop: 1 },
});
