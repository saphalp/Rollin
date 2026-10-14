import { AppText } from '@/components/text';
import { subscribeAccountChanges } from '@/lib/account-center';
import { resolveAvatarUri } from '@/lib/profile/resolve-avatar-uri';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import AvatarCard from './AvatarCard';
import ProfileActionBar from './ProfileActionBar';
type Access = { id: string; full_name: string | null; profile_picture: string | null; is_private: boolean; can_view: boolean };
export function ProfilePrivacyGate({ userId, children }: { userId: string; children: ReactNode }) {
    const [access, setAccess] = useState<Access | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [followRequest, setRequest] = useState<{ id: string; status: string } | null>(null);
    const [followBusy, setFollowBusy] = useState(false);
    const generation = useRef(0);
    const reload = useCallback(async () => {
        const request = ++generation.current;
        setLoading(true); setError('');
        try {
            if (!userId) { if (request === generation.current) setAccess(null); return; }
            const { data, error } = await supabase.rpc('rollin_profile_access', { target_id: userId });
            if (error) throw error;
            const viewer = await supabase.auth.getSession();
            const actor = viewer.data.session?.user.id;
            let follow: { id: string; status: string } | null = null;
            if (actor && data?.[0] && !data[0].can_view) {
                const result = await supabase.from('follows').select('id,status').eq('follower_id', actor).eq('following_id', userId).maybeSingle();
                if (result.error) throw result.error;
                follow = result.data;
            }
            if (request === generation.current) { setAccess(data?.[0] ?? null); setRequest(follow); }
        } catch { if (request === generation.current) { setAccess(null); setError('Unable to check profile access.'); } }
        finally { if (request === generation.current) setLoading(false); }
    }, [userId]);
    useFocusEffect(useCallback(() => { void reload(); return () => { ++generation.current; }; }, [reload]));
    useEffect(() => {
        const off = subscribeAccountChanges(() => void reload());
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { ++generation.current; setAccess(null); setLoading(true); setTimeout(() => void reload(), 0); });
        const foreground = AppState.addEventListener('change', state => { if (state === 'active') void reload(); });
        return () => { ++generation.current; off(); subscription.unsubscribe(); foreground.remove(); };
    }, [reload]);
    async function toggleRequest() {
        if (followBusy) return;
        setFollowBusy(true); setError('');
        try {
            const identity = await supabase.auth.getUser();
            const actor = identity.data.user?.id;
            if (identity.error || !actor) throw new Error('Sign in first');
            if (followRequest?.id) {
                const removed = await supabase.from('follows').delete().eq('id', followRequest.id).eq('follower_id', actor);
                if (removed.error) throw removed.error;
            }
            if (followRequest?.status !== 'pending') {
                const added = await supabase.from('follows').insert({ follower_id: actor, following_id: userId, status: 'pending' });
                if (added.error) throw added.error;
            }
            await reload();
        } catch { setError('Unable to update follow request.'); }
        finally { setFollowBusy(false); }
    }
    if (loading) return <View style={{ flex: 1, padding: 24 }}><ActivityIndicator /></View>;
    if (error) return <View style={{ padding: 24, gap: 16 }}><AppText>{error}</AppText><Pressable onPress={() => void reload()}><AppText>Retry</AppText></Pressable></View>;
    if (!access) return <View style={{ padding: 24 }}><AppText>This profile is unavailable. Sign in to view an active profile.</AppText></View>;
    if (access.can_view) return <>{children}</>;
    return <View style={{ padding: 24, gap: 18 }}>
        <AvatarCard avatarImg={{ uri: resolveAvatarUri(access.profile_picture) }} verified={false} />
        <AppText style={{ fontSize: 22, fontWeight: '700' }}>{access.full_name ?? 'Rollin user'}</AppText>
        <AppText>This profile is private. Only accepted followers can see its details.</AppText>
        <ProfileActionBar isOwnProfile={false} followState={followRequest?.status === 'pending' ? 'requested' : 'not_following'} onFollowPress={() => { if (!followBusy) void toggleRequest(); }} />
        <Pressable accessibilityRole="button" onPress={() => void reload()}><AppText>Refresh access</AppText></Pressable>
    </View>;
}
