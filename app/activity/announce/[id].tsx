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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppView } from '@/components/view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

const MAX_LENGTH = 1000;

export default function AnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending;

  async function handleSend() {
    if (!canSend || !id) return;
    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      const { data: announcement, error: insertError } = await supabase
        .from('announcements')
        .insert({ activity_id: id, author_id: user.id, body: trimmed })
        .select('id')
        .single();
      if (insertError || !announcement) {
        throw new Error('Could not post your announcement.');
      }

      const { error: pushError } = await supabase.functions.invoke('announce', {
        body: { announcementId: announcement.id },
      });

      if (pushError) {
        Alert.alert('Posted', 'Your announcement was posted, but notifications could not be sent.');
      } else {
        Alert.alert('Sent', 'Your announcement was sent to everyone who joined.');
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppView style={styles.container}>
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>

        <AppText style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
          New Announcement
        </AppText>

        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write an update for everyone who joined..."
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

        <AppText style={[styles.counter, { color: colors.outline }]}>
          {text.length}/{MAX_LENGTH}
        </AppText>

        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { backgroundColor: colors.tint, opacity: canSend ? 1 : 0.5 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <AppText style={[styles.sendText, { color: colors.onPrimary }]}>
              Send Announcement
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
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