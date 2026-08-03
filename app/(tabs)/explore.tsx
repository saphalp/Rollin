import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  ExplorePostCard,
  type ExplorePost,
} from '@/components/explore/explore-post-card';
import { supabase } from '@/lib/supabase';

const CATEGORY_IMAGES: Record<string, string> = {
  social: 'https://picsum.photos/seed/social/900/500',
  sports: 'https://picsum.photos/seed/sports/900/500',
  music: 'https://picsum.photos/seed/music/900/500',
  study: 'https://picsum.photos/seed/study/900/500',
  outdoor: 'https://picsum.photos/seed/outdoor/900/500',
  gaming: 'https://picsum.photos/seed/gaming/900/500',
  grocery: 'https://picsum.photos/seed/grocery/900/500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function ExploreScreen() {
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchPosts() {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, title, category, description, image_url, created_at, host_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchPosts error:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!activities || activities.length === 0) {
      setPosts([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const hostIds = [...new Set(activities.map((a: any) => a.host_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', hostIds);

    const profileMap: Record<string, { full_name?: string; email?: string; profile_picture?: string }> =
      Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

    setPosts(activities.map((a: any) => {
      const profile = profileMap[a.host_id];
      const name = profile?.full_name
        ?? (profile?.email ? profile.email.split('@')[0] : null)
        ?? 'Rollin\' User';
      const avatarUrl = profile?.profile_picture
        ? supabase.storage.from('avatars').getPublicUrl(profile.profile_picture).data.publicUrl
        : '';
      return {
        id: a.id,
        userName: name,
        profileImage: avatarUrl,
        timePosted: a.created_at ? timeAgo(a.created_at) : '',
        category: a.category ? a.category.charAt(0).toUpperCase() + a.category.slice(1) : 'Activity',
        description: a.description ?? a.title,
        eventImage: a.image_url ?? CATEGORY_IMAGES[a.category] ?? 'https://picsum.photos/seed/activity/900/500',
      };
    }));

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchPosts(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <ExplorePostCard post={item} onPress={() => router.push(`/activity/${item.id}`)} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.postList}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },
  postList: {
    paddingBottom: 24,
  },
});
