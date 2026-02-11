import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "@/theme/theme";

type OnboardingShellProps = {
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
};

export default function OnboardingShell({ children, showBack = false, onBack }: OnboardingShellProps) {
  return (
    <SafeAreaView style={styles.container}>
      {showBack ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: spacing.lg,
  },
  header: {
    minHeight: 44,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    marginLeft: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
});
