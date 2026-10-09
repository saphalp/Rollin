import { router } from 'expo-router';
import { Tutorial } from '@/components/tutorial/tutorial';

export default function TutorialScreen() {
  return <Tutorial onFinish={async () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }} />;
}
