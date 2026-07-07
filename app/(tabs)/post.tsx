import { StyleSheet } from 'react-native';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';

export default function PostScreen() {
  return (
    <AppView style={styles.container}>
      <AppText type="title">Post</AppText>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
