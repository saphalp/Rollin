import { AppText } from '@/components/text';
import { supabase } from '@/lib/supabase';
import { useAccountState } from '@/lib/use-account-state';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { AccountCenter } from './AccountCenter';
// Inside Auth/SafeArea providers. Keep the navigator mounted so Expo Router can redirect.
export function AccountStateGate({ children }: { children: ReactNode }) {
    const { account, checking, error, reload } = useAccountState();
    const blocked = checking || !!error || !!account?.deactivated || !!account?.deleting;
    return <>
        {children}
        {blocked && <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={() => { }}>
            {checking ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
                : error ? <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
                    <AppText accessibilityRole="alert">Unable to check account status. {error}</AppText>
                    <Pressable accessibilityRole="button" onPress={() => void reload()}><AppText>Retry</AppText></Pressable>
                    <Pressable accessibilityRole="button" onPress={() => { void supabase.auth.signOut({ scope: 'local' }).then(() => reload()); }}><AppText>Sign Out</AppText></Pressable>
                </View> : <AccountCenter gated />}
        </Modal>}
    </>;
}
