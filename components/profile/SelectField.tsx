import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  loading,
  emptyMessage = 'No options available',
}: SelectFieldProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [visible, setVisible] = useState(false);

  function select(option: string) {
    onChange(option);
    setVisible(false);
  }

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>

      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <AppText
          numberOfLines={1}
          style={[
            styles.fieldText,
            { color: value ? colors.text : colors.outline, fontFamily: Fonts?.sans },
          ]}
        >
          {value || placeholder}
        </AppText>
        {loading ? (
          <ActivityIndicator size="small" color={colors.outline} />
        ) : (
          <IconSymbol name="chevron.down" size={18} color={colors.outline} />
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.outlineVariant }]}>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8} style={styles.sheetActionSlot}>
                <AppText style={[styles.sheetAction, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                  Cancel
                </AppText>
              </TouchableOpacity>

              <AppText numberOfLines={1} style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                {label}
              </AppText>

              <View style={styles.sheetActionSlot} />
            </View>

            {options.length === 0 ? (
              <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                {emptyMessage}
              </AppText>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => select(item)}
                    style={[styles.row, { borderBottomColor: colors.outlineVariant }]}
                  >
                    <AppText style={[styles.rowText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                      {item}
                    </AppText>
                    {item === value && <IconSymbol name="checkmark" size={18} color={colors.tint} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  fieldText: {
    fontSize: 15,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetActionSlot: {
    minWidth: 60,
  },
  sheetAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    fontSize: 15,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
});
