import { colors, fonts, spacing } from "@/theme/theme";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

type LongTermResultsGraphRNProps = {
  title?: string;
  description?: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedFillPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PATH_LENGTH = 580;

export default function LongTermResultsGraphRN({
  title = "Long-term results",
  description = "80% of Prayer Journal users pray and reflect more consistently even after 6 months.",
}: LongTermResultsGraphRNProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 3250, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animatedGoldStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - progress.value),
  }));
  
  const animatedBlackStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - progress.value),
  }));
  
  const animatedFillProps = useAnimatedProps(() => ({
    opacity: progress.value,
  }));

  const animatedEndPointProps = useAnimatedProps(() => {
    const p = Math.min(progress.value * 1.9, 1);
    return {
      cx: interpolate(p, [0, 0.5, 1], [16, 162, 294.5]),
      cy: interpolate(p, [0, 0.5, 1], [60, 48, 34]),
    };
  });
// Chart geometry
const AXIS_Y = 180;

// Gold = Prayer Journal (smooth, stable, gently rising)
const GOLD_PATH =
  "M0 60 C 70 55, 118 52, 162 48 S 238 40, 300 34 ";

// Black = Typical prayer life (volatile; peaks only TOUCH gold; never exceed it)
// Reminder: smaller Y = higher on screen, so black peak Y must be >= gold at the same region.
const BLACK_PATH =
  "M0 60 C 70 55, 70 156, 90 114 S 124 15, 152 86 S 176 58, 196 47 S 235 150, 258 98 S 276 55, 300 100 L 300 100 ";

const BLACK_FILL_PATH = `${BLACK_PATH} L 300 ${AXIS_Y} L 0 ${AXIS_Y} Z`;
const GOLD_FILL_PATH = `${GOLD_PATH} L 300 ${AXIS_Y} L 0 ${AXIS_Y} Z ${BLACK_PATH} L 300 ${AXIS_Y} L 0 ${AXIS_Y} Z`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartWrap}>
        <Svg width="100%" height="180" viewBox="0 0 300 180">
       {/* Dotted guide lines (Cal AI style) */}
        <Path
          d="M0 60 L 300 60"
          stroke="rgba(0,0,0,0.14)"
          strokeWidth={1}
          strokeDasharray="2 2"
          fill="none"
        />
        <Path
          d="M0 110 L 300 110"
          stroke="rgba(0,0,0,0.14)"
          strokeWidth={1}
          strokeDasharray="2 2"
          fill="none"
        />

        {/* X-axis (black) */}
        <Path
          d={`M0 ${AXIS_Y} L 300 ${AXIS_Y}`}
          stroke="rgba(0,0,0,0.85)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />

        {/* Shaded area under Typical prayer life (black): between black line and axis */}
        <AnimatedFillPath
          d={BLACK_FILL_PATH}
          fill="rgba(0,0,0,0.06)"
          animatedProps={animatedFillProps}
        />

        {/* Shaded area for Prayer Journal (gold): ONLY between gold and black */}
        <AnimatedFillPath
          d={GOLD_FILL_PATH}
          fill="rgba(227, 198, 123, 0.18)"
          fillRule="evenodd"
          animatedProps={animatedFillProps}
        />

        {/* Typical prayer life (black): steeper troughs; peaks briefly touch gold */}
        <AnimatedPath
          d={BLACK_PATH}
          stroke={colors.textPrimary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
          strokeDasharray={`${PATH_LENGTH}`}
          animatedProps={animatedBlackStrokeProps}
        />

        {/* Prayer Journal (gold): smooth, stable, gently rising; always above black */}
        <AnimatedPath
          d={GOLD_PATH}
          stroke={colors.accentGold}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${PATH_LENGTH}`}
          animatedProps={animatedGoldStrokeProps}
        />

        {/* Shared start point (same for both lines) */}
        <Circle cx="4.5" cy="60" r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={1.5} />
        <Circle cx="4.5" cy="60" r="2" fill={colors.accentGold} />

        {/* End point highlight for Prayer Journal */}
        <AnimatedCircle r="5" fill="#FFFFFF" stroke={colors.accentGold} strokeWidth={1.5} animatedProps={animatedEndPointProps} />
        <AnimatedCircle r="2" fill={colors.accentGold} animatedProps={animatedEndPointProps} />
        </Svg>
        <View style={styles.legend}>
          <Text style={styles.legendText}>Avg. Christian</Text>
        </View>
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>Month 1</Text>
        <Text style={styles.axisLabel}>Month 6</Text>
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
    paddingRight: spacing.xs,
  },
  chartWrap: {
    width: "100%",
    marginTop: spacing.sm,
    paddingRight: spacing.xs,
    paddingLeft: -20,
    position: "relative",
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 0,
    paddingRight: spacing.xs,
    paddingLeft: -20,
  },
  axisLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 7,
  },
  legend: {
    position: "absolute",
    left: 0,
    bottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    paddingVertical: 1,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFFFFF",
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  description: {
    marginTop: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
