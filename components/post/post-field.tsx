import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type PostFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
} & TextInputProps;

export function PostField({
  label,
  value,
  onChangeText,
  multiline = false,
  ...textInputProps
}: PostFieldProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.outline}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          {
            color: colors.text,
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            fontFamily: Fonts?.sans,
          },
        ]}
        {...textInputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});