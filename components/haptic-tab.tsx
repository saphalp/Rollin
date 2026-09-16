import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';

export function HapticTab(props: React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
