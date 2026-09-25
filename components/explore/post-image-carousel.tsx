import { Image, type ImageStyle } from "expo-image";
import { useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { AppText } from "@/components/text";

type Props = {
  imageUrls: string[];
  style?: StyleProp<ViewStyle>;
};

export function PostImageCarousel({ imageUrls, style }: Props) {
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

  if (imageUrls.length <= 1) {
    return (
      <Image
        source={{ uri: imageUrls[0] }}
        style={[styles.container, style] as StyleProp<ImageStyle>}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {width > 0 && (
        <FlatList
          data={imageUrls}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width, height: width }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
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
    backgroundColor: "#DDDDDD",
    overflow: "hidden",
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
