import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { BACK_BUTTON_SIZE, BackButton } from '@/components/ui/back-button';

// Longest cancellation message the host can write.
const MAX_LENGTH = 500;

// Screen where a host cancels their event and (optionally) explains why.
export default function CancelActivityScreen() {
  // The activity ID comes from the URL: /activity/cancel/[id]
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  // What the host types, and whether the cancel request is in progress.
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = text.trim();
  // The message is optional, so the button only turns off while sending.
  const canSend = !sending;

  // Ask "are you sure?" before cancelling, since it can't be undone.
  function confirmCancel() {
    if (!canSend || !id) return;
    Alert.alert(
      'Cancel this event?',
      "Everyone who joined will be notified. This can't be undone.",
      [
        { text: 'Keep Event', style: 'cancel' },
        { text: 'Cancel Event', style: 'destructive', onPress: () => void handleCancel() },
      ],
    );
  }

  // Calls the cancel-activity edge function, which marks the event
  // cancelled and notifies everyone who RSVP'd.
  async function handleCancel() {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-activity', {
        body: { activityId: id, message: trimmed },
      });
      if (error) throw new Error('Could not cancel the event. Please try again.');

      Alert.alert('Event cancelled', 'Everyone who joined has been notified.');
      // Go back to the activity page, which will now show it as cancelled.
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppView style={styles.container}>
      {/* Header: back button + title */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.outlineVariant,
            backgroundColor: colors.background,
          },
        ]}
      >
        <BackButton />

        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          Cancel Event
        </AppText>

        {/* Empty box so the title stays centered */}
        <View style={styles.backButton} />
      </View>

      {/* Keeps the text box above the keyboard */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Optional cancellation message */}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Let everyone know why (optional)..."
          placeholderTextColor={colors.outline}
          multiline
          maxLength={MAX_LENGTH}
          editable={!sending}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.cardBackground,
              borderColor: colors.outlineVariant,
            },
          ]}
        />

        {/* Character counter */}
        <AppText style={[styles.counter, { color: colors.outline }]}>
          {text.length}/{MAX_LENGTH}
        </AppText>

        {/* Red Cancel Event button (shows a spinner while sending) */}
        <TouchableOpacity
          onPress={confirmCancel}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { backgroundColor: colors.error, opacity: canSend ? 1 : 0.5 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.onError} />
          ) : (
            <AppText style={[styles.sendText, { color: colors.onError }]}>
              Cancel Event
            </AppText>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  body: { flex: 1, padding: 16 },
  input: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: 6, fontSize: 12 },
  sendButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 16, fontWeight: '600' },
});