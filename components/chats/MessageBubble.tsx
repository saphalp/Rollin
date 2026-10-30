import { Colors, Fonts } from "@/constants/theme";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, useColorScheme, View } from "react-native";
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
}: MessageBubbleProps) {
  const [menuVisible, setMenuVisible] = useState(false);
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
        <View style={[styles.messageColumn, fromMe ? styles.columnMe : styles.columnThem, reactions.length > 0 && styles.withReaction]}>
          <Pressable
            onLongPress={() => setMenuVisible(true)}
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
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} accessibilityLabel="Close message actions" />
          <View style={[styles.actionPanel, { backgroundColor: colors.surfaceContainerHigh }]}>
            {onReact && (
              <View style={styles.reactionChoices}>
                {reactionChoices.map((emoji) => (
                  <Pressable key={emoji} onPress={() => chooseReaction(emoji)} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} style={styles.reactionChoice}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text numberOfLines={3} style={[styles.selectedMessage, { color: colors.text }]}>{text}</Text>
            <Pressable
              style={styles.actionRow}
              onPress={() => { void copyMessage(); }}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
            >
              <Text style={[styles.actionLabel, { color: colors.text, fontFamily: Fonts.sans }]}>Copy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reactionChoices: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8 },
  reactionChoice: { padding: 3 },
  reactionEmoji: { fontSize: 24 },
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  actionPanel: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    padding: 12,
  },
  selectedMessage: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
  },
  actionRow: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.4)",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
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
