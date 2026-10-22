import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { AppText } from '@/components/text';
import { loadSocialLinks, subscribeAccountChanges } from '@/lib/account-center';
import { normalizeSocialLink, type SocialPlatform } from '@/lib/social-links';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

const SOCIAL_ICON: Record<SocialPlatform, { name: React.ComponentProps<typeof FontAwesome5>['name']; color: string }> = {
  instagram: { name: 'instagram', color: '#E1306C' },
  facebook:  { name: 'facebook',  color: '#1877F2' },
  linkedin:  { name: 'linkedin',  color: '#0A66C2' },
};

export function ProfileSocialLinks({ userId }: { userId: string }) {
  const [links, setLinks] = useState<{ platform: SocialPlatform; url: string }[]>([]);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      const rows = await loadSocialLinks(userId);
      const valid = rows.filter(row => {
        try { return normalizeSocialLink(row.platform, row.url) === row.url; } catch { return false; }
      });
      if (request === generation.current) { setLinks(valid); setError(''); }
    } catch { if (request === generation.current) setLinks([]); }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    setLinks([]);
    void reload();
    return () => { ++generation.current; };
  }, [reload]));

  useEffect(() => subscribeAccountChanges(() => void reload()), [reload]);

  if (!links.length) return null;

  return (
    <View style={styles.row}>
      {links.map(link => {
        const icon = SOCIAL_ICON[link.platform];
        return (
          <Pressable
            key={link.platform}
            accessibilityRole="link"
            accessibilityLabel={link.platform}
            onPress={() => { void Linking.openURL(link.url).catch(() => setError('Unable to open this link.')); }}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <FontAwesome5 name={icon.name} size={26} color={icon.color} brand />
          </Pressable>
        );
      })}
      {!!error && <AppText accessibilityRole="alert">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'center' },
  iconBtn: { padding: 4 },
});
