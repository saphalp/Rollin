import ConversationHeader from '@/components/chats/ConversationHeader';
import ForwardSheet from '@/components/chats/ForwardSheet';
import MessageBubble from '@/components/chats/MessageBubble';
import MessageInput from '@/components/chats/MessageInput';
import SharedContentBubble from '@/components/chats/SharedContentBubble';
import { ChatError } from '@/components/chats/chat-error';
import { AppText } from '@/components/text';
import { AppView } from '@/components/view';
import { Colors } from '@/constants/theme';
import { useChatActions } from '@/hooks/use-chat-actions';
import { useChatConversation } from '@/hooks/use-chat-conversation';
import { useAuthContext } from '@/hooks/use-auth-context';
import { formatMessageDay, messageDay, messageReadLabel } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/services/messaging-service';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, View, useColorScheme, type ScrollViewInstance } from 'react-native';

export default function ChatConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const { claims } = useAuthContext();
  // A different account or chat gets a fresh composer and scroll position.
  return <Conversation key={`${claims?.sub}:${params.id}`} {...params} />;
}

function previewText(message: ChatMessage, deleted: boolean) {
  if (deleted) return 'This message was deleted';
  if (message.type === 'activity') return 'Shared an activity';
  if (message.type === 'post') return 'Shared a post';
  return message.content || 'Original message unavailable';
}

