import { Image, type ImageStyle } from "expo-image";
import { useState } from "react";
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
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Props = {
  imageUrls: string[];
  style?: StyleProp<ViewStyle>;
  onPressImage?: (index: number) => void;
};

export function PostImageCarousel({ imageUrls, style, onPressImage }: Props) {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];

  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }

  const containerBg = { backgroundColor: colors.surfaceContainer };

  if (!imageUrls || imageUrls.length === 0) {
    return (
      <View style={[styles.container, containerBg, styles.emptyContainer, style]}>
        <IconSymbol name="camera.fill" size={32} color={colors.outline} />
      </View>
    );
  }

  if (imageUrls.length === 1) {
    const singleImage = (
      <Image
        source={{ uri: imageUrls[0] }}
        style={[styles.container, containerBg, style] as StyleProp<ImageStyle>}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );

    if (onPressImage) {
      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => onPressImage(0)}
          accessibilityRole="button"
          accessibilityLabel="View post photos"
        >
          {singleImage}
        </TouchableOpacity>
      );
    }

    return singleImage;
  }

  return (
    <View style={[styles.container, containerBg, style]} onLayout={onLayout}>
      {width > 0 && (
        <FlatList
          data={imageUrls}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const img = (
              <Image
                source={{ uri: item }}
                style={{ width, height: width }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            );
            if (onPressImage) {
              return (
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => onPressImage(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`View post photo ${index + 1} of ${imageUrls.length}`}
                >
                  {img}
                </TouchableOpacity>
              );
            }
            return img;
          }}
        />
      )}

      <View style={styles.countBadge}>
        <AppText style={styles.countBadgeText}>
          {activeIndex + 1}/{imageUrls.length}
        </AppText>
      </View>

      <View style={styles.dotsRow}>
        {imageUrls.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activeIndex ? "#FFFFFF" : "rgba(255,255,255,0.5)",
              },
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
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 9,
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
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
