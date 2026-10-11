import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Menu } from 'react-native-paper';

import { DateTimeField } from '@/components/post/date-time-field';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type RecurrenceType = 'none' | 'weekly' | 'monthly';
export type EndConditionType = 'end_of_month' | 'end_of_quarter' | 'specific_date' | 'occurrences';

export type RecurrenceRule = {
  type: RecurrenceType;
  endCondition: EndConditionType;
  endDate?: string;
  occurrences?: number;
};

const REPEAT_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Does not repeat', value: 'none' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every month', value: 'monthly' },
];

const END_OPTIONS: { label: string; value: EndConditionType }[] = [
  { label: 'End of month', value: 'end_of_month' },
  { label: 'End of quarter', value: 'end_of_quarter' },
  { label: 'After 4 occurrences', value: 'occurrences' },
  { label: 'On a specific date', value: 'specific_date' },
];

type Props = {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  baseDate?: Date | null;
};

export function RecurrenceField({ value, onChange, baseDate }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [repeatVisible, setRepeatVisible] = useState(false);
  const [endVisible, setEndVisible] = useState(false);

  const repeatLabel = REPEAT_OPTIONS.find((o) => o.value === value.type)?.label ?? 'Does not repeat';

  function getRepeatDescription() {
    if (value.type === 'none') return null;
    const day = baseDate
      ? baseDate.toLocaleDateString('en-US', { weekday: 'long' })
      : 'selected day';
    const date = baseDate ? baseDate.getDate() : null;
    if (value.type === 'weekly') return `Every week on ${day}`;
    if (value.type === 'monthly') return `Every month on the ${date}${ordinal(date)}`;
    return null;
  }

  const endLabel = END_OPTIONS.find((o) => o.value === value.endCondition)?.label ?? 'End of month';

  const selectedEndDate = value.endDate ? new Date(value.endDate) : null;

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        Repeat
      </AppText>

      <Menu
        visible={repeatVisible}
        onDismiss={() => setRepeatVisible(false)}
        anchor={
          <TouchableOpacity
            onPress={() => setRepeatVisible(true)}
            style={[styles.anchor, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
          >
            <AppText style={[styles.anchorText, { color: colors.text, fontFamily: Fonts?.sans }]}>
              {repeatLabel}
            </AppText>
            <IconSymbol name="chevron.down" size={20} color={colors.outline} />
          </TouchableOpacity>
        }
        contentStyle={{ backgroundColor: colors.cardBackground }}
      >
        {REPEAT_OPTIONS.map((option) => (
          <Menu.Item
            key={option.value}
            title={option.label}
            onPress={() => {
              onChange({ ...value, type: option.value });
              setRepeatVisible(false);
            }}
            titleStyle={{ color: option.value === value.type ? colors.tint : colors.text, fontFamily: Fonts?.sans }}
          />
        ))}
      </Menu>

      {getRepeatDescription() && (
        <AppText style={[styles.description, { color: colors.outline, fontFamily: Fonts?.sans }]}>
          {getRepeatDescription()}
        </AppText>
      )}

      {value.type !== 'none' && (
        <>
          <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans, marginTop: 8 }]}>
            Ends
          </AppText>
          <Menu
            visible={endVisible}
            onDismiss={() => setEndVisible(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setEndVisible(true)}
                style={[styles.anchor, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
              >
                <AppText style={[styles.anchorText, { color: colors.text, fontFamily: Fonts?.sans }]}>
                  {endLabel}
                </AppText>
                <IconSymbol name="chevron.down" size={20} color={colors.outline} />
              </TouchableOpacity>
            }
            contentStyle={{ backgroundColor: colors.cardBackground }}
          >
            {END_OPTIONS.map((option) => (
              <Menu.Item
                key={option.value}
                title={option.label}
                onPress={() => {
                  onChange({
                    ...value,
                    endCondition: option.value,
                    occurrences: option.value === 'occurrences' ? 4 : undefined,
                    endDate: option.value !== 'specific_date' ? undefined : value.endDate,
                  });
                  setEndVisible(false);
                }}
                titleStyle={{ color: option.value === value.endCondition ? colors.tint : colors.text, fontFamily: Fonts?.sans }}
              />
            ))}
          </Menu>

          {value.endCondition === 'specific_date' && (
            <DateTimeField
              label="End date"
              mode="date"
              value={selectedEndDate}
              onChange={(d) => onChange({ ...value, endDate: d.toISOString() })}
              placeholder="Select end date"
              minimumDate={baseDate ?? new Date()}
            />
          )}
        </>
      )}
    </View>
  );
}

function ordinal(n: number | null): string {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  anchorText: { fontSize: 15 },
  description: { fontSize: 13, marginTop: 2 },
});
