import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type DateTimeFieldProps = {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  minimumDate?: Date;
};

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
}: DateTimeFieldProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value ?? new Date());

  const displayValue = value
    ? mode === 'date'
      ? value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  function open() {
    setDraft(value ?? new Date());
    setVisible(true);
  }

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setVisible(false);
      if (event.type === 'set' && selected) onChange(selected);
      return;
    }
    if (selected) setDraft(selected);
  }

  function confirm() {
    onChange(draft);
    setVisible(false);
  }

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>

      <TouchableOpacity
        onPress={open}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <AppText
          style={[
            styles.fieldText,
            { color: value ? colors.text : colors.outline, fontFamily: Fonts?.sans },
          ]}
        >
          {displayValue || placeholder}
        </AppText>
        <IconSymbol name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={colors.outline} />
      </TouchableOpacity>

      {visible && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.sheetHeader, { borderBottomColor: colors.outlineVariant }]}>
                <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
                  <AppText style={[styles.sheetAction, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                    Cancel
                  </AppText>
                </TouchableOpacity>

                <AppText style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  {label}
                </AppText>

                <TouchableOpacity onPress={confirm} hitSlop={8}>
                  <AppText style={[styles.sheetAction, { color: colors.tint, fontFamily: Fonts?.sans }]}>
                    Done
                  </AppText>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                onChange={handleChange}
                textColor={colors.text}
                style={styles.picker}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldText: {
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  picker: {
    alignSelf: 'center',
  },
});
