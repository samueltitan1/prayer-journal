import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingCompleted,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function OnboardingCongratulations() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    trackOnboardingStepViewed("congratulations");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "congratulations",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const completeOnboarding = () => {
    trackOnboardingAction("congratulations", "continue");
    trackOnboardingCompleted();
    if (!user?.id) {
      console.warn("Missing userId for onboarding completion");
    }
    void upsertOnboardingResponses(user?.id, {
      onboarding_completed_at: new Date().toISOString(),
    });
    router.replace("/(auth)/onboarding/paywall");
  };

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("congratulations")}
        onBack={() => {
          trackOnboardingAction("congratulations", "back");
          router.replace("/(auth)/onboarding/preparing");
        }}
      />
      <View style={styles.container}>
        <Text style={styles.title}>Your journal is ready!</Text>
        <Text style={styles.subtitle}>You’re all set to begin your prayer journey.</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="Make your first entry" onPress={completeOnboarding} />
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
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  skipWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
});
