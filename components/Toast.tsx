import { useTheme } from "@/contexts/ThemeContext";
import { ToastType } from "@/hooks/useToast";
import { fonts, spacing } from "@/theme/theme";
import React from "react";
import { Animated, StyleSheet, Text, ViewStyle } from "react-native";

interface ToastProps {
  message: string | null;
  type?: ToastType;
  opacity: Animated.Value;
  style?: ViewStyle;
}

export default function Toast({ message, type = "info", opacity, style }: ToastProps) {
  const { colors } = useTheme();
  if (!message) return null;

  const bgColor =
    type === "success"
      ? "#28a74533" // soft green
      : type === "error"
      ? "#dc354533" // soft red
      : colors.card;

  const borderColor =
    type === "success"
      ? "#28a745aa"
      : type === "error"
      ? "#dc3545aa"
      : colors.textSecondary + "55";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          backgroundColor: bgColor,
          borderColor,
          shadowColor: colors.textPrimary,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color:
              type === "error"
                ? "#E45858"
                : type === "success"
                ? "#1C873E"
                : colors.textPrimary,
          },
        ]}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl * 1.2,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
});