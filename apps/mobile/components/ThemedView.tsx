import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps;

export function ThemedView({ className, style, ...rest }: ThemedViewProps) {
  return <View className={className} style={style} {...rest} />;
}