function Conversation({ id, name, avatar }: { id: string; name?: string; avatar?: string }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const chat = useChatConversation(id);
  const actions = useChatActions(id, chat.userId, chat.messages.map(message => message.id));
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardText, setForwardText] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const scrollRef = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);
  const latest = chat.messages.at(-1);
  const latestRef = useRef(chat);
  useEffect(() => { latestRef.current = chat; }, [chat]);

  const visibleMessages = useMemo(
    () => chat.messages.filter(message => !actions.hiddenIds.has(message.id)),
    [chat.messages, actions.hiddenIds]);
  const messageById = useMemo(() => new Map(chat.messages.map(message => [message.id, message])), [chat.messages]);
  const isDeleted = (message: ChatMessage) => !!message.deleted_for_everyone || actions.deletedIds.has(message.id);
  const pinnedMessage = visibleMessages.find(message => message.id === actions.pinnedId && !isDeleted(message));
  // Read receipts show once, under this user's most recent message.
  const lastOwnId = [...visibleMessages].reverse().find(message => message.sender_id === chat.userId)?.id;

  // Swipe left to reveal timestamps in the right gutter, then spring back.
  // Only claim horizontal gestures so vertical scrolling and taps still work.
  const [swipeOffset] = useState(() => new Animated.Value(0));
  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dx < -12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderMove: (_event, gesture) => { swipeOffset.setValue(Math.max(-78, Math.min(0, gesture.dx))); },
    onPanResponderRelease: () => { Animated.spring(swipeOffset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(); },
    onPanResponderTerminate: () => { Animated.spring(swipeOffset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(); },
  }), [swipeOffset]);

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
    const text = input.trim();
    const replyId = replyingTo?.id ?? null;
    if (await chat.send(text, replyId)) {
      // Keep anything typed while the send was in flight.
      setInput(current => current.trim() === text ? '' : current);
      setReplyingTo(current => current?.id === replyId ? null : current);
      atBottom.current = true;
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }
  function loadOlder() { atBottom.current = false; void chat.loadOlder(); }

  async function runAction(work: () => Promise<void>, title: string) {
    try { await work(); }
    catch (error) { Alert.alert(title, error instanceof Error ? error.message : 'Please try again.'); }
  }
  function confirmDelete(message: ChatMessage) {
    const fromMe = message.sender_id === chat.userId;
    const remove = (forEveryone: boolean) => {
      if (replyingTo?.id === message.id) setReplyingTo(null);
      void runAction(() => actions.deleteMessage(message.id, forEveryone), 'Could not delete message');
    };
    Alert.alert('Delete message', fromMe ? 'Choose who can no longer see this message.' : 'Remove this message from your chat only?', [
      { text: 'Delete for me', style: 'destructive', onPress: () => remove(false) },
      ...(fromMe ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => remove(true) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const headerName = chat.info?.title ?? name ?? 'Chat';
  return <AppView style={styles.container}>
    {/* Include the custom header so keyboard measurements start at the screen origin. */}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
    <ConversationHeader name={headerName} avatar={{ uri: chat.info?.avatarUri ?? avatar ?? '' }} muted={muted} onToggleMute={toggleMute}
      onPressProfile={chat.info?.otherUserId ? () => router.push(`/profile/${chat.info!.otherUserId}`)
        : chat.info?.activity_id ? () => router.push(`/activity/${chat.info!.activity_id}`) : undefined} />
      {pinnedMessage && (
        <View style={[styles.pinBanner, { backgroundColor: colors.surfaceContainerHigh, borderBottomColor: colors.outlineVariant }]}>
          <Ionicons name="pin" size={17} color={colors.tint} />
          <View style={styles.container}>
            <Text style={[styles.pinTitle, { color: colors.tint }]}>Pinned message</Text>
            <Text numberOfLines={1} style={{ color: colors.text }}>{previewText(pinnedMessage, false)}</Text>
          </View>
          <Pressable onPress={() => { void runAction(() => actions.togglePin(pinnedMessage.id), 'Could not change pin'); }}
            accessibilityLabel="Unpin message" hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.icon} />
          </Pressable>
        </View>
      )}
      <ChatError message={chat.error} onRetry={chat.refresh} />
      <ChatError message={chat.readError} onRetry={markVisibleRead} />
      {chat.loading ? <ActivityIndicator color={colors.tint} style={styles.container} /> :
        <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
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
          {chat.loaded && !visibleMessages.length && <AppText style={styles.notice}>No messages yet. Say hello!</AppText>}
          <Animated.View style={{ transform: [{ translateX: swipeOffset }] }} {...swipeResponder.panHandlers}>
          {visibleMessages.map((message, index) => {
            const fromMe = message.sender_id === chat.userId;
            const senderName = !fromMe && chat.info?.type === 'group' ? message.senderName : undefined;
            const onPressSender = !fromMe ? () => router.push(`/profile/${message.sender_id}`) : undefined;
            const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const read = message.id === lastOwnId && chat.userId && chat.info
              ? messageReadLabel(message, chat.userId, chat.info.type, chat.info.receipts) : undefined;
            const previous = visibleMessages[index - 1];
            const next = visibleMessages[index + 1];
            const showDate = !previous || messageDay(previous.created_at) !== messageDay(message.created_at);
            // Show the sender's avatar on the last message of each run from them.
            const showAvatar = !fromMe && (!next || next.sender_id !== message.sender_id
              || messageDay(next.created_at) !== messageDay(message.created_at));
            const deleted = isDeleted(message);
            const messageReactions = actions.reactions.filter(r => r.message_id === message.id);
            const reply = message.reply_to_message_id ? messageById.get(message.reply_to_message_id) : undefined;

            let bubble;
            if (deleted) {
              bubble = <View style={[styles.deletedRow, { justifyContent: fromMe ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.deletedText, { color: colors.icon, borderColor: colors.outlineVariant }]}>This message was deleted</Text>
              </View>;
            } else if (message.type === 'activity' && message.sharedActivity) {
              bubble = <SharedContentBubble kind="activity" fromMe={fromMe} time={time} showTime={false} senderName={senderName}
                onPressSender={onPressSender} title={message.sharedActivity.title} hostName={message.sharedActivity.hostName}
                imageUrl={message.sharedActivity.imageUrl} onPress={() => router.push(`/activity/${message.sharedActivity!.id}`)} />;
            } else if (message.type === 'post' && message.sharedPost) {
              bubble = <SharedContentBubble kind="post" fromMe={fromMe} time={time} showTime={false} senderName={senderName}
                onPressSender={onPressSender} posterName={message.sharedPost.posterName} caption={message.sharedPost.caption}
                imageUrl={message.sharedPost.imageUrl} onPress={() => router.push(`/post/${message.sharedPost!.id}`)} />;
            } else {
              const text = message.type === 'text' ? message.content ?? '' : 'This shared content is no longer available.';
              bubble = <MessageBubble text={text} fromMe={fromMe} time={time} showTime={false} senderName={senderName}
                avatarUri={message.senderAvatar} showAvatar={showAvatar} onPressSender={onPressSender}
                replyPreview={message.reply_to_message_id ? {
                  senderName: reply?.sender_id === chat.userId ? 'You' : reply?.senderName ?? "Rollin' User",
                  text: reply ? previewText(reply, isDeleted(reply)) : 'Original message unavailable',
                } : undefined}
                onReply={() => setReplyingTo(message)}
                onForward={() => setForwardText(text)}
                onPin={() => { void runAction(() => actions.togglePin(message.id), 'Could not change pin'); }}
                isPinned={actions.pinnedId === message.id}
                onDelete={() => confirmDelete(message)}
                reactions={[...new Set(messageReactions.map(r => r.emoji))].map(emoji => ({
                  emoji,
                  count: messageReactions.filter(r => r.emoji === emoji).length,
                  mine: messageReactions.some(r => r.emoji === emoji && r.user_id === chat.userId),
                }))}
                onReact={emoji => { void runAction(() => actions.react(message.id, emoji), 'Reaction failed'); }} />;
            }
            return <Fragment key={message.id}>
              {showDate && <View style={styles.dateDivider}>
                <Text style={[styles.dateLabel, { color: colors.icon, backgroundColor: colors.surfaceContainerHigh }]}>
                  {formatMessageDay(message.created_at)}
                </Text>
              </View>}
              <View style={styles.swipeRow}>
                <Text style={[styles.swipeTime, { color: colors.icon }]}>{time}</Text>
                {bubble}
              </View>
              {read && <AppText style={[styles.receipt, { color: colors.icon }]}>{read}</AppText>}
            </Fragment>;
          })}
          </Animated.View>
        </ScrollView>}
      <ChatError message={chat.sendError} onRetry={() => void send()} />
      {chat.info?.is_archived ? <AppText style={styles.notice}>This conversation is archived. You can still read its history.</AppText> :
        <MessageInput value={input} onChangeText={setInput} onSend={() => void send()}
          keyboardVisible={keyboardVisible}
          disabled={!chat.loaded || !!chat.error || chat.sending} sending={chat.sending}
          replyingTo={replyingTo ? {
            senderName: replyingTo.sender_id === chat.userId ? 'yourself' : replyingTo.senderName ?? headerName,
            text: previewText(replyingTo, isDeleted(replyingTo)),
          } : null}
          onCancelReply={() => setReplyingTo(null)} />}
    </KeyboardAvoidingView>
    <ForwardSheet text={forwardText} userId={chat.userId} onClose={() => setForwardText(null)} />
  </AppView>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, messages: { paddingVertical: 12, gap: 4 },
  historyButton: { alignSelf: 'center', padding: 14 },
  notice: { textAlign: 'center', padding: 20 },
  receipt: { alignSelf: 'flex-end', fontSize: 11, lineHeight: 14, paddingHorizontal: 16, marginTop: -2 },
  pinBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  pinTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  deletedRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 10 },
  deletedText: { fontSize: 13, fontStyle: 'italic', padding: 12, borderRadius: 16, borderWidth: 1 },
  dateDivider: { alignItems: 'center', paddingVertical: 12 },
  dateLabel: { fontSize: 12, fontWeight: '600', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  swipeRow: { width: '100%', position: 'relative' },
  // Sits past the right edge until the chat is swiped left.
  swipeTime: { position: 'absolute', right: -73, top: 0, bottom: 0, width: 68, textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '500' },
});
