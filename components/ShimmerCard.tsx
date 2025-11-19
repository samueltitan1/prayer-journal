// components/ShimmerCard.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { spacing } from "../theme/theme";

export default function ShimmerCard({
  height = 110, // default height for reflection-like blocks
  borderRadius = 16,
}: {
  height?: number;
  borderRadius?: number;
}) {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={[styles.container, { height, borderRadius }]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [
              {
                translateX: shimmerX.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-150, 300], // cross card smoothly
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#E3E3E3",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 140,
    backgroundColor: "rgba(255,255,255,0.35)",
    opacity: 0.6,
    borderRadius: 16,
  },
});