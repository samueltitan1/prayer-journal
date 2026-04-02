import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import {
  getBiometricAvailability,
  markBiometricOnboardingSeen,
  promptBiometricAuth,
  setBiometricLockEnabled,
} from "@/lib/biometricLock";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function OnboardingBiometricSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackOnboardingStepViewed("biometric-setup");
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: "biometric-setup",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const continueToAppleHealth = () => {
    router.replace("/(auth)/onboarding/apple-health");
  };

  const handleNotNow = async () => {
    trackOnboardingAction("biometric-setup", "skip");
    await setBiometricLockEnabled(false);
    await markBiometricOnboardingSeen();
    continueToAppleHealth();
  };

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const availability = await getBiometricAvailability();
      if (!availability.supported) {
        setError("Face ID / Touch ID is not set up on this device. You can enable it later.");
        await setBiometricLockEnabled(false);
        await markBiometricOnboardingSeen();
        continueToAppleHealth();
        return;
      }

      const auth = await promptBiometricAuth("Enable Face ID / Touch ID");
      if (!auth.success) {
        setError("Face ID / Touch ID setup was cancelled. You can enable it later.");
        return;
      }

      trackOnboardingAction("biometric-setup", "continue");
      await setBiometricLockEnabled(true);
      await markBiometricOnboardingSeen();
      continueToAppleHealth();
    } catch {
      setError("We couldn’t enable Face ID / Touch ID right now. You can try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("biometric-setup")}
        onBack={() => {
          trackOnboardingAction("biometric-setup", "back");
          router.replace("/(auth)/onboarding/privacy");
        }}
      />
      <View style={styles.container}>
       
          <Image source={require("../../../assets/faceIDG.png")} style={styles.iconImage} />
        
        <Text style={styles.title}>Keep your prayers private</Text>
        <Text style={styles.subtitle}>
          Your prayers are personal. Use Face ID to make sure only you can open your journal.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          title={busy ? "Please wait..." : "Enable Face ID"}
          onPress={() => void handleEnable()}
          disabled={busy}
        />
        <TouchableOpacity
          style={styles.notNowWrap}
          disabled={busy}
          onPress={() => void handleNotNow()}
        >
          <Text style={styles.notNowText}>Skip</Text>
        </TouchableOpacity>
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
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.accentGold}20`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  iconImage: {
    width: 100,
    height: 100,
    marginBottom: spacing.xl,
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
  },
  error: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 13,
    color: "#B00020",
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  notNowWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  notNowText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
