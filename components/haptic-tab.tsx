<<<<<<< Updated upstream
import { PlatformPressable } from 'expo-router/react-navigation';
import { BottomTabBarButtonProps } from 'expo-router/tabs';
=======
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
>>>>>>> Stashed changes
import * as Haptics from 'expo-haptics';
import { PlatformPressable } from 'expo-router/react-navigation';
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
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
