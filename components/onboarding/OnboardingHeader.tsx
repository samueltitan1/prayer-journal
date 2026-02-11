import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { colors, spacing } from "@/theme/theme";

type OnboardingHeaderProps = {
  progress: number;
  onBack?: () => void;
  showBack?: boolean;
};

export default function OnboardingHeader({
  progress,
  onBack,
  showBack = true,
}: OnboardingHeaderProps) {
  return (
    <View style={styles.headerRow}>
      {showBack ? (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.progressWrap}>
        <ProgressBar progress={progress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: {
    width: 32,
    height: 32,
  },
  progressWrap: {
    flex: 1,
  },
});
