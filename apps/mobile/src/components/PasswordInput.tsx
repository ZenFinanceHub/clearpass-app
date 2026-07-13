import React, { useState } from 'react';
import { StyleProp, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  iconColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordInput({
  style,
  iconColor = '#9CA3AF',
  containerStyle,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[{ justifyContent: 'center' }, containerStyle]}>
      <TextInput
        {...rest}
        style={[style, { paddingRight: 44 }]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        style={{ position: 'absolute', right: 12 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
}
