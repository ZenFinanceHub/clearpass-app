import React from 'react';
import { Animated, Image, PanResponder, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePipVisibility } from '@/src/PipVisibilityContext';
import {
  FAB_SIZE,
  fromStored,
  parseStoredFabPos,
  snapFab,
  toStored,
  type FabBounds,
  type StoredFabPos,
} from '@/src/pipFabPosition';

// Tightly cropped from pip-neutral@3x: the shared Pip art has a lot of empty
// margin, which shrinks him to a speck inside a 52px button.
const PIP_FAB_IMAGE = require('../../assets/pip/pip-fab.png');

const STORAGE_KEY = '@clearpass/pip_fab_position';
// Room kept clear at the bottom for the tab bar.
const BOTTOM_RESERVED = 90;
// Movement (px) before a touch counts as a drag rather than a tap.
const DRAG_THRESHOLD = 6;

/**
 * Floating "Ask Pip" button. Tap to open Pip; drag to move it out of the way.
 * It snaps to the nearer side of the screen and remembers where it was left.
 */
export function PipFab({ defaultTop }: { defaultTop: number }) {
  const segments = useSegments();
  const { hidden } = usePipVisibility();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const bounds: FabBounds = React.useMemo(() => {
    const minY = insets.top + 8;
    return { width, minY, maxY: Math.max(minY, height - insets.bottom - FAB_SIZE - BOTTOM_RESERVED) };
  }, [width, height, insets.top, insets.bottom]);

  const defaultStored = React.useMemo<StoredFabPos>(
    () => toStored({ side: 'right', y: defaultTop }, bounds),
    // The default is only a starting point; it doesn't follow later layout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stored = React.useRef<StoredFabPos>(defaultStored);
  const current = React.useRef(fromStored(defaultStored, bounds));
  const pos = React.useRef(new Animated.ValueXY(current.current)).current;
  const dragStart = React.useRef({ x: 0, y: 0 });
  // Set when a touch turned into a drag, so the press that web fires on release
  // (a click on the same element) doesn't also open Pip.
  const dragged = React.useRef(false);

  const place = React.useCallback((p: { x: number; y: number }) => {
    current.current = p;
    pos.setValue(p);
  }, [pos]);

  // Restore the saved spot once.
  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const saved = parseStoredFabPos(raw);
      if (!cancelled && saved) {
        stored.current = saved;
        place(fromStored(saved, bounds));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep it on screen when the window changes (rotation, resize, keyboard-less web).
  React.useEffect(() => {
    place(fromStored(stored.current, bounds));
  }, [bounds, place]);

  const panResponder = React.useMemo(() => {
    const moved = (g: { dx: number; dy: number }) => Math.abs(g.dx) + Math.abs(g.dy) > DRAG_THRESHOLD;
    const finish = (g: { dx: number; dy: number }) => {
      const s = snapFab(dragStart.current.x + g.dx, dragStart.current.y + g.dy, bounds);
      current.current = { x: s.x, y: s.y };
      stored.current = toStored(s, bounds);
      Animated.spring(pos, { toValue: { x: s.x, y: s.y }, useNativeDriver: false, friction: 7 }).start();
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored.current)).catch(() => {});
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => { dragged.current = false; return false; },
      onMoveShouldSetPanResponder: (_e, g) => moved(g),
      onMoveShouldSetPanResponderCapture: (_e, g) => moved(g),
      onPanResponderGrant: () => { dragged.current = true; dragStart.current = { ...current.current }; },
      onPanResponderMove: (_e, g) => {
        pos.setValue({ x: dragStart.current.x + g.dx, y: dragStart.current.y + g.dy });
      },
      onPanResponderRelease: (_e, g) => finish(g),
      onPanResponderTerminate: (_e, g) => finish(g),
      onPanResponderTerminationRequest: () => false,
    });
  }, [bounds, pos]);

  if (hidden || (segments as string[]).includes('tutor')) return null;

  // Derived from the current route rather than hardcoded: this button is
  // reachable from nearly every screen in the app.
  const currentPath = '/' + (segments as string[]).join('/');

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.shadow, { transform: pos.getTranslateTransform() }]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (dragged.current) { dragged.current = false; return; }
          router.push({ pathname: '/tutor', params: { from: currentPath } } as any);
        }}
        accessibilityLabel="Ask Pip"
        accessibilityHint="Opens Pip. You can drag this button to move it."
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <Image source={PIP_FAB_IMAGE} style={styles.image} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Shadow on the outer view: iOS drops shadows on a view with overflow hidden.
  shadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  // White behind the current Pip artwork: the navy character disappears on the
  // old indigo fill at this size. The indigo ring keeps the brand.
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 40, height: 40 },
});
