import { router } from 'expo-router';
import { useState } from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { Menu } from 'react-native-paper';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { REPORT_TARGET_LABELS, type ReportTargetType } from '@/types/reports';

export type OverflowMenuItem = {
  key: string;
  title: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  items?: OverflowMenuItem[];
  // Adds a "Report ..." item that opens the report screen for this target.
  report?: { type: ReportTargetType; id: string; name?: string };
  iconColor?: string;
  iconSize?: number;
  anchorStyle?: StyleProp<ViewStyle>;
};

export function openReport(type: ReportTargetType, id: string, name?: string) {
  router.push({ pathname: '/report', params: { type, id, name: name ?? '' } });
}

// The three-dot submenu used on profiles, posts, and activities.
export function OverflowMenu({ items = [], report, iconColor, iconSize = 20, anchorStyle }: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const [visible, setVisible] = useState(false);

  const allItems: OverflowMenuItem[] = report
    ? [
        ...items,
        {
          key: 'report',
          title: `Report ${REPORT_TARGET_LABELS[report.type]}`,
          icon: 'flag-outline',
          destructive: true,
          onPress: () => openReport(report.type, report.id, report.name),
        },
      ]
    : items;

  if (allItems.length === 0) return null;

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableOpacity
          onPress={() => setVisible(true)}
          hitSlop={8}
          style={anchorStyle}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <IconSymbol name="ellipsis" size={iconSize} color={iconColor ?? colors.text} />
        </TouchableOpacity>
      }
      contentStyle={{ backgroundColor: colors.cardBackground }}
    >
      {allItems.map((item) => (
        <Menu.Item
          key={item.key}
          leadingIcon={item.icon}
          title={item.title}
          disabled={item.disabled}
          onPress={() => {
            setVisible(false);
            item.onPress();
          }}
          titleStyle={{
            color: item.disabled ? colors.outline : item.destructive ? colors.error : colors.text,
            fontFamily: Fonts?.sans,
          }}
        />
      ))}
    </Menu>
  );
}
