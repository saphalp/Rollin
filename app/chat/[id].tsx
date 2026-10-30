import ConversationHeader from '@/components/chats/ConversationHeader';
import MessageBubble from '@/components/chats/MessageBubble';
import MessageInput from '@/components/chats/MessageInput';
import SharedContentBubble from '@/components/chats/SharedContentBubble';
import { ChatError } from '@/components/chats/chat-error';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useChatConversation } from '@/hooks/use-chat-conversation';
import { useAuthContext } from '@/hooks/use-auth-context';
import { messageReadLabel } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, useColorScheme, type ScrollViewInstance } from 'react-native';

export default function ChatConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const { claims } = useAuthContext();
  // A different account or chat gets a fresh composer and scroll position.
  return <Conversation key={`${claims?.sub}:${params.id}`} {...params} />;
}

function Conversation({ id, name, avatar }: { id: string; name?: string; avatar?: string }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const chat = useChatConversation(id);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const scrollRef = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);
  const latest = chat.messages.at(-1);
  const latestRef = useRef(chat);
  useEffect(() => { latestRef.current = chat; }, [chat]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (chat.userId) {
      void supabase.from('muted_conversations').select('conversation_id').eq('conversation_id', id)
        .eq('user_id', chat.userId).maybeSingle().then(({ data }) => { if (active) setMuted(!!data); });
    }
    return () => { active = false; };
  }, [id, chat.userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const current = latestRef.current;
      const last = current.messages.at(-1);
      if (next === 'active' && atBottom.current && last) void current.markRead(last.id);
    });
    return () => subscription.remove();
  }, []);

  async function toggleMute() {
    if (!chat.userId || muteBusy) return;
    setMuteBusy(true);
    const { error } = muted
      ? await supabase.from('muted_conversations').delete().eq('conversation_id', id).eq('user_id', chat.userId)
      : await supabase.from('muted_conversations').insert({ conversation_id: id, user_id: chat.userId });
    if (error) Alert.alert('Could not update notifications', 'Please try again.');
    else setMuted(!muted);
    setMuteBusy(false);
  }
  function markVisibleRead() {
    if (atBottom.current && latest) void chat.markRead(latest.id);
  }
  async function send() {
    if (await chat.send(input)) {
      setInput(''); atBottom.current = true;
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }
  function loadOlder() { atBottom.current = false; void chat.loadOlder(); }

  return <AppView style={styles.container}>
    {/* Include the custom header so keyboard measurements start at the screen origin. */}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
    <ConversationHeader name={name ?? 'Chat'} avatar={{ uri: avatar ?? '' }} muted={muted} onToggleMute={toggleMute}
      onPressProfile={chat.info?.otherUserId ? () => router.push(`/profile/${chat.info!.otherUserId}`)
        : chat.info?.activity_id ? () => router.push(`/activity/${chat.info!.activity_id}`) : undefined} />
      <ChatError message={chat.error} onRetry={chat.refresh} />
      <ChatError message={chat.readError} onRetry={markVisibleRead} />
      {chat.loading ? <ActivityIndicator color={colors.tint} style={styles.container} /> :
        <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onLayout={() => {
            if (atBottom.current) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }} scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (atBottom.current) { scrollRef.current?.scrollToEnd({ animated: false }); markVisibleRead(); }
          }}
          onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
            atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 40;
            markVisibleRead();
          }}>
          <ChatError message={chat.historyError} onRetry={loadOlder} />
          {chat.loaded && chat.hasOlder && chat.messages.length > 0 && (
            <Pressable onPress={loadOlder} disabled={chat.loadingOlder} accessibilityRole="button" style={styles.historyButton}>
              <AppText style={{ color: colors.tint, fontWeight: '700' }}>{chat.loadingOlder ? 'Loading older messages…' : 'Load older messages'}</AppText>
            </Pressable>
          )}
          {chat.loaded && !chat.messages.length && <AppText style={styles.notice}>No messages yet. Say hello!</AppText>}
          {chat.messages.map((message, index) => {
            const fromMe = message.sender_id === chat.userId;
            const senderName = !fromMe && chat.info?.type === 'group' ? message.senderName : undefined;
            const read = chat.userId && chat.info ? messageReadLabel(message, chat.userId, chat.info.type, chat.info.receipts) : undefined;
            const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + (read ? ` · ${read}` : '');
            const date = new Date(message.created_at).toLocaleDateString();
            const previousDate = index ? new Date(chat.messages[index - 1].created_at).toLocaleDateString() : '';
            return <Fragment key={message.id}>
              {date !== previousDate && <AppText style={[styles.date, { color: colors.icon }]}>{new Date(message.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</AppText>}
              {message.type === 'activity' && message.sharedActivity ?
                <SharedContentBubble kind="activity" fromMe={fromMe} time={time} senderName={senderName}
                  title={message.sharedActivity.title} hostName={message.sharedActivity.hostName} imageUrl={message.sharedActivity.imageUrl}
                  onPress={() => router.push(`/activity/${message.sharedActivity!.id}`)} /> :
              message.type === 'post' && message.sharedPost ?
                <SharedContentBubble kind="post" fromMe={fromMe} time={time} senderName={senderName}
                  posterName={message.sharedPost.posterName} caption={message.sharedPost.caption} imageUrl={message.sharedPost.imageUrl}
                  onPress={() => router.push(`/post/${message.sharedPost!.id}`)} /> :
                <MessageBubble text={message.type === 'text' ? message.content ?? '' : 'This shared content is no longer available.'}
                  fromMe={fromMe} time={time} senderName={senderName}
                  onPressSender={!fromMe ? () => router.push(`/profile/${message.sender_id}`) : undefined} />}
            </Fragment>;
          })}
        </ScrollView>}
      <ChatError message={chat.sendError} onRetry={() => void send()} />
      {chat.info?.is_archived ? <AppText style={styles.notice}>This conversation is archived. You can still read its history.</AppText> :
        <MessageInput value={input} onChangeText={setInput} onSend={() => void send()}
          keyboardVisible={keyboardVisible}
          disabled={!chat.loaded || !!chat.error || chat.sending} sending={chat.sending} />}
    </KeyboardAvoidingView>
  </AppView>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, messages: { paddingVertical: 12, gap: 4 },
  historyButton: { alignSelf: 'center', padding: 14 },
  date: { textAlign: 'center', fontSize: 12, paddingVertical: 8 },
  notice: { textAlign: 'center', padding: 20 },
});
