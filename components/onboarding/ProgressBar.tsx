import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "@/theme/theme";

type ProgressBarProps = {
  progress: number;
  height?: number;
};

export default function ProgressBar({ progress, height = 6 }: ProgressBarProps) {
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    Animated.timing(animated, {
      toValue: clamped,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [animated, progress]);

  const width = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}> 
      <Animated.View
        style={[
          styles.fill,
          { width, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(227, 198, 123, 0.2)",
    overflow: "hidden",
  },
  fill: {
    backgroundColor: colors.accentGold,
  },
});
