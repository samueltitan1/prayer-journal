import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { useAuth } from "@/contexts/AuthProvider";
import { trackOnboardingAction, trackOnboardingStepViewed, trackPaywallViewed, trackPurchaseResult } from "@/lib/analytics/onboarding";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import {
  ensureRevenueCatConfigured,
  getRevenueCatCustomerInfo,
  hasActiveRevenueCatEntitlement,
  restoreRevenueCatPurchases,
  syncRevenueCatSubscription,
} from "@/lib/revenuecat";
import { getSupabase } from "@/lib/supabaseClient";
import { colors, fonts, spacing } from "@/theme/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

export default function OnboardingPaywall() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showVerifyReminder, setShowVerifyReminder] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [paywallReady, setPaywallReady] = useState(false);
  const [paywallInitError, setPaywallInitError] = useState<string | null>(null);

  const getPaywallInitErrorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    const normalized = raw.toLowerCase();
    if (normalized.includes("missing revenuecat api key")) {
      return "Subscriptions are not configured for this build yet. Please update app configuration and try again.";
    }
    return "We couldn't load subscription options right now. Please try again in a moment.";
  };

  const initializePaywall = async () => {
    if (!user?.id) {
      setPaywallReady(false);
      setPaywallInitError(null);
      return;
    }
    setPaywallInitError(null);
    setPaywallReady(false);
    try {
      await ensureRevenueCatConfigured(user.id);
      setPaywallReady(true);
    } catch (error) {
      console.error("paywall: revenuecat init failed", error);
      setPaywallInitError(getPaywallInitErrorMessage(error));
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      setPaywallReady(false);
      setPaywallInitError(null);
      router.replace("/(auth)/onboarding/welcome");
    }
  }, [loading, router, user?.id]);

  useEffect(() => {
    if (loading || !user?.id) return;
    let cancelled = false;
    trackPaywallViewed();
    trackOnboardingStepViewed("paywall");
    void (async () => {
      setPaywallInitError(null);
      setPaywallReady(false);
      try {
        await ensureRevenueCatConfigured(user.id);
        if (cancelled) return;
        setPaywallReady(true);
      } catch (error) {
        console.error("paywall: revenuecat init failed", error);
        if (cancelled) return;
        setPaywallInitError(getPaywallInitErrorMessage(error));
      }
    })();
    void upsertOnboardingResponses(user.id, {
      onboarding_step: "paywall",
      onboarding_last_seen_at: new Date().toISOString(),
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  const completeOnboardingAfterPurchase = async (source: string) => {
    if (!user?.id) {
      setPurchaseError("Please sign in again and retry.");
      return;
    }
    setSyncing(true);
    try {
      await syncRevenueCatSubscription(user.id);
      trackPurchaseResult("success", source);
      await upsertOnboardingResponses(user.id, {
        onboarding_step: null,
        onboarding_completed_at: new Date().toISOString(),
      });
      if (user.email && !user.email_confirmed_at) {
        setShowVerifyReminder(true);
      } else {
        router.replace("/(tabs)/journal");
      }
    } catch {
      setPurchaseError("Purchase completed, but syncing failed. Please try again.");
      trackPurchaseResult("error", source);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = async () => {
    setPurchaseError(null);
    setSyncing(true);
    try {
      await ensureRevenueCatConfigured(user?.id);
      const customerInfo = await restoreRevenueCatPurchases();
      const active = hasActiveRevenueCatEntitlement(customerInfo);
      if (!active) {
        setPurchaseError("No active subscription found to restore.");
        return;
      }
      await completeOnboardingAfterPurchase("restore");
    } catch {
      setPurchaseError("Could not restore purchases. Please try again.");
      trackPurchaseResult("error", "restore");
    } finally {
      setSyncing(false);
    }
  };

  const handleDismissVerify = () => {
    void Haptics.selectionAsync();
    setShowVerifyReminder(false);
    router.replace("/(tabs)/journal");
  };

  const handleResendVerify = async () => {
    void Haptics.selectionAsync();
    setVerifyError(null);
    try {
      if (!user?.email) {
        setVerifyError("Missing email.");
        return;
      }
      const { error } = await getSupabase().auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) {
        setVerifyError("Could not resend verification email.");
        return;
      }
      setShowVerifyReminder(false);
      router.replace("/(tabs)/journal");
    } catch {
      setVerifyError("Could not resend verification email.");
    }
  };

  const openTerms = () => {
    void Linking.openURL("https://prayerjournal.app/terms");
  };

  const openPrivacy = () => {
    void Linking.openURL("https://prayerjournal.app/privacy");
  };

  return (
    <OnboardingShell showBack={false}>
      <OnboardingHeader
        progress={getOnboardingProgress("paywall")}
        onBack={() => {
          trackOnboardingAction("paywall", "back");
          router.replace("/(auth)/onboarding/signup");
        }}
      />
      <View style={styles.container}>
        {paywallReady ? (
          <RevenueCatUI.Paywall
            style={styles.paywall}
            options={{ displayCloseButton: true }}
            onPurchaseCancelled={() => {
              trackPurchaseResult("cancel");
            }}
            onPurchaseError={() => {
              setPurchaseError("Could not complete purchase. Please try again.");
              trackPurchaseResult("error");
            }}
            onPurchaseCompleted={({ customerInfo }) => {
              void (async () => {
                setPurchaseError(null);
                const active = hasActiveRevenueCatEntitlement(customerInfo);
                if (!active) {
                  setPurchaseError("We couldn’t verify your subscription yet. Please try again.");
                  trackPurchaseResult("error");
                  return;
                }
                await completeOnboardingAfterPurchase("revenuecat");
              })();
            }}
            onRestoreCompleted={({ customerInfo }) => {
              void (async () => {
                setPurchaseError(null);
                const active = hasActiveRevenueCatEntitlement(customerInfo);
                if (!active) {
                  setPurchaseError("No active subscription found to restore.");
                  return;
                }
                await completeOnboardingAfterPurchase("restore");
              })();
            }}
            onRestoreError={() => {
              setPurchaseError("Could not restore purchases. Please try again.");
              trackPurchaseResult("error", "restore");
            }}
            onDismiss={() => {
              void (async () => {
                try {
                  const info = await getRevenueCatCustomerInfo();
                  const active = hasActiveRevenueCatEntitlement(info);
                  if (active) {
                    await completeOnboardingAfterPurchase("revenuecat");
                  }
                } catch {
                  // noop
                }
              })();
            }}
          />
        ) : paywallInitError ? (
          <View style={styles.initErrorWrap}>
            <Text style={styles.purchaseError}>{paywallInitError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void initializePaywall()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator style={styles.spinner} />
        )}

        {syncing ? <ActivityIndicator style={styles.spinner} /> : null}
        {purchaseError ? <Text style={styles.purchaseError}>{purchaseError}</Text> : null}

        {/*<View style={styles.legalRow}>
          <LinkText text="Terms" underlineText="Terms" onPress={openTerms} />
          <Text style={styles.legalDivider}>•</Text>
          <LinkText text="Privacy" underlineText="Privacy" onPress={openPrivacy} />
          <Text style={styles.legalDivider}>•</Text>
          <LinkText text="Restore" underlineText="Restore" onPress={handleRestore} />
        </View>*/}
      </View>

      {showVerifyReminder ? (
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <Text style={styles.verifyTitle}>Verify your email</Text>
            <Text style={styles.verifyBody}>
              Please check your inbox to verify your email so you can secure your account and
              recover access if needed.
            </Text>
            {verifyError ? <Text style={styles.verifyError}>{verifyError}</Text> : null}
            <View style={styles.verifyButtons}>
              <TouchableOpacity style={styles.verifySecondary} onPress={handleDismissVerify}>
                <Text style={styles.verifySecondaryText}>I’ll do it later</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.verifyPrimary} onPress={handleResendVerify}>
                <Text style={styles.verifyPrimaryText}>Resend email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  paywall: {
    flex: 1,
  },
  initErrorWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.accentGold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  legalRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  legalDivider: {
    marginHorizontal: spacing.sm,
    color: colors.textSecondary,
  },
  purchaseError: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: "#B00020",
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  verifyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  verifyCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.lg,
  },
  verifyTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  verifyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  verifyError: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: "#B00020",
  },
  verifyButtons: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  verifySecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  verifySecondaryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  verifyPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.accentGold,
  },
  verifyPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
