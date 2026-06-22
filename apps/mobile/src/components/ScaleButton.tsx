import React, { useRef } from 'react';
import { Animated, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

type Props = TouchableOpacityProps & {
  scaleDown?: number;
};

export function ScaleButton({ scaleDown = 0.97, style, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn(e: any) {
    Animated.spring(scale, { toValue: scaleDown, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
    onPressIn?.(e);
  }

  function handlePressOut(e: any) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
    onPressOut?.(e);
  }

  return (
    <TouchableOpacity
      style={[style, { transform: [{ scale }] }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
}
