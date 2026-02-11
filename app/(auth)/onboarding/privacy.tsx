import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { colors, fonts, spacing } from "@/theme/theme";
import { getOnboardingProgress, SURVEY_QUESTION_COUNT } from "@/lib/onboardingProgress";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";

export default function OnboardingPrivacy() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    trackOnboardingStepViewed("privacy");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "privacy",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("privacy")}
        onBack={() => {
          trackOnboardingAction("privacy", "back");
          router.replace(`/(auth)/onboarding/survey?step=${SURVEY_QUESTION_COUNT}`);
        }}
      />
      <View style={styles.container}>
        <View style={styles.checkmarkCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={styles.title}>Thank You for Trusting Us</Text>
        <Text style={styles.subtitle}>
          Your privacy and security are our top priority. We'll{" "}
          <Text style={styles.emphasis}>never</Text> read your prayers or share your data.
          Every prayer is encrypted and stored securely—accessible{" "}
          <Text style={styles.emphasis}>only by you</Text>. You're in complete control.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title="Continue"
          onPress={() => {
            trackOnboardingAction("privacy", "continue");
            router.replace("/(auth)/onboarding/apple-health");
          }}
        />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  checkmarkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(227, 198, 123, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  checkmark: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  emphasis: {
    fontFamily: fonts.heading,
    color: colors.textPrimary,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
