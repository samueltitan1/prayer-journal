import { colors, fonts, spacing } from "@/theme/theme";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Path, Rect } from "react-native-svg";

type HabitTransitionGraphRNProps = {
  title?: string;
  description?: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedFillPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const PATH_LENGTH = 500;
const AXIS_Y = 210;

export default function HabitTransitionGraphRN({
  title = "Your habit transition",
  description = "Based on Prayer Journal’s historical data, habits start to form after 7 days. With time, you can transform your prayer life.",
}: HabitTransitionGraphRNProps) {
  const progress = useSharedValue(0);
  const micro = useSharedValue(0);

  useEffect(() => {
    // Main draw animation (once)
    progress.value = withTiming(1, { duration: 4000, easing: Easing.out(Easing.cubic) });

    // Gentle micro-motion loop (subtle lift + opacity breathe)
    micro.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [micro, progress]);

  const animatedLineProps = useAnimatedProps(() => {
    const lift = interpolate(micro.value, [0, 1], [0, -2]);
    const breathe = interpolate(micro.value, [0, 1], [0.95, 1]);

    return {
      strokeDashoffset: PATH_LENGTH * (1 - progress.value),
      opacity: breathe,
      // react-native-svg expects a transform string
      transform: `translate(0 ${lift})`,
    } as any;
  });

  const animatedShadeProps = useAnimatedProps(() => {
    const lift = interpolate(micro.value, [0, 1], [0, -1.2]);
    const breathe = interpolate(micro.value, [0, 1], [0.88, 1]);

    // Gate the shade by the draw progress so it appears as the line draws.
    // Keep a subtle "breathe" once fully visible.
    const opacity = progress.value * breathe;

    return {
      opacity,
      transform: `translate(0 ${lift})`,
    } as any;
  });

  const GOLD_PATH = "M0 160 C 78 158, 120 130, 135 122 S 200 60, 300 47";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartWrap}>
        <Svg width="100%" height="210" viewBox="0 0 300 210">
          <Defs>
            <ClipPath id="pjHabitShadeClip">
              <Path d={`${GOLD_PATH} L 300 ${AXIS_Y} L 0 ${AXIS_Y} Z`} />
            </ClipPath>
          </Defs>

          {/* Card-like chart background */}
          <Rect x="10" y="18" width="280" height="118" rx="12" fill="#FFFFFF" opacity={0} />

          {/* Dotted horizontal gridlines */}
          <Path
            d={`M0 110 L 300 110`}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={1}
            strokeDasharray="3 5"
            fill="none"
          />
          <Path
            d={`M0 160 L 300 160`}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={1}
            strokeDasharray="3 5"
            fill="none"
          />

          {/* Vertical dotted guides aligned to the labelled points */}
          <Path
            d={`M70 150 L 70 ${AXIS_Y}`}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={1}
            strokeDasharray="3 5"
            fill="none"
          />
          <Path
            d={`M150 110 L 150 ${AXIS_Y}`}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={1}
            strokeDasharray="3 5"
            fill="none"
          />
          <Path
            d={`M300 48 L 300 ${AXIS_Y}`}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={1}
            strokeDasharray="3 5"
            fill="none"
          />

          {/* Shaded area under curve (3 segments between stage points) */}
          <AnimatedRect
            x="0"
            y="0"
            width="70"
            height={AXIS_Y}
            fill="rgba(227, 198, 123, 0.10)"
            clipPath="url(#pjHabitShadeClip)"
            animatedProps={animatedShadeProps}
          />
          <AnimatedRect
            x="70"
            y="0"
            width="80"
            height={AXIS_Y}
            fill="rgba(227, 198, 123, 0.20)"
            clipPath="url(#pjHabitShadeClip)"
            animatedProps={animatedShadeProps}
          />
          <AnimatedRect
            x="150"
            y="0"
            width="150"
            height={AXIS_Y}
            fill="rgba(227, 198, 123, 0.30)"
            clipPath="url(#pjHabitShadeClip)"
            animatedProps={animatedShadeProps}
          />

          {/* X-axis line */}
          <Path
            d={`M0 ${AXIS_Y} L 300 ${AXIS_Y}`}
            stroke="rgba(0,0,0,0.85)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />

          {/* Animated curve */}
          <AnimatedPath
            d={GOLD_PATH}
            stroke={colors.accentGold}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={PATH_LENGTH}
            animatedProps={animatedLineProps}
          />

          {/* Stage Points */}
          <Circle cx="3.5" cy="160" r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={2} />
          <Circle cx="70" cy="150" r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={2} />
          <Circle cx="150" cy="110" r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={2} />
          <Circle cx="296" cy="48" r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={2} />
        </Svg>
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabelMid}>3 Days</Text>
        <Text style={styles.axisLabelMid}>7 Days</Text>
        <Text style={styles.axisLabelRight}>30 Days</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: -35,
  },
  chartWrap: {
    width: "100%",
    marginTop: spacing.sm,
  },
  axisRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    width: "100%",
  },
  axisLabelLeft: {
    width: "25%",
    fontFamily: fonts.body,
    textAlign: "left",
    fontSize: 12,
    color: colors.textPrimary,
  },
  axisLabelMid: {
    width: "25%",
    fontFamily: fonts.body,
    textAlign: "center",
    fontSize: 12,
    color: colors.textPrimary,
  },
  axisLabelRight: {
    width: "50%",
    fontFamily: fonts.body,
    textAlign: "center",
    fontSize: 12,
    color: colors.textPrimary,
  },
  description: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.lg,

  },
});
