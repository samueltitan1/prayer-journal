import React, { useEffect, useMemo, useRef } from "react";
import { Animated, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { colors, spacing } from "@/theme/theme";

type CarouselProps = {
  slides: React.ReactNode[];
  onIndexChange?: (index: number) => void;
  activeIndex?: number;
};

export default function Carousel({ slides, onIndexChange, activeIndex }: CarouselProps) {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (activeIndex == null) return;
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
  }, [activeIndex, width]);

  const handleMomentumEnd = (e: any) => {
    const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    onIndexChange?.(nextIndex);
  };

  const dotInputRange = useMemo(
    () => slides.map((_, i) => i * width),
    [slides, width]
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {slides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {slide}
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {slides.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: dotInputRange,
            outputRange: dotInputRange.map((_, idx) => (idx === i ? 1 : 0.35)),
          });
          const scale = scrollX.interpolate({
            inputRange: dotInputRange,
            outputRange: dotInputRange.map((_, idx) => (idx === i ? 1.1 : 1)),
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity, transform: [{ scale }] }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGold,
  },
});
