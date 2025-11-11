import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { spacing } from "../theme/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function AuthCard({ children, style }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "88%",
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});