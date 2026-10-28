import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ReportForm } from '@/components/report/report-form';
import { AppText } from '@/components/text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ReportTargetType } from '@/types/reports';

const TARGET_TYPES: ReportTargetType[] = ['user', 'activity', 'post'];

export default function ReportScreen() {
  const { type, id, name } = useLocalSearchParams<{ type: string; id: string; name?: string }>();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const targetType = TARGET_TYPES.find((t) => t === type);
  if (!targetType || !id) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <AppText style={{ color: colors.outline }}>Nothing to report.</AppText>
      </View>
    );
  }

  return <ReportForm targetType={targetType} targetId={id} targetName={name || undefined} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
