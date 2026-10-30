import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useActivityPosts } from '@/hooks/use-activity-posts';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ActivityPostsSection({ activityId }: { activityId: string }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { posts, loading, error, hasMore, refresh, loadMore } = useActivityPosts(activityId);
  return (
    <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant }]}>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Explore posts</AppText>
        <TouchableOpacity accessibilityRole="button" onPress={refresh} disabled={loading} style={styles.button}>
          <AppText style={{ color: colors.tint, fontWeight: '600' }}>Refresh</AppText>
        </TouchableOpacity>
      </View>
      <AppText style={{ color: colors.icon }}>Posts tagged with this activity.</AppText>
      {posts.map(post => (
        <TouchableOpacity key={post.id} accessibilityRole="button"
          accessibilityLabel={`Open post by ${post.userName}${post.caption ? `: ${post.caption}` : ''}`}
          onPress={() => router.push(`/post/${post.id}`)}
          style={[styles.post, { borderColor: colors.outlineVariant }]}>
          {post.imageUrls[0] && <Image source={{ uri: post.imageUrls[0] }} style={styles.image} contentFit="cover" />}
          <View style={styles.content}>
            <AppText style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{post.userName}</AppText>
            <AppText style={{ color: colors.icon, fontSize: 12 }}>{new Date(post.createdAt).toLocaleDateString()}</AppText>
            <AppText style={{ color: colors.text }} numberOfLines={3}>{post.caption || 'View photos'}</AppText>
            {post.imageUrls.length > 1 && <AppText style={{ color: colors.tint, fontSize: 12 }}>{post.imageUrls.length} photos</AppText>}
          </View>
        </TouchableOpacity>
      ))}
      {loading && <ActivityIndicator accessibilityLabel="Loading Explore posts" color={colors.tint} style={styles.loader} />}
      {!!error && <View style={styles.feedback}>
        <AppText accessibilityRole="alert" style={{ color: colors.text }}>{error}</AppText>
        <TouchableOpacity accessibilityRole="button" onPress={refresh} style={[styles.retry, { backgroundColor: colors.tint }]}>
          <AppText style={{ color: colors.onPrimary, fontWeight: '600' }}>Retry</AppText>
        </TouchableOpacity>
      </View>}
      {!loading && !error && posts.length === 0 && <AppText style={[styles.feedback, { color: colors.icon }]}>No posts to show yet.</AppText>}
      {!loading && hasMore && <TouchableOpacity accessibilityRole="button" onPress={loadMore} style={styles.button}>
        <AppText style={{ color: colors.tint, fontWeight: '600', textAlign: 'center' }}>Load more posts</AppText>
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: '700' },
  button: { paddingHorizontal: 8, paddingVertical: 12, minHeight: 44 },
  post: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  image: { width: 88, height: 104, borderRadius: 10 },
  content: { flex: 1, gap: 4 },
  feedback: { paddingVertical: 12, gap: 12 },
  retry: { borderRadius: 22, padding: 12, alignItems: 'center' },
  loader: { paddingVertical: 16 },
});
