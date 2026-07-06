import { StyleSheet } from 'react-native';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';

export default function RidesScreen() {
  return (
    <AppView style={styles.container}>
      <AppText type="title">Rides</AppText>
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
