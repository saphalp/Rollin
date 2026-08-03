import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Menu } from 'react-native-paper';

import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type EventType = 'public' | 'private';

const EVENT_TYPE_OPTIONS: { label: string; value: EventType }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
];

type EventTypeDropdownProps = {
  label: string;
  value: EventType;
  onChange: (value: EventType) => void;
};

export function EventTypeDropdown({ label, value, onChange }: EventTypeDropdownProps) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [visible, setVisible] = useState(false);

  const selectedLabel = EVENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '';

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>

      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <TouchableOpacity
            onPress={() => setVisible(true)}
            style={[
              styles.anchor,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <AppText style={[styles.anchorText, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {selectedLabel}
            </AppText>
            <IconSymbol name="chevron.down" size={20} color={colors.outline} />
          </TouchableOpacity>
        }
        contentStyle={{ backgroundColor: colors.cardBackground }}
      >
        {EVENT_TYPE_OPTIONS.map((option) => (
          <Menu.Item
            key={option.value}
            title={option.label}
            onPress={() => {
              onChange(option.value);
              setVisible(false);
            }}
            titleStyle={{
              color: option.value === value ? colors.tint : colors.text,
              fontFamily: Fonts?.sans,
            }}
          />
        ))}
      </Menu>
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
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  anchorText: {
    fontSize: 15,
  },
});
