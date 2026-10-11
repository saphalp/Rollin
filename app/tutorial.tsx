import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useGuidedTour } from '@/components/tutorial/guided-tour-provider';

export default function TutorialScreen() {
  const { start } = useGuidedTour();
  useEffect(() => { start(); }, [start]);
  return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Opening tutorial" /></View>;
}
