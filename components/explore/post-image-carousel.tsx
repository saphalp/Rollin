import { Image, type ImageStyle } from "expo-image";
import { useCallback, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { AppText } from "@/components/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Props = {
  imageUrls: string[];
  style?: StyleProp<ViewStyle>;
  onPressImage?: (index: number) => void;
};

export function PostImageCarousel({ imageUrls, style, onPressImage }: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  }

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (containerWidth <= 0) return;
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / containerWidth);
      if (index >= 0 && index < imageUrls.length) {
        setActiveIndex(index);
      }
    },
    [containerWidth, imageUrls.length]
  );

  const containerBg = { backgroundColor: colors.surfaceContainer };

  // Empty / missing images state
  if (!imageUrls || imageUrls.length === 0) {
    return (
      <View style={[styles.container, containerBg, styles.emptyContainer, style]}>
        <IconSymbol name="camera.fill" size={32} color={colors.outline} />
        <AppText style={[styles.emptyText, { color: colors.outline, fontFamily: Fonts?.sans }]}>
          No photo available
        </AppText>
      </View>
    );
  }

  // Single photo
  if (imageUrls.length === 1) {
    const singleImage = (
      <Image
        source={{ uri: imageUrls[0] }}
        style={[styles.container, containerBg, style] as StyleProp<ImageStyle>}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityLabel="Post photo"
      />
    );

    if (onPressImage) {
      return (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => onPressImage(0)}
          accessibilityRole="button"
          accessibilityLabel="Open photo in full screen"
        >
          {singleImage}
        </TouchableOpacity>
      );
    }

    return singleImage;
  }

  // Multi-photo carousel
  return (
    <View style={[styles.container, containerBg, style]} onLayout={onLayout}>
      {containerWidth > 0 && (
        <FlatList
          data={imageUrls}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const img = (
              <Image
                source={{ uri: item }}
                style={{ width: containerWidth, height: containerWidth * 1.05 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityLabel={`Photo ${index + 1} of ${imageUrls.length}`}
              />
            );

            if (onPressImage) {
              return (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => onPressImage(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open photo ${index + 1} in full screen`}
                >
                  {img}
                </TouchableOpacity>
              );
            }

            return img;
          }}
        />
      )}

      {/* Translucent photo counter (top-right) */}
      <View style={styles.countBadge}>
        <AppText style={[styles.countBadgeText, { fontFamily: Fonts?.sans }]}>
          {activeIndex + 1}/{imageUrls.length}
        </AppText>
      </View>

      {/* Pagination dots (centered near bottom) */}
      <View style={styles.dotsRow} pointerEvents="none">
        {imageUrls.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 1 / 1.05,
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
  },
  countBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(18, 18, 20, 0.65)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  activeDot: {
    width: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 1.5,
  },
  inactiveDot: {
    width: 5,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
});
