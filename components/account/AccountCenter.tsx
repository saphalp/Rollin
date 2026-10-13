import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteMyAccount, loadSocialLinks, removeSocialLink, saveSocialLink, setDeactivated, updatePrivacy } from '@/lib/account-center';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/social-links';
import { supabase } from '@/lib/supabase';
import { useAccountState } from '@/lib/use-account-state';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AccountCenter({ gated = false }: { gated?: boolean }) {
    const colors = Colors[useColorScheme() ?? 'light'];
    const insets = useSafeAreaInsets();
    const { refreshProfile } = useAuthContext();
    const { account, checking, error: loadError, reload } = useAccountState();
    const [links, setLinks] = useState<Record<SocialPlatform, string>>({ instagram: '', linkedin: '', facebook: '' });
    const [linkLoading, setLinkLoading] = useState(false);
    const [busy, setBusy] = useState('');
    const busyRef = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirm, setConfirm] = useState<'deactivate' | 'delete' | null>(null);
    const [password, setPassword] = useState('');
    const [deleteWord, setDeleteWord] = useState('');
    const userId = account?.user_id;
    const locked = !!account?.deactivated || !!account?.deleting;
    useEffect(() => {
        let active = true;
        setLinks({ instagram: '', linkedin: '', facebook: '' }); setPassword(''); setDeleteWord(''); setConfirm(null); setError(''); setNotice('');
        if (!userId || locked) { setLinkLoading(false); return; }
        setLinkLoading(true);
        void loadSocialLinks(userId).then(rows => {
            if (!active) return;
            const values = { instagram: '', linkedin: '', facebook: '' };
            for (const row of rows) values[row.platform] = row.url;
            setLinks(values);
        }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLinkLoading(false); });
        return () => { active = false; };
    }, [userId, locked]);
    async function run(key: string, task: () => Promise<unknown>) {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(key); setError(''); setNotice('');
        try { await task(); await reload(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Unable to save. Please retry.'); }
        finally { busyRef.current = false; setBusy(''); }
    }
    function closeConfirmation() { if (busyRef.current) return; setConfirm(null); setPassword(''); setDeleteWord(''); }
    const button = (label: string, onPress: () => void, disabled = false, destructive = false) => (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || !!busy }} disabled={disabled || !!busy} onPress={onPress}
            style={[styles.button, { borderColor: destructive ? colors.error : colors.tint, opacity: disabled || busy ? 0.5 : 1 }]}>
            <AppText style={{ color: destructive ? colors.error : colors.tint, fontWeight: '600' }}>{label}</AppText>
        </Pressable>
    );
    if (checking) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} /></View>;
    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 12, borderColor: colors.outlineVariant }]}>
                {!gated && button('‹ Back', () => router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
                <AppText style={[styles.title, { color: colors.text, fontFamily: Fonts?.sans }]}>Account Center</AppText>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
                {!!(error || loadError) && <View style={styles.section}><AppText accessibilityRole="alert" style={{ color: colors.error }}>{error || loadError}</AppText>{button('Retry', () => void reload())}</View>}
                {!!notice && <AppText accessibilityLiveRegion="polite" style={{ color: colors.tint }}>{notice}</AppText>}
                {!!busy && <ActivityIndicator color={colors.tint} />}
                {!account ? <AppText style={{ color: colors.text }}>Sign in to manage your account.</AppText> : <>
                    <AppText style={{ color: colors.outline }}>{account.email}</AppText>
                    {locked && <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                        <AppText style={[styles.heading, { color: colors.text }]}>{account.deleting ? 'Deletion needs to finish' : 'Your account is deactivated'}</AppText>
                        <AppText style={{ color: colors.text }}>{account.deleting ? 'Some files may already be removed. Retry deletion to finish removing your account.' : 'Your profile and posted activities, rides, and photos are hidden. Reactivate to use Rollin again.'}</AppText>
                        {!account.deleting && button('Reactivate Account', () => void run('reactivate', async () => { await setDeactivated(false, account.user_id); await refreshProfile(); setNotice('Account reactivated.'); }))}
                    </View>}
                    {!locked && <>
                        <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                            <AppText style={[styles.heading, { color: colors.text }]}>Privacy Settings</AppText>
                            <View style={styles.toggleRow}><View style={styles.flex}><AppText style={{ color: colors.text, fontWeight: '600' }}>Private profile</AppText><AppText style={[styles.caption, { color: colors.text }]}>Only you and accepted followers can see your profile details. Your name and avatar remain visible so people can request access.</AppText></View>
                                <Switch accessibilityLabel="Private profile" value={account.is_private} disabled={!!busy || !!loadError} onValueChange={value => void run('privacy', async () => { await updatePrivacy(value, account.show_social_links, account.user_id); await refreshProfile(); setNotice('Privacy saved.'); })} trackColor={{ true: colors.tint }} />
                            </View>
                            <View style={styles.toggleRow}><View style={styles.flex}><AppText style={{ color: colors.text, fontWeight: '600' }}>Show social accounts</AppText><AppText style={[styles.caption, { color: colors.text }]}>Show your social links to people allowed to view your profile.</AppText></View>
                                <Switch accessibilityLabel="Show social accounts" value={account.show_social_links} disabled={!!busy || !!loadError} onValueChange={value => void run('social-privacy', async () => { await updatePrivacy(account.is_private, value, account.user_id); await refreshProfile(); setNotice('Social-link visibility saved.'); })} trackColor={{ true: colors.tint }} />
                            </View>
                            <AppText style={[styles.caption, { color: colors.outline }]}>Privacy does not revoke photo URLs already shared from public storage.</AppText>
                        </View>
                        <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                            <AppText style={[styles.heading, { color: colors.text }]}>Linked Social Accounts</AppText>
                            {linkLoading ? <ActivityIndicator color={colors.tint} /> : SOCIAL_PLATFORMS.map(platform => <View key={platform} style={styles.field}>
                                <AppText style={{ color: colors.text, textTransform: 'capitalize', fontWeight: '600' }}>{platform}</AppText>
                                <TextInput accessibilityLabel={`${platform} profile URL`} value={links[platform]} onChangeText={value => setLinks(previous => ({ ...previous, [platform]: value }))}
                                    editable={!busy && !loadError} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={512} placeholder={platform === 'linkedin' ? 'https://linkedin.com/in/your-name' : `https://${platform}.com/your-name`}
                                    placeholderTextColor={colors.outline} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />
                                <View style={styles.actions}>
                                    {button('Save', () => void run(`save-${platform}`, async () => { await saveSocialLink(account.user_id, platform, links[platform]); setNotice(`${platform} link saved.`); }), !links[platform].trim() || !!loadError)}
                                    {button('Remove', () => void run(`remove-${platform}`, async () => { await removeSocialLink(account.user_id, platform); setLinks(previous => ({ ...previous, [platform]: '' })); setNotice('Link removed.'); }), !!loadError, true)}
                                </View>
                            </View>)}
                        </View>
                        <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                            <AppText style={[styles.heading, { color: colors.text }]}>Share Profile</AppText>
                            <AppText style={[styles.caption, { color: colors.text }]}>Sharing a link does not make a private profile public.</AppText>
                            <View style={styles.actions}>
                                {button('Copy Link', () => void run('copy', async () => { await Clipboard.setStringAsync(Linking.createURL(`shared-profile/${account.user_id}`)); setNotice('Profile link copied.'); }), !!loadError)}
                                {button('Share', () => void run('share', () => Share.share({ message: Linking.createURL(`shared-profile/${account.user_id}`) })), !!loadError)}
                            </View>
                        </View>
                        <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                            <AppText style={[styles.heading, { color: colors.text }]}>Deactivate Account</AppText>
                            <AppText style={[styles.caption, { color: colors.text }]}>Hide your account temporarily and keep your data. Sign in and choose Reactivate Account to return.</AppText>
                            {button('Deactivate Account', () => setConfirm('deactivate'), !!loadError, true)}
                        </View>
                    </>}
                    <View style={[styles.section, { borderColor: colors.outlineVariant }]}>
                        <AppText style={[styles.heading, { color: colors.error }]}>Delete Account</AppText>
                        <AppText style={[styles.caption, { color: colors.text }]}>Permanently remove your account, profile, social links, uploads, hosted activities, offered rides, and related participation and chat records. Posts and conversations attached to your hosted activities are also removed. This cannot be undone.</AppText>
                        {button(account.deleting ? 'Retry Deletion' : 'Delete Account', () => setConfirm('delete'), !!loadError, true)}
                    </View>
                    {gated && button('Sign Out', () => void run('signout', () => supabase.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) throw error; })))}
                </>}
            </ScrollView>
            <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={closeConfirmation}>
                <View style={styles.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContainer}>
                    <View style={[styles.dialog, { backgroundColor: colors.cardBackground }]}>
                        <AppText style={[styles.heading, { color: colors.text }]}>{confirm === 'delete' ? 'Permanently delete account?' : 'Deactivate account?'}</AppText>
                        <AppText style={{ color: colors.text }}>{confirm === 'delete' ? 'Your data and uploads will be removed. Related posts and chats on your hosted activities will also be removed. Deletion cannot be undone; after it starts, retry if the connection fails.' : 'Your profile, posted activities, ride offers, and photos will be hidden. Your data stays saved for reactivation. Finish any ongoing ride first.'}</AppText>
                        {confirm === 'delete' && <>
                            <TextInput accessibilityLabel="Current password" placeholder="Current password" placeholderTextColor={colors.outline} secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} editable={!busy} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />
                            <TextInput accessibilityLabel="Type DELETE to confirm" placeholder="Type DELETE" placeholderTextColor={colors.outline} autoCapitalize="characters" autoCorrect={false} value={deleteWord} onChangeText={setDeleteWord} editable={!busy} style={[styles.input, { color: colors.text, borderColor: colors.outlineVariant }]} />
                        </>}
                        {!!error && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>}
                        {button('Cancel', closeConfirmation)}
                        {button(busy ? 'Working…' : confirm === 'delete' ? 'Delete Permanently' : 'Deactivate', () => {
                            const deleting = confirm === 'delete';
                            void run(deleting ? 'delete' : 'deactivate', async () => {
                                if (deleting) { try { await deleteMyAccount(password, deleteWord, account!.user_id); } finally { setPassword(''); setDeleteWord(''); } }
                                else { await setDeactivated(true, account!.user_id); await supabase.auth.signOut({ scope: 'local' }); }
                                setConfirm(null);
                            });
                        }, confirm === 'delete' && (!password || deleteWord !== 'DELETE'), true)}
                    </View>
                </ScrollView></View>
            </Modal>
        </View>
    );
}
const styles = StyleSheet.create({
    screen: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    title: { fontSize: 21, fontWeight: '700', flexShrink: 1 }, content: { padding: 20, gap: 18 },
    section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 14 },
    heading: { fontSize: 18, fontWeight: '700' }, caption: { fontSize: 13, lineHeight: 20 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 }, field: { gap: 10 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 15, alignItems: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }, modalContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    dialog: { padding: 22, borderRadius: 18, gap: 16 },
});
