import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';

export default function ModalScreen() {
  return (
    <AppView style={styles.container}>
      <AppText type="title">This is a modal</AppText>
      <Link href="/" dismissTo style={styles.link}>
        <AppText type="link">Go to home screen</AppText>
      </Link>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
