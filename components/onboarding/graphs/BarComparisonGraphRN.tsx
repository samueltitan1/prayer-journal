import { colors, fonts, spacing } from "@/theme/theme";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

type BarComparisonGraphRNProps = {
  title?: string;
  description?: string;
};

const BAR_HEIGHT = 160;

export default function BarComparisonGraphRN({
  description = "Prayer Journal helps you remember and reflect more consistently.",
}: BarComparisonGraphRNProps) {
  const withoutValue = useSharedValue(0);
  const withValue = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const labelScale = useSharedValue(0.9);

  useEffect(() => {
    withoutValue.value = withTiming(0.2, { duration: 700, easing: Easing.out(Easing.cubic) });
    withValue.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    labelOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad), delay: 600 });
    labelScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad), delay: 600 });
  }, [labelOpacity, labelScale, withValue, withoutValue]);

  const withoutBarStyle = useAnimatedStyle(() => ({
    height: BAR_HEIGHT * withoutValue.value,
  }));

  const withBarStyle = useAnimatedStyle(() => ({
    height: BAR_HEIGHT * withValue.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.barRow}>
        <View style={styles.barBlock}>
          <Text style={styles.barLabelText}>Without{"\n"}Prayer Journal</Text>
          <View style={styles.barContainer}>
            <Animated.View style={[styles.barFill, styles.barMuted, withoutBarStyle]} />
            <Animated.Text style={[styles.barValue, labelStyle]}>10%</Animated.Text>
          </View>
        </View>
        <View style={styles.barBlock}>
          <Text style={styles.barLabelText}>With{"\n"}Prayer Journal</Text>
          <View style={styles.barContainer}>
            <Animated.View style={[styles.barFill, withBarStyle]} />
            <Animated.Text style={[styles.barValue, styles.barValueLight, labelStyle]}>
              8x
            </Animated.Text>
          </View>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "95%",
    alignSelf: "center",
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.00)",
  },
  barRow: {
    flexDirection: "row",
    gap: 0,
  },
  barBlock: {
    flex: 1,
    alignItems: "center",
  },
  barLabelText: {
    position: "absolute",
    top: 14,
    zIndex: 5,
    fontFamily: fonts.headingBold,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: "center",
  },
  barContainer: {
    width: "73%",
    height: BAR_HEIGHT + 60,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: colors.accentGold,
  },
  barMuted: {
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  barValue: {
    position: "absolute",
    bottom: 8,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  barValueLight: {
    color: "#FFFFFF",
  },
  description: {
    marginTop: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    width: "80%",
    alignSelf: "center",
  },
});
