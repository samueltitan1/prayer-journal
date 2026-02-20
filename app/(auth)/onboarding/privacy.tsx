import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { getOnboardingProgress, SURVEY_QUESTION_COUNT } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function OnboardingPrivacy() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    trackOnboardingStepViewed("privacy");
    void upsertOnboardingResponses(user?.id, {
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
          <Image
          source={require("@/assets/encrypted.png")}style={styles.checkmarkImage}/>
        </View>
        <Text style={styles.title}>Thank You for Trusting Us</Text>
        <Text style={styles.subtitle}>
          Your privacy and security are our top priority. We'll{" "}
          <Text style={styles.emphasis}>never</Text> read your prayers or share your data.
          Every prayer is stored securely and encrypted—accessible{" "}
          <Text style={styles.emphasis}>only by you</Text>.
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
    paddingHorizontal: spacing.xl,
  },
  checkmarkCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
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
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    width: "100%",
  },
  emphasis: {
    fontFamily: fonts.heading,
    color: colors.textPrimary,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  checkmarkImage: {
    width: 175,
    height: 175,
  },
});
