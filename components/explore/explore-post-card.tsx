import { Image, StyleSheet, Text, View } from 'react-native';

export type ExplorePost = {
  id: string;
  userName: string;
  profileImage: string;
  timePosted: string;
  category: string;
  description: string;
  eventImage: string;
};

type ExplorePostCardProps = {
  post: ExplorePost;
};

export function ExplorePostCard({ post }: ExplorePostCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image
          source={{ uri: post.profileImage }}
          style={styles.profileImage}
        />

        <View style={styles.userInformation}>
          <Text style={styles.userName}>{post.userName}</Text>
          <Text style={styles.timePosted}>{post.timePosted}</Text>
        </View>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{post.category}</Text>
        </View>
      </View>

      <Text style={styles.description}>{post.description}</Text>

      <Image
        source={{ uri: post.eventImage }}
        style={styles.eventImage}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 14,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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