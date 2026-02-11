import LinkText from "@/components/onboarding/LinkText";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStart,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function OnboardingWelcome() {
  const router = useRouter();
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      trackOnboardingStart();
      startedRef.current = true;
    }
    trackOnboardingStepViewed("welcome");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "welcome",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  return (
    <OnboardingShell showBack={false}>
      <View style={styles.container}>
        <Image
          source={require("@/assets/LOGO1.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Prayer Journal</Text>
        <Text style={styles.subtitle}>Pray. Reflect. Grow.</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title="Get started"
          onPress={() => {
            trackOnboardingAction("welcome", "continue");
            router.replace("/(auth)/onboarding/survey");
          }}
        />
        <View style={styles.linkWrap}>
          <Text style={styles.linkPrefix}>Already have an account? </Text>
          <LinkText
            text="Sign in"
            underlineText="Sign in"
            onPress={() => {
              trackOnboardingAction("welcome", "continue");
              router.push("/(auth)/onboarding/login");
            }}
            style={styles.linkText}
          />
        </View>
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
  logo: {
    width: 72,
    height: 72,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  linkWrap: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  linkPrefix: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
