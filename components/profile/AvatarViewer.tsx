import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";

type AvatarViewerProps = {
  visible: boolean;
  source: ImageSourcePropType;
  onClose: () => void;
};

const MAX_SIZE = 420;

/** Full-screen enlarged profile picture; tapping the backdrop (not the photo) closes it. */
export default function AvatarViewer({ visible, source, onClose }: AvatarViewerProps) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, MAX_SIZE);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close profile picture"
      >
        {/* Swallows taps on the photo itself so only the empty space closes the viewer. */}
        <Pressable onPress={() => {}} accessible={false}>
          <Image
            source={source}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
});
