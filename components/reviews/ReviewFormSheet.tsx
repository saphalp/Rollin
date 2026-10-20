import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { formatReviewDate, KIND_LABEL } from '@/components/reviews/ReviewCard';
import { StarRating } from '@/components/reviews/StarRating';
import { AppText } from '@/components/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { reviewTargets, saveReview, type ReviewKind, type ReviewTarget } from '@/services/reviews-service';

const MAX_COMMENT = 1000;

type ReviewFormSheetProps = {
  subjectId: string;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  // Opens the form on this item and hides the picker (e.g. "Review host" on an activity).
  initialItem?: { kind: ReviewKind; item_id: string };
};

function targetKey(target: Pick<ReviewTarget, 'kind' | 'item_id'>) {
  return `${target.kind}:${target.item_id}`;
}

function targetLabel(target: ReviewTarget) {
  return `${KIND_LABEL[target.kind]} · ${target.title} · ${formatReviewDate(target.item_date)}`;
}

export function ReviewFormSheet({ visible, onClose, ...props }: ReviewFormSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while open so every open starts from a fresh form. */}
      {visible && <ReviewForm onClose={onClose} {...props} />}
    </Modal>
  );
}

function ReviewForm({ subjectId, onClose, onSaved, initialItem }: Omit<ReviewFormSheetProps, 'visible'>) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [targets, setTargets] = useState<ReviewTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ReviewTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const initialKey = initialItem ? targetKey(initialItem) : null;

  function select(target: ReviewTarget | null) {
    setSelected(target);
    setStars(target?.my_stars ?? 0);
    setComment(target?.my_comment ?? '');
    setPicking(false);
  }

  useEffect(() => {
    let active = true;
    reviewTargets(subjectId)
      .then((rows) => {
        if (!active) return;
        setTargets(rows);
        const initial = initialKey ? rows.find((row) => targetKey(row) === initialKey) : rows.length === 1 ? rows[0] : undefined;
        if (initial) select(initial);
        else if (initialKey) setError('You can review the host once the activity has happened and you attended it.');
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load what you can review.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subjectId, initialKey]);

  async function submit() {
    if (!selected || !stars) return;
    setSaving(true);
    try {
      await saveReview(subjectId, selected, stars, comment);
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert('Could not save review', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  const isEdit = selected?.my_stars != null;
  const locked = Boolean(initialKey) || targets.length === 1;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.outlineVariant }]}>
            <TouchableOpacity onPress={picking ? () => setPicking(false) : onClose} hitSlop={8} style={styles.sheetActionSlot}>
              <AppText style={[styles.sheetAction, { color: colors.outline, fontFamily: Fonts.sans }]}>
                {picking ? 'Back' : 'Cancel'}
              </AppText>
            </TouchableOpacity>
            <AppText numberOfLines={1} style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts.sans }]}>
              {picking ? 'Reviewing for' : isEdit ? 'Edit review' : 'Write a review'}
            </AppText>
            <View style={styles.sheetActionSlot} />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.tint} style={styles.loader} />
          ) : error ? (
            <AppText style={[styles.message, { color: colors.error, fontFamily: Fonts.sans }]}>{error}</AppText>
          ) : targets.length === 0 ? (
            <AppText style={[styles.message, { color: colors.outline, fontFamily: Fonts.sans }]}>
              You can review someone after attending an activity they hosted or completing a ride with them.
            </AppText>
          ) : picking ? (
            <FlatList
              data={targets}
              keyExtractor={targetKey}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => select(item)} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
                  <IconSymbol name={item.kind === 'ride' ? 'car.fill' : 'person.2.fill'} size={18} color={colors.tint} />
                  <View style={styles.rowText}>
                    <AppText numberOfLines={1} style={[styles.rowTitle, { color: colors.text, fontFamily: Fonts.sans }]}>{item.title}</AppText>
                    <AppText style={[styles.rowMeta, { color: colors.outline, fontFamily: Fonts.sans }]}>
                      {KIND_LABEL[item.kind]} · {formatReviewDate(item.item_date)}{item.my_stars != null ? ' · Reviewed' : ''}
                    </AppText>
                  </View>
                  {selected && targetKey(item) === targetKey(selected) && <IconSymbol name="checkmark" size={18} color={colors.tint} />}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts.sans }]}>Reviewing for</AppText>
                <TouchableOpacity
                  onPress={() => setPicking(true)}
                  disabled={locked || saving}
                  style={[styles.select, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                >
                  <AppText numberOfLines={1} style={[styles.selectText, { color: selected ? colors.text : colors.outline, fontFamily: Fonts.sans }]}>
                    {selected ? targetLabel(selected) : 'Choose an activity or ride'}
                  </AppText>
                  {!locked && <IconSymbol name="chevron.down" size={18} color={colors.outline} />}
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts.sans }]}>Rating</AppText>
                <StarRating value={stars} onChange={setStars} size={36} disabled={saving || !selected} />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: colors.text, fontFamily: Fonts.sans }]}>Comment (optional)</AppText>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="What was it like?"
                  mode="outlined"
                  multiline
                  maxLength={MAX_COMMENT}
                  editable={!saving && Boolean(selected)}
                  outlineColor={colors.outlineVariant}
                  activeOutlineColor={colors.tint}
                  textColor={colors.text}
                  placeholderTextColor={colors.icon}
                  style={[styles.input, { backgroundColor: colors.surface }]}
                  theme={{ roundness: 15 }}
                />
                <AppText style={[styles.hint, { color: colors.outline, fontFamily: Fonts.sans }]}>
                  Reviews are public and show your name.
                </AppText>
              </View>

              <Button
                mode="contained"
                onPress={() => void submit()}
                loading={saving}
                disabled={!selected || !stars || saving}
                buttonColor={colors.tint}
                textColor={colors.onPrimary}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { fontFamily: Fonts.sans }]}
              >
                {isEdit ? 'Update review' : 'Post review'}
              </Button>
            </View>
          )}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetActionSlot: { minWidth: 60 },
  sheetAction: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  sheetTitle: { flex: 1, textAlign: 'center', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  loader: { paddingVertical: 40 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowMeta: { fontSize: 12, lineHeight: 16 },
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  selectText: { flex: 1, fontSize: 15, lineHeight: 20 },
  input: { minHeight: 100 },
  hint: { fontSize: 12, lineHeight: 16 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
