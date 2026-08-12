import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RideFilter } from '@/types/rides';

type Props = {
    value: RideFilter;
    onChange: (value: RideFilter) => void;
    activityLocked?: boolean;
};

const OPTIONS: { label: string; value: RideFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Activities', value: 'activity' },
    { label: 'Regular', value: 'regular' },
];

export function RideFilterBar({
    value,
    onChange,
    activityLocked = false,
}: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    if (activityLocked) {
        return null;
    }

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: colors.outlineVariant,
                },
            ]}
        >
            {OPTIONS.map((option) => {
                const selected = option.value === value;

                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        style={[
                            styles.button,
                            selected && {
                                backgroundColor: colors.cardBackground,
                            },
                        ]}
                    >
                        <AppText
                            style={[
                                styles.label,
                                {
                                    color: selected
                                        ? colors.tint
                                        : colors.icon,
                                    fontFamily: Fonts?.sans,
                                },
                            ]}
                        >
                            {option.label}
                        </AppText>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 16,
        padding: 4,
    },
    button: {
        flex: 1,
        minHeight: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '800',
    },
});
