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
import { colors, fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

const FUTURE_VISION_ITEMS = [
  {
    title: "Show up daily",
    body: "Build a rhythm that actually sticks — even on the days you don't feel like it.",
  },
  {
    title: "Pray with purpose",
    body: "Move beyond going through the motions into being aligned with God's will.",
  },
  {
    title: "Watch God move",
    body: "Look back in 30 days and see answers, patterns and faithfulness you'd have otherwise missed.",
  },
  {
    title: "Grow into your calling",
    body: "Consistency isn’t willpower. It’s having the right place to show up every day.",
  },
];

export default function OnboardingCongratulations() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    trackOnboardingStepViewed("congratulations");
    void upsertOnboardingResponses(user?.id, {
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
          router.replace("/(auth)/onboarding/signup");
        }}
      />
      <View style={styles.container}>
        <Text style={styles.title}>Your journal is ready!</Text>
        <Text style={styles.subtitle}>You’re all set to begin your prayer journey.</Text>
        <View style={styles.futureVisionContainer}>
          <Text style={styles.futureVisionHeader}>From today, you will:</Text>
          {FUTURE_VISION_ITEMS.map((item) => (
            <View key={item.title} style={styles.futureVisionCard}>
              <View style={styles.futureVisionIconWrap}>
                <Ionicons name="checkmark" size={21} color={colors.accentGold} />
              </View>
              <View style={styles.futureVisionTextWrap}>
                <Text style={styles.futureVisionItemTitle}>{item.title}</Text>
                <Text style={styles.futureVisionItemBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
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
    paddingHorizontal: spacing.xs * 0.5,
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
    marginBottom: spacing.xl,
  },
  futureVisionContainer: {
    marginTop: spacing.xl,
    width: "100%",
    maxWidth: 600,
    alignItems: "flex-start",
  },
  futureVisionHeader: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "left",
    marginBottom: spacing.xs,
  },
  futureVisionCard: {
    width: "100%",
    backgroundColor: colors.backgroundLight,
    borderRadius: 18,
    padding: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  futureVisionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 100,
    backgroundColor: `${colors.accentGold}26`,
    alignItems: "center",
    justifyContent: "center",
  },
  futureVisionTextWrap: {
    flex: 1,
  },
  futureVisionItemTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.textPrimary,
    textAlign: "left",
  },
  futureVisionItemBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "left",
    marginTop: 3,
    lineHeight: 20,
  },
  footer: {
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.lg,
  },
  skipWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
});
