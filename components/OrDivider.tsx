import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";

type OrDividerProps = {
  label?: string;
  style?: ViewStyle;
  lineColor?: string;
  textColor?: string;
};

export default function OrDivider({
  label = "OR",
  style,
  lineColor,
  textColor,
}: OrDividerProps) {
  const { colors } = useTheme();
  const resolvedLine = lineColor ?? colors.textSecondary;
  const resolvedText = textColor ?? colors.textSecondary;

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.line, { backgroundColor: resolvedLine }]} />
      <Text style={[styles.label, { color: resolvedText }]}>{label}</Text>
      <View style={[styles.line, { backgroundColor: resolvedLine }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
  },
});
