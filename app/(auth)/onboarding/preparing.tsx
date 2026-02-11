import OnboardingShell from "@/components/onboarding/OnboardingShell";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { useAuth } from "@/contexts/AuthProvider";
import { trackOnboardingStepViewed } from "@/lib/analytics/onboarding";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors, fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const DURATION_MS = 3000;
const CHECKPOINTS = [500, 1500, 2500];

const CHECKLIST = [
  "Setting up your journal",
  "Personalizing your experience",
  "Getting things ready",
];

export default function OnboardingPreparing() {
  const router = useRouter();
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const fadeOut = useRef(new Animated.Value(1)).current;
  const itemOpacities = useRef(CHECKLIST.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    trackOnboardingStepViewed("preparing");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "preparing",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(1, elapsed / DURATION_MS);
      setProgress(next);
      if (elapsed >= DURATION_MS) {
        clearInterval(timer);
      }
    }, 50);

    const timeouts = CHECKPOINTS.map((ms, idx) =>
      setTimeout(() => {
        Animated.timing(itemOpacities[idx], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, ms)
    );

    const finish = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        router.replace("/(auth)/onboarding/signup");
      });
    }, DURATION_MS);

    return () => {
      clearInterval(timer);
      timeouts.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [fadeOut, itemOpacities, router]);

  return (
    <OnboardingShell showBack={false}>
      <Animated.View style={[styles.container, { opacity: fadeOut }]}>
        <Text style={styles.title}>Preparing your journey</Text>
        <Text style={styles.subtitle}>This will only take a moment.</Text>

        <View style={styles.progressWrap}>
          <ProgressBar progress={progress} />
        </View>

        <View style={styles.checklist}>
          {CHECKLIST.map((item, idx) => (
            <Animated.View key={item} style={[styles.checkItem, { opacity: itemOpacities[idx] }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accentGold} />
              <Text style={styles.checkText}>{item}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
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
  },
  progressWrap: {
    marginTop: spacing.xl,
    width: "100%",
  },
  checklist: {
    marginTop: spacing.xl,
    width: "100%",
    gap: spacing.md,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
