import { AppText } from '@/components/text';
import { useAuthContext } from '@/hooks/use-auth-context';
import { supabase } from '@/lib/supabase';
import { useAccountState } from '@/lib/use-account-state';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { AccountCenter } from './AccountCenter';

// Keep the navigator mounted so Expo Router can handle navigation.
export function AccountStateGate({ children }: { children: ReactNode }) {
    const { isLoading, isLoggedIn, needsEmailVerification } = useAuthContext();
    const pathname = usePathname();

    // Don't check account status before login verification or during password reset.
    const shouldCheckAccount = !isLoading && isLoggedIn && !needsEmailVerification && pathname !== '/reset-password';

    return <>
        {children}
        {shouldCheckAccount && <AccountStateCheck />}
    </>;
}

// This component (and its database hook) mounts only after verification.
function AccountStateCheck() {
    const { account, checking, error, reload } = useAccountState();
    const blocked = checking || !!error || !!account?.deactivated || !!account?.deleting;

    return <>
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
