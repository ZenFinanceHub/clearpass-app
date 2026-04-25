import { Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps;

export function ThemedText({ className, style, ...rest }: ThemedTextProps) {
  return <Text className={className} style={style} {...rest} />;
}
