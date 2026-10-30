import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  keyboardVisible?: boolean;
  replyingTo?: { senderName: string; text: string } | null;
  onCancelReply?: () => void;
}

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  disabled = false,
  sending = false,
  keyboardVisible = false,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const canSend = !disabled && value.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: (keyboardVisible ? 0 : insets.bottom) + 8,
          backgroundColor: colors.background,
          borderTopColor: colors.outlineVariant,
        },
      ]}
    >
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: colors.surfaceContainerHigh, borderLeftColor: colors.tint }]}>
          <View style={styles.replyBannerContent}>
            <Text style={[styles.replyBannerAuthor, { color: colors.tint, fontFamily: Fonts.sans }]}>Replying to {replyingTo.senderName}</Text>
            <Text numberOfLines={1} style={{ color: colors.text }}>{replyingTo.text}</Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel reply">
            <Text style={{ color: colors.icon, fontSize: 20 }}>×</Text>
          </Pressable>
        </View>
      )}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <TextInput
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={colors.icon}
          multiline
          style={[
            styles.input,
            { color: colors.text, fontFamily: Fonts.sans },
          ]}
          onSubmitEditing={canSend ? onSend : undefined}
          returnKeyType="send"
          // Android: submit the message without blurring (hiding the keyboard).
          submitBehavior={Platform.OS === "android" ? "submit" : undefined}
          blurOnSubmit={Platform.OS === "ios" ? false : undefined}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sending ? 'Sending message' : 'Send message'}
        onPress={onSend}
        disabled={!canSend}
        hitSlop={6}
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.tint : colors.outlineVariant,
            opacity: pressed && canSend ? 0.85 : 1,
          },
        ]}
      >
        <IconSymbol
          name="arrow.up"
          size={20}
          color={canSend ? colors.onPrimary : colors.icon}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBanner: { width: "100%", borderLeftWidth: 3, borderRadius: 9, padding: 9, flexDirection: "row", alignItems: "center", marginBottom: 4 },
  replyBannerContent: { flex: 1, gap: 3 },
  replyBannerAuthor: { fontWeight: "700", fontSize: 12 },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    minHeight: 44,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    maxHeight: 120,
    padding: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
