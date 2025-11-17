import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  reflection: {
    title: string;
    subtitle: string | null;
    body: string;
  } | null;
};

export default function WeeklyReflectionCard({ reflection }: Props) {
  const { colors } = useTheme();

  if (!reflection) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {reflection.title}
      </Text>

      {reflection.subtitle && (
        <Text
          style={[styles.subtitle, { color: colors.textSecondary }]}
        >
          {reflection.subtitle}
        </Text>
      )}

      <Text style={[styles.body, { color: colors.textPrimary }]}>
        {reflection.body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
});