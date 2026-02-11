import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { isHealthKitAvailable, requestHealthPermissions } from "@/lib/healthkit";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
export default function OnboardingAppleHealth() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackOnboardingStepViewed("apple-health");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "apple-health",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const handleConnect = async () => {
    setError(null);
    try {
      const available = await isHealthKitAvailable();
      if (!available) {
        setError("Apple Health is only available on iOS devices.");
        return;
      }

      const ok = await requestHealthPermissions();
      if (!ok) {
        setError("Could not connect to Apple Health. Please try again.");
        return;
      }

      void upsertUserSettingsOnboarding(user?.id, {
        apple_health_connected: true,
      });
      trackOnboardingAction("apple-health", "continue");
      router.replace("/(auth)/onboarding/reminder");
    } catch {
      setError("Could not connect to Apple Health. Please try again.");
    }
  };

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("apple-health")}
        onBack={() => {
          trackOnboardingAction("apple-health", "back");
          router.replace("/(auth)/onboarding/privacy");
        }}
      />
      <View style={styles.container}>
    
          <Image
            source={require("@/assets/appleconnect.png")}
            style={styles.logo}
            resizeMode="contain"
          />
    
        <Text style={styles.title}>Connect to Apple Health</Text>
        <Text style={styles.subtitle}>
          Combine your spiritual health with your physical health. Enhance "Walk Mode" by syncing your Prayer Walk's with the Health app.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={handleConnect} />
        <View style={styles.skipWrap}>
          <TouchableOpacity
            onPress={() => {
              trackOnboardingAction("apple-health", "skip");
              router.replace("/(auth)/onboarding/reminder");
            }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
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
    marginTop: -20,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: "left",
    marginRight: 40,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "left",
  },
  errorText: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 13,
    color: "#B00020",
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  skipWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logo: {
    width: 350,
    height: 350,
  },
});
