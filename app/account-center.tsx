import { AccountCenter } from '@/components/account/AccountCenter';
import { Stack } from 'expo-router';
export default function AccountCenterScreen() {
  return <><Stack.Screen options={{ headerShown: false }} /><AccountCenter /></>;
}
