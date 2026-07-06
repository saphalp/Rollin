import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type AppViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function AppView({ style, lightColor, darkColor, ...rest }: AppViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  return <View style={[{ backgroundColor }, style]} {...rest} />;
}
