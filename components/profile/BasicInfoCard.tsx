import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { Colors, Fonts } from "@/constants/theme";

import { supabase } from "@/lib/supabase";
import { getCurrentUniversity } from "@/lib/university";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

export type BasicInfoValues = {
  fullName: string;
  university: string;
  major: string;
};

type BasicInfoCardProps = BasicInfoValues & {
  onNext: (values: BasicInfoValues) => void;
  title?: string;
  subtitle?: string;
  nextLabel?: string;
};

export default function BasicInfoCard({
  fullName: initialFullName,
  university: initialUniversity,
  major: initialMajor,
  onNext,
  title = "Complete Your Profile",
  subtitle = "Tell us a little about yourself before you start rolling.",
  nextLabel = "Next",
}: BasicInfoCardProps) {
  const colors = Colors.light;

  const [fullName, setFullName] = useState(initialFullName);
  const [university, setUniversity] = useState(initialUniversity);
  const [major, setMajor] = useState(initialMajor);
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [lockedUniversity, setLockedUniversity] = useState<string | null>(null);
  const [universityLoading, setUniversityLoading] = useState(true);
  const [universityError, setUniversityError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [directoryWarning, setDirectoryWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchUniversityOptions() {
      try {
        // This RPC derives a university from the verified auth email, not a profile field.
        const detected = await getCurrentUniversity();
        if (!active) return;
        if (detected) {
          setLockedUniversity(detected.name);
          setUniversity(detected.name);
          setUniversities([{ id: detected.id, name: detected.name }]);
        } else {
          // Personal-email users select from the separate US directory.
          // This directory does not grant campus-email verification or campus feeds.
          setLockedUniversity(null);
        }
      } catch (e) {
        if (active) setUniversityError(e instanceof Error ? e.message : "Unable to load universities.");
      } finally {
        if (active) setUniversityLoading(false);
      }
    }
    void fetchUniversityOptions();
    return () => { active = false; };
  }, [initialUniversity]);

  useEffect(() => {
    if (!pickerVisible || lockedUniversity || universityLoading) return;
    // Show results only after the user starts typing.
    const query = search.trim();
    if (!query) {
      setUniversities([]);
      setSearching(false);
      setDirectoryWarning(null);
      return;
    }
    let active = true;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        let request = supabase.from('university_directory')
          .select('name')
          .eq('country_code', 'US')
          .order('name', { ascending: true })
          .limit(40);
        request = request.ilike('name', `%${query.replace(/[%,_]/g, '')}%`);
        const { data, error } = await request;
        if (error) throw error;
        if (active) {
          setUniversities((data ?? []).map(item => ({ id: item.name, name: item.name })));
          setDirectoryWarning(null);
          setUniversityError(null);
        }
      } catch (error) {
        // Older projects may only have the original campuses table. Keep it usable.
        const message = (error && typeof error === 'object' && 'message' in error)
          ? String(error.message) : String(error);
        console.warn('[university] directory lookup failed:', message);
        const { data: fallback, error: fallbackError } = await supabase.from('universities')
          .select('id, name').ilike('name', `%${query.replace(/[%,_]/g, '')}%`)
          .order('name', { ascending: true }).limit(40);
        if (active) {
          setUniversities((fallback ?? []).map(row => ({ id: row.id, name: row.name })));
          setDirectoryWarning(fallbackError
            ? `University search unavailable: ${message}; fallback: ${fallbackError.message}`
            : 'Showing currently supported campuses. The full university directory is unavailable.');
          setUniversityError(null); // Optional selection must not block personal-email users.
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timeout); };
  }, [pickerVisible, lockedUniversity, universityLoading, search]);

  const visibleUniversities = universities;

  function handleNext() {
    if (universityLoading || universityError) {
      Alert.alert("University unavailable", universityError ?? "Universities are still loading.");
      return;
    }
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }

    // Personal-email users may leave university blank. A nonblank selection must be from the directory.
    // The save step validates nonblank selections against the full directory.
    // Search results are paginated, so do not require a selection in the current 40 rows.

    if (!major.trim()) {
      Alert.alert("Missing major", "Please enter your major.");
      return;
    }

    onNext({ fullName, university, major });
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text
          style={[styles.title, { color: colors.text, fontFamily: Fonts.sans }]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: colors.icon, fontFamily: Fonts.sans },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <ProfileAvatar editable />

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
            Full Name
          </Text>
          <TextInput
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            autoCapitalize="words"
            outlineColor={colors.outlineVariant}
            activeOutlineColor={colors.tint}
            textColor={colors.text}
            placeholderTextColor={colors.icon}
            style={[styles.input, { backgroundColor: colors.surface }]}
            theme={{ roundness: 15 }}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
            University
          </Text>
          {universityLoading ? <ActivityIndicator accessibilityLabel="Loading universities" /> : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={lockedUniversity ? "University is locked" : "Select university"}
              disabled={!!lockedUniversity}
              onPress={() => { setSearch(""); setPickerVisible(true); }}
              style={[styles.universityButton, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
            >
              <Text style={{ flex: 1, color: colors.text }}>
                {university || (universityError ? "Unable to load universities" : "Select university (optional)")}
              </Text>
              <Text style={{ color: colors.icon }}>{lockedUniversity ? "Locked" : "Select ▾"}</Text>
            </Pressable>
          )}
          <Text style={{ fontSize: 12, color: universityError ? colors.error : colors.icon }}>
            {universityError ?? (lockedUniversity
              ? "Automatically assigned from your verified university email."
              : "Optional for personal email accounts. Choose a university or skip for now.")}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: Fonts.sans }]}>
            Major
          </Text>
          <TextInput
            placeholder="Enter your major"
            value={major}
            onChangeText={setMajor}
            mode="outlined"
            autoCapitalize="words"
            outlineColor={colors.outlineVariant}
            activeOutlineColor={colors.tint}
            textColor={colors.text}
            placeholderTextColor={colors.icon}
            style={[styles.input, { backgroundColor: colors.surface }]}
            theme={{ roundness: 15 }}
          />
        </View>
      </View>

      <Modal visible={pickerVisible} transparent animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose your university</Text>
            <TextInput
              mode="outlined"
              placeholder="Search universities"
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setSearching(!!value.trim());
                setUniversities([]); // Hide results for the previous search immediately.
                setDirectoryWarning(null);
              }}
              autoCapitalize="none"
              outlineColor={colors.outlineVariant}
              activeOutlineColor={colors.tint}
              textColor={colors.text}
              placeholderTextColor={colors.icon}
              selectionColor={colors.tint}
              style={{ backgroundColor: colors.surface }}
              theme={{ roundness: 12, colors: { primary: colors.tint, onSurface: colors.text, onSurfaceVariant: colors.icon, outline: colors.outlineVariant } }}
            />
            {searching && <ActivityIndicator color={colors.tint} />}
            {!!universityError && <Text style={{ color: colors.error }}>{universityError}</Text>}
            {!!directoryWarning && <Text style={{ color: colors.icon, fontSize: 12 }}>{directoryWarning}</Text>}
            {!search.trim() ? (
              <Text style={{ paddingVertical: 20, color: colors.icon, textAlign: 'center' }}>
                Start typing a university name to see suggestions.
              </Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                {visibleUniversities.map(option => (
                  <Pressable key={option.id} accessibilityRole="button"
                    style={[styles.universityOption, { borderBottomColor: colors.outlineVariant }]}
                    onPress={() => { setUniversity(option.name); setPickerVisible(false); }}>
                    <Text style={{ color: colors.text }}>{option.name}</Text>
                  </Pressable>
                ))}
                {!searching && !visibleUniversities.length && <Text style={{ padding: 16, color: colors.icon }}>No matching universities. You can skip for now.</Text>}
              </ScrollView>
            )}
            {!lockedUniversity && (
              <Button
                mode="contained"
                buttonColor={colors.tint}
                textColor={colors.onPrimary}
                onPress={() => { setUniversity(""); setPickerVisible(false); }}
              >
                Skip / Clear university
              </Button>
            )}
            <Button textColor={colors.tint} onPress={() => setPickerVisible(false)}>Cancel</Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Button
        disabled={universityLoading || !!universityError}
        mode="contained"
        onPress={handleNext}
        buttonColor={colors.tint}
        textColor={colors.onPrimary}
        contentStyle={styles.nextButtonContent}
        style={styles.nextButton}
        labelStyle={styles.nextButtonLabel}
      >
        {nextLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  universityButton: { minHeight: 54, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 12 },
  modalContent: { borderRadius: 18, padding: 18, gap: 14, maxHeight: '90%' },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  universityOption: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  container: {
    gap: 24,
  },

  heading: {
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  form: {
    gap: 16,
  },

  fieldGroup: {
    gap: 6,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    fontFamily: Fonts.sans,
  },

  nextButton: {
    borderRadius: 14,
    marginTop: "auto",
  },

  nextButtonContent: {
    height: 54,
  },

  nextButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
