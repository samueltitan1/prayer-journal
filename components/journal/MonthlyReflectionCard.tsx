import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  reflection: {
    title: string;
    body: string;
    verse_text: string | null;
    verse_reference: string | null;
  } | null;
};

export default function MonthlyReflectionCard({ reflection }: Props) {
  const { colors } = useTheme();

  if (!reflection) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {reflection.title}
      </Text>

      <Text style={[styles.body, { color: colors.textPrimary }]}>
        {reflection.body}
      </Text>

      {reflection.verse_text && (
        <Text
          style={[
            styles.verse,
            { color: colors.textSecondary },
          ]}
        >
          “{reflection.verse_text}”
        </Text>
      )}

      {reflection.verse_reference && (
        <Text
          style={[
            styles.reference,
            { color: colors.textSecondary },
          ]}
        >
          — {reflection.verse_reference}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: 16,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  verse: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 2,
  },
  reference: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
});