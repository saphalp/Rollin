import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import {
  Platform,
  Pressable,
  StyleSheet,
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
}

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  disabled = false,
  sending = false,
  keyboardVisible = false,
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
          blurOnSubmit={Platform.OS === "ios" ? false : true}
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
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
