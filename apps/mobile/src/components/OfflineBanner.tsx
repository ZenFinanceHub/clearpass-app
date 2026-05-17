import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const BANNER_H = 38;

export function OfflineBanner() {
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Seed with current state immediately (no slide on mount if already offline)
    void NetInfo.fetch().then((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      if (offline) heightAnim.setValue(BANNER_H);
    });

    const unsub = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      Animated.timing(heightAnim, {
        toValue: offline ? BANNER_H : 0,
        duration: 280,
        useNativeDriver: false,
      }).start();
    });

    return () => unsub();
  }, [heightAnim]);

  return (
    <Animated.View style={[styles.wrapper, { height: heightAnim }]}>
      <View style={styles.banner}>
        <Text style={styles.icon}>{'[~]'}</Text>
        <Text style={styles.text} numberOfLines={1}>
          {"You're offline — using cached content"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: '#0D9488',
  },
  banner: {
    height: BANNER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
