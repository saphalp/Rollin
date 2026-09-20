import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppText } from '@/components/text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

export type PlaceSelection = {
  displayText: string;
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelect: (place: PlaceSelection) => void;
  placeholder?: string;
};

export function LocationAutocompleteField({
  label,
  value,
  onChangeText,
  onPlaceSelect,
  placeholder,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const sessionToken = useRef(generateToken());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  function generateToken() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const fetchSuggestions = useCallback(async (input: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_API_KEY,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({ input, sessionToken: sessionToken.current }),
      });

      if (id !== requestId.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error?.message ?? `Error ${res.status}`;
        setError(msg.includes('quota') ? 'Search quota reached' : 'Could not load suggestions');
        setSuggestions([]);
        setOpen(true);
        return;
      }

      const data = await res.json();
      if (id !== requestId.current) return;

      const items: Suggestion[] = (data.suggestions ?? []).map((s: any) => {
        const pred = s.placePrediction;
        return {
          placeId: pred.placeId,
          mainText: pred.structuredFormat?.mainText?.text ?? '',
          secondaryText: pred.structuredFormat?.secondaryText?.text ?? '',
        };
      });

      setSuggestions(items);
      setOpen(true);
    } catch {
      if (id !== requestId.current) return;
      setError('Could not load suggestions');
      setSuggestions([]);
      setOpen(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (value.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      setError(null);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, fetchSuggestions]);

  async function handleSelect(suggestion: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setLoading(true);
    setError(null);

    const currentToken = sessionToken.current;
    sessionToken.current = generateToken();

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': PLACES_API_KEY,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
            'X-Goog-SessionToken': currentToken,
          },
        },
      );

      const data = await res.json();

      onPlaceSelect({
        displayText: suggestion.mainText,
        formattedAddress: data.formattedAddress ?? suggestion.mainText,
        placeId: suggestion.placeId,
        latitude: data.location?.latitude ?? 0,
        longitude: data.location?.longitude ?? 0,
      });
    } catch {
      // Still set the text so the user sees their selection
      onPlaceSelect({
        displayText: suggestion.mainText,
        formattedAddress: suggestion.mainText,
        placeId: suggestion.placeId,
        latitude: 0,
        longitude: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts?.sans }]}>
        {label}
      </AppText>

      <View>
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.outline}
            style={[styles.input, { color: colors.text, fontFamily: Fonts?.sans }]}
            autoCorrect={false}
            autoComplete="off"
          />
          {loading && <ActivityIndicator size="small" color={colors.outline} style={styles.spinner} />}
        </View>

        {open && (
          <View
            style={[
              styles.dropdown,
              { backgroundColor: colors.cardBackground, borderColor: colors.outlineVariant },
            ]}
          >
            {error ? (
              <AppText style={[styles.stateText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                {error}
              </AppText>
            ) : suggestions.length === 0 ? (
              <AppText style={[styles.stateText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
                No results
              </AppText>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.placeId}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.row,
                      index < suggestions.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <AppText
                      style={[styles.mainText, { color: colors.text, fontFamily: Fonts?.sans }]}
                      numberOfLines={1}
                    >
                      {item.mainText}
                    </AppText>
                    {!!item.secondaryText && (
                      <AppText
                        style={[styles.secondaryText, { color: colors.outline, fontFamily: Fonts?.sans }]}
                        numberOfLines={1}
                      >
                        {item.secondaryText}
                      </AppText>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    zIndex: 50,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  spinner: {
    marginLeft: 8,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 4,
    zIndex: 100,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mainText: {
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryText: {
    fontSize: 13,
    marginTop: 2,
  },
  stateText: {
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
