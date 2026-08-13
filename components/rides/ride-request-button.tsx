import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RideRequest } from '@/types/rides';

type Props = {
    request: RideRequest | null;
    loading: boolean;
    disabled?: boolean;
    onRequest: () => void;
    onCancel: () => void;
};

export function RideRequestButton({
    request,
    loading,
    disabled = false,
    onRequest,
    onCancel,
}: Props) {
    const theme = useColorScheme() ?? 'light';
    const colors = Colors[theme];

    const canCancel =
        request?.status === 'pending' || request?.status === 'accepted';

    let label = 'Request a Seat';

    if (request?.status === 'pending') {
        label = 'Cancel Pending Request';
    } else if (request?.status === 'accepted') {
        label = 'Cancel Accepted Seat';
    }

    return (
        <TouchableOpacity
            disabled={loading || disabled}
            onPress={canCancel ? onCancel : onRequest}
            style={[
                styles.button,
                {
                    backgroundColor: canCancel
                        ? colors.surfaceContainer
                        : colors.tint,
                    borderColor: canCancel
                        ? colors.outlineVariant
                        : colors.tint,
                    opacity: loading || disabled ? 0.55 : 1,
                },
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={canCancel ? colors.tint : colors.onPrimary}
                />
            ) : (
                <AppText
                    style={[
                        styles.label,
                        {
                            color: canCancel
                                ? colors.tint
                                : colors.onPrimary,
                            fontFamily: Fonts?.sans,
                        },
                    ]}
                >
                    {label}
                </AppText>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        minHeight: 54,
        borderWidth: 1,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
    },
});
