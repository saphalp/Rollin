import { FlatList, StyleSheet, View } from 'react-native';

import {
  ExplorePostCard,
  type ExplorePost,
} from '@/components/explore/explore-post-card';
import { sampleExplorePosts } from '@/components/explore/sample-posts';

export default function ExploreScreen() {
  const renderPost = ({ item }: { item: ExplorePost }) => {
    return <ExplorePostCard post={item} />;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sampleExplorePosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.postList}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 24,
  },
});