import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
export default function OnboardingAppleHealth() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    trackOnboardingStepViewed("apple-health");
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: "apple-health",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const handleConnect = () => {
    trackOnboardingAction("apple-health", "continue");
    router.replace("/(auth)/onboarding/reminder");
  };

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("apple-health")}
        onBack={() => {
          trackOnboardingAction("apple-health", "back");
          router.replace("/(auth)/onboarding/biometric-setup");
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
        Combine your spiritual health with your physical health by syncing Prayer Walk data. We use your steps and walking distance for walk summaries, and with your permission we save Prayer Walk workouts (distance, duration, and route) to the Health app.
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={handleConnect} />
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
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "left",
  },
  footer: {
    paddingBottom: spacing.lg,
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
