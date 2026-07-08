import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ProfileFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
} & TextInputProps;

export function ProfileField({
  label,
  value,
  onChangeText,
  editable = true,
  ...textInputProps
}: ProfileFieldProps) {
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
        editable={editable}
        placeholderTextColor={colors.outline}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: editable ? colors.surfaceContainerHigh : colors.cardBackground,
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
});