import { Colors, Fonts } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View, type PressableInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native-paper";

interface MessageBubbleProps {
  text: string;
  fromMe: boolean;
  time: string;
  showTime?: boolean;
  senderName?: string;
  onPressSender?: () => void;
  avatarUri?: string;
  showAvatar?: boolean;
  groupedWithPrevious?: boolean;
  reactions?: { emoji: string; count: number; mine: boolean }[];
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onForward?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  isPinned?: boolean;
  replyPreview?: { senderName: string; text: string };
}

export default function MessageBubble({
  text,
  fromMe,
  time,
  showTime = true,
  senderName,
  onPressSender,
  avatarUri,
  showAvatar = false,
  groupedWithPrevious = false,
  reactions = [],
  onReact,
  onReply,
  onForward,
  onPin,
  onDelete,
  isPinned = false,
  replyPreview,
}: MessageBubbleProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  // Where the pressed bubble sits on screen, and the measured menu layout used to line the
  // menu's copy of the message up with it.
  const [anchorY, setAnchorY] = useState(0);
  const [stackHeight, setStackHeight] = useState(0);
  const [previewOffset, setPreviewOffset] = useState<number | null>(null);
  const bubbleRef = useRef<PressableInstance>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const bubbleColor = fromMe ? colors.tint : colors.surfaceContainerHigh;
  const textColor = fromMe ? colors.onPrimary : colors.text;
  const timeColor = fromMe ? colors.onPrimary : colors.icon;

  const reactionChoices = ["❤️", "😆", "😮", "😢", "😡", "👍"];

  function chooseReaction(emoji: string) {
    setMenuVisible(false);
    onReact?.(emoji);
  }

  async function copyMessage() {
    await Clipboard.setStringAsync(text);
    setMenuVisible(false);
  }

  return (
    <>
      <View style={[styles.row, fromMe ? styles.rowMe : styles.rowThem, groupedWithPrevious ? styles.rowGrouped : styles.rowNewGroup]}>
        {!fromMe && (
          <View style={styles.avatarSlot}>
            {showAvatar && avatarUri ? (
              <Pressable
                onPress={onPressSender}
                disabled={!onPressSender}
                accessibilityRole={onPressSender ? "button" : undefined}
                accessibilityLabel="Open sender profile"
                hitSlop={6}
              >
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              </Pressable>
            ) : null}
          </View>
        )}
        {/* Hidden while the action menu shows its own copy, so the text isn't seen twice. */}
        <View style={[styles.messageColumn, fromMe ? styles.columnMe : styles.columnThem, reactions.length > 0 && styles.withReaction,
          menuVisible && styles.hidden]}>
          <Pressable
            ref={bubbleRef}
            onLongPress={() => {
              setMoreVisible(false);
              setPreviewOffset(null);
              bubbleRef.current?.measureInWindow((_x, y) => { setAnchorY(y); setMenuVisible(true); });
            }}
            delayLongPress={350}
            accessibilityHint="Long press to open message actions"
            style={[
              styles.bubble,
              reactions.length > 0 && styles.bubbleWithReaction,
              {
                backgroundColor: bubbleColor,
                borderBottomRightRadius: fromMe ? 4 : 18,
                borderBottomLeftRadius: fromMe ? 18 : 4,
              },
            ]}
          >
            {replyPreview && (
              <View style={[styles.replyQuote, { borderLeftColor: colors.tint, backgroundColor: colors.background }]}>
                <Text numberOfLines={1} style={[styles.replyAuthor, { color: colors.tint }]}>{replyPreview.senderName}</Text>
                <Text numberOfLines={2} style={[styles.replyText, { color: colors.text }]}>{replyPreview.text}</Text>
              </View>
            )}
            {senderName && (
              <Pressable onPress={onPressSender} disabled={!onPressSender} hitSlop={6}>
                <Text
                  style={[styles.senderName, { color: colors.tint, fontFamily: Fonts.sans }]}
                >
                  {senderName}
                </Text>
              </Pressable>
            )}
            <Text
              style={[styles.text, { color: textColor, fontFamily: Fonts.sans }]}
            >
              {text}
            </Text>
            {showTime && (
              <Text
                style={[
                  styles.time,
                  {
                    color: timeColor,
                    fontFamily: Fonts.sans,
                    opacity: fromMe ? 0.75 : 1,
                  },
                ]}
              >
                {time}
              </Text>
            )}
          </Pressable>
          {reactions.length > 0 && (
            <View style={[styles.reactionSummary, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.background }]}>
              <Text style={styles.reactionSummaryText} numberOfLines={1}>
                {reactions.slice(0, 2).map((reaction) => reaction.emoji).join("")}
                {reactions.reduce((total, reaction) => total + reaction.count, 0) > 1
                  ? ` ${reactions.reduce((total, reaction) => total + reaction.count, 0)}`
                  : ""}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setMenuVisible(false); setMoreVisible(false); }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setMenuVisible(false); setMoreVisible(false); }}
            accessibilityLabel="Close message actions"
          />
          <View
            onLayout={(event) => setStackHeight(event.nativeEvent.layout.height)}
            style={[
              styles.menuStack,
              fromMe ? styles.stackRight : styles.stackLeft,
              // Start with the copy over the original bubble, kept fully on screen.
              {
                marginTop: Math.max(insets.top + 8,
                  Math.min(anchorY - (previewOffset ?? 0), windowHeight - stackHeight - insets.bottom - 8)),
                opacity: previewOffset === null ? 0 : 1,
              },
            ]}
          >
            {!moreVisible && onReact && (
              <View style={styles.reactionChoices}>
                {reactionChoices.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={styles.reactionChoice}
                    accessibilityRole="button"
                    accessibilityLabel={`React ${emoji}`}
                    onPress={() => chooseReaction(emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {(
              <View
                onLayout={(event) => setPreviewOffset(event.nativeEvent.layout.y)}
                style={[styles.selectedMessageWrap, { backgroundColor: bubbleColor }]}
              >
                <Text numberOfLines={3} style={[styles.selectedMessage, { color: textColor, fontFamily: Fonts.sans }]}>{text}</Text>
              </View>
            )}
            <View style={styles.actionPanel}>
              {moreVisible ? (
                <>
                  <Pressable style={styles.actionRow} disabled={!onPin} onPress={() => { setMoreVisible(false); setMenuVisible(false); onPin?.(); }}>
                    <Text style={styles.actionLabel}>{isPinned ? "Unpin" : "Pin"}</Text>
                    <Ionicons name={isPinned ? "pin" : "pin-outline"} size={19} color="#e8e8e8" />
                  </Pressable>
                  <Pressable style={styles.actionRow} onPress={() => { setMoreVisible(false); setMenuVisible(false); onForward?.(); }} disabled={!onForward}>
                    <Text style={styles.actionLabel}>Forward</Text>
                    <Ionicons name="arrow-redo-outline" size={19} color="#e8e8e8" />
                  </Pressable>
                  <Pressable style={styles.actionRow} disabled={!onDelete} onPress={() => { setMoreVisible(false); setMenuVisible(false); onDelete?.(); }}>
                    <Text style={[styles.actionLabel, { color: "#ff7777" }]}>Delete</Text>
                    <Ionicons name="trash-outline" size={19} color="#ff7777" />
                  </Pressable>
                  <Pressable style={[styles.actionRow, styles.lastAction]} onPress={() => setMoreVisible(false)} accessibilityRole="button" accessibilityLabel="More message options">
                    <Text style={styles.actionLabel}>More</Text>
                    <Ionicons name="ellipsis-horizontal-circle-outline" size={19} color="#e8e8e8" />
                  </Pressable>
                </>
              ) : (
                <>
                  {onReply && (
                    <Pressable style={styles.actionRow} onPress={() => { setMenuVisible(false); onReply(); }}>
                      <Text style={styles.actionLabel}>Reply</Text>
                      <Ionicons name="arrow-undo-outline" size={19} color="#e8e8e8" />
                    </Pressable>
                  )}
                  <Pressable style={styles.actionRow} onPress={() => { void copyMessage(); }}>
                    <Text style={styles.actionLabel}>Copy</Text>
                    <Ionicons name="copy-outline" size={19} color="#e8e8e8" />
                  </Pressable>
                  {onForward && (
                    <Pressable style={[styles.actionRow, styles.lastAction]} onPress={() => setMoreVisible(true)}>
                      <Text style={styles.actionLabel}>More</Text>
                      <Ionicons name="ellipsis-horizontal-circle-outline" size={19} color="#e8e8e8" />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  replyQuote: { borderLeftWidth: 3, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  replyAuthor: { fontSize: 11, fontWeight: "700" },
  replyText: { fontSize: 12, lineHeight: 16 },
  reactionChoices: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingHorizontal: 8, paddingVertical: 10, borderRadius: 32,
    backgroundColor: "#333335", marginBottom: 10,
  },
  reactionChoice: { paddingHorizontal: 1, paddingVertical: 2 },
  reactionEmoji: { fontSize: 27 },
  // Messenger-style badge: overlap only the bubble's bottom edge.
  // The column reserves space underneath so the badge does not cover text.
  reactionSummary: {
    position: "absolute",
    bottom: 0,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 5,
    height: 26,
    maxWidth: "85%",
    zIndex: 2,
    elevation: 2,
  },
  reactionSummaryText: { fontSize: 13, lineHeight: 18 },
  modalRoot: {
    flex: 1, justifyContent: "flex-start", paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  menuStack: { width: "100%", maxWidth: 365 },
  // Line the preview and actions up on the same side as the pressed message.
  stackRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  stackLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  selectedMessageWrap: {
    maxWidth: "92%", marginBottom: 10,
    borderRadius: 17, paddingHorizontal: 15, paddingVertical: 12,
  },
  selectedMessage: { fontSize: 15, lineHeight: 21 },
  hidden: { opacity: 0 },
  actionPanel: { width: "78%", maxWidth: 300, borderRadius: 16, overflow: "hidden", backgroundColor: "#252527" },
  actionRow: {
    minHeight: 51, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#555558",
  },
  lastAction: { borderBottomWidth: 0 },
  actionLabel: { fontSize: 16, fontWeight: "500", color: "#f5f5f5" },
  disabledLabel: { fontSize: 15, color: "#888" },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    gap: 7,
    marginVertical: 0,
  },
  rowGrouped: {
    marginTop: 3,
  },
  rowNewGroup: {
    marginTop: 12,
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  rowThem: {
    justifyContent: "flex-start",
  },
  avatarSlot: {
    width: 30,
    height: 30,
    justifyContent: "center",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  messageColumn: {
    maxWidth: "78%",
    minWidth: 0,
    position: "relative",
  },
  withReaction: { paddingBottom: 13 },
  columnMe: { alignItems: "flex-end" },
  columnThem: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 2,
  },
  bubbleWithReaction: { paddingBottom: 13 },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    fontWeight: "500",
    alignSelf: "flex-end",
  },
});
