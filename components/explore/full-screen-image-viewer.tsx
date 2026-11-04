import { Image } from "expo-image";
import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  visible: boolean;
  imageUrls: string[];
  initialIndex?: number;
  onClose: () => void;
};

type ContentProps = {
  imageUrls: string[];
  initialIndex: number;
  onClose: () => void;
};

function FullScreenViewerContent({
  imageUrls,
  initialIndex,
  onClose,
}: ContentProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList<string>>(null);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index >= 0 && index < imageUrls.length) {
        setActiveIndex(index);
      }
    },
    [imageUrls.length]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      {/* Top bar with back/close button and page indicator */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close full screen photo"
        >
          <IconSymbol name="xmark.circle.fill" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {imageUrls.length > 1 && (
          <View style={styles.counterBadge}>
            <AppText style={[styles.counterText, { fontFamily: Fonts?.sans }]}>
              {activeIndex + 1} / {imageUrls.length}
            </AppText>
          </View>
        )}

        {/* Empty placeholder for symmetrical layout balance */}
        <View style={styles.balancePlaceholder} />
      </View>

      {/* Swipeable & Zoomable Image List */}
      <FlatList
        ref={flatListRef}
        data={imageUrls}
        keyExtractor={(_, index) => `fullscreen-image-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex > 0 && initialIndex < imageUrls.length ? initialIndex : 0}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={styles.zoomContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: item }}
                style={styles.image}
                contentFit="contain"
                transition={150}
                accessibilityLabel={`Full screen image ${index + 1} of ${imageUrls.length}`}
              />
            </ScrollView>
          </View>
        )}
      />

      {/* Bottom indicator dots if multiple images */}
      {imageUrls.length > 1 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.dotsRow}>
            {imageUrls.map((_, dotIdx) => (
              <View
                key={`fs-dot-${dotIdx}`}
                style={[
                  styles.dot,
                  dotIdx === activeIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function FullScreenImageViewer({
  visible,
  imageUrls,
  initialIndex = 0,
  onClose,
}: Props) {
  if (!visible || !imageUrls || imageUrls.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <FullScreenViewerContent
        imageUrls={imageUrls}
        initialIndex={initialIndex}
        onClose={onClose}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  closeButton: {
    padding: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  balancePlaceholder: {
    width: 44,
    height: 44,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomScroll: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  zoomContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  activeDot: {
    width: 18,
    backgroundColor: "#FFFFFF",
  },
  inactiveDot: {
    width: 7,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
});
