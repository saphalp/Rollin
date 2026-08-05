import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ExplorePost = {
  id: string;
  userName: string;
  profileImage: string;
  timePosted: string;
  category: string;
  description: string;
  eventImage: string;
  eventType: 'public' | 'private';
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type ExplorePostCardProps = {
  post: ExplorePost;
  onPress?: () => void;
};

export function ExplorePostCard({ post, onPress }: ExplorePostCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const initials = post.userName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        {avatarFailed || !post.profileImage ? (
          <View style={[styles.profileImage, styles.initialsCircle, { backgroundColor: avatarColor(post.userName) }]}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: post.profileImage }}
            style={styles.profileImage}
            onError={() => setAvatarFailed(true)}
            contentFit="cover"
          />
        )}

        <View style={styles.userInformation}>
          <Text style={styles.userName}>{post.userName}</Text>
          <Text style={styles.timePosted}>{post.timePosted}</Text>
        </View>

        {post.eventType === 'private' && (
          <View style={styles.privateBadge}>
            <MaterialCommunityIcons name="lock-outline" size={11} color="#FFFFFF" />
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{post.category}</Text>
        </View>
      </View>

      <Text style={styles.description}>{post.description}</Text>

      <Image
        source={{ uri: post.eventImage }}
        style={styles.eventImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 14,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 45,
    height: 45,
    borderRadius: 23,
    marginRight: 10,
  },
  initialsCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userInformation: {
    flex: 1,
  },
  userName: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  timePosted: {
    color: '#8A8A8A',
    fontSize: 12,
    marginTop: 2,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4B5563',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  privateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    maxWidth: '48%',
    backgroundColor: '#F5A000',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    color: '#222222',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 10,
  },
  eventImage: {
    width: '100%',
    height: 190,
    borderRadius: 6,
    backgroundColor: '#DDDDDD',
  },
});
