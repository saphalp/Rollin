import { AppText } from '@/components/text';
import { loadSocialLinks, subscribeAccountChanges } from '@/lib/account-center';
import { normalizeSocialLink, type SocialPlatform } from '@/lib/social-links';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
export function ProfileSocialLinks({ userId }: { userId: string }) {
    const [links, setLinks] = useState<{ platform: SocialPlatform; url: string }[]>([]);
    const [error, setError] = useState('');
    const generation = useRef(0);
    const reload = useCallback(async () => {
        const request = ++generation.current;
        try {
            const rows = await loadSocialLinks(userId);
            const valid = rows.filter(row => { try { return normalizeSocialLink(row.platform, row.url) === row.url; } catch { return false; } });
            if (request === generation.current) { setLinks(valid); setError(''); }
        } catch { if (request === generation.current) setLinks([]); }
    }, [userId]);
    useFocusEffect(useCallback(() => { setLinks([]); void reload(); return () => { ++generation.current; }; }, [reload]));
    useEffect(() => subscribeAccountChanges(() => void reload()), [reload]);
    if (!links.length) return null;
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {links.map(link => <Pressable key={link.platform} accessibilityRole="link" onPress={() => { void Linking.openURL(link.url).catch(() => setError('Unable to open this link.')); }}>
            <AppText style={{ textTransform: 'capitalize', textDecorationLine: 'underline' }}>{link.platform}</AppText>
        </Pressable>)}
        {!!error && <AppText accessibilityRole="alert">{error}</AppText>}
    </View>;
}
