import LinkText from "@/components/onboarding/LinkText";
import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
  trackPaywallViewed,
  trackPurchaseResult,
} from "@/lib/analytics/onboarding";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { getSupabase } from "@/lib/supabaseClient";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  initConnection,
  ProductSubscription,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from "react-native-iap";

type PlanId = "annual" | "monthly";

const FEATURES = [
  "Unlimited journal entries",
  "Prayer Walk Mode",
  "Weekly reflections",
];
const productIds = ["prayer_journal_monthly", "prayer_journal_yearly"] as const;

export default function OnboardingPaywall() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("annual");
  const [loading, setLoading] = useState(false);
  const [showVerifyReminder, setShowVerifyReminder] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSubscription[]>([]);

  useEffect(() => {
    trackPaywallViewed();
    trackOnboardingStepViewed("paywall");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "paywall",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await initConnection();
        const subs = await fetchProducts({
          skus: productIds as unknown as string[],
          type: "subs",
        });
        if (mounted) setProducts(subs as ProductSubscription[]);
      } catch {
        // noop; UI will show fallback
      }
    };
    run();

    const updateSub = purchaseUpdatedListener(async (purchase) => {
      try {
        setPurchaseError(null);
        const transactionId = purchase?.transactionId;
        const productId = purchase?.productId;
        if (!transactionId || !productId) {
          setPurchaseError("We couldn’t verify your purchase. Please try again.");
          return;
        }

        const supabase = getSupabase();
        const { data, error } = await supabase.functions.invoke(
          "validate-apple-subscription",
          { body: { transactionId, productId } }
        );

        if (error || !data?.active) {
          setPurchaseError("We couldn’t verify your subscription yet. Please try again.");
          trackPurchaseResult("error", productId);
          return;
        }

        trackPurchaseResult("success", productId);
        void upsertUserSettingsOnboarding(user?.id, {
          onboarding_step: undefined,
        });
        void upsertOnboardingResponses(user?.id, {
          onboarding_completed_at: new Date().toISOString(),
        });
        if (user?.email && !user.email_confirmed_at) {
          setShowVerifyReminder(true);
        } else {
          router.replace("/(tabs)/journal");
        }
      } finally {
        try {
          await finishTransaction({ purchase });
        } catch {
          // noop
        }
        setLoading(false);
      }
    });

    const errorSub = purchaseErrorListener((error) => {
      if (error?.code === ErrorCode.UserCancelled) {
        trackPurchaseResult("cancel");
      } else {
        trackPurchaseResult("error");
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      updateSub.remove();
      errorSub.remove();
    };
  }, [router, user?.email, user?.email_confirmed_at, user?.id]);

  const selectPlan = (plan: PlanId) => {
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    setLoading(true);
    setPurchaseError(null);
    try {
      const sku = selectedPlan === "annual" ? "prayer_journal_yearly" : "prayer_journal_monthly";
      await requestPurchase({
        type: "subs",
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
      });
    } catch {
      trackPurchaseResult("error");
      setPurchaseError("Could not start the purchase. Please try again.");
      setLoading(false);
    } finally {
      // handled in listener
    }
  };

  const handleSkip = () => {
    trackOnboardingAction("paywall", "skip");
    router.replace("/(auth)/onboarding/congratulations");
  };

  const handleDismissVerify = () => {
    setShowVerifyReminder(false);
    router.replace("/(tabs)/journal");
  };

  const handleResendVerify = async () => {
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
        <Text style={styles.title}>Try for Free</Text>
        <Text style={styles.subtitle}>Start your free trial and cancel anytime.</Text>

        <View style={styles.cards}>
          {(() => {
            const yearly = products.find((p) => p.id === "prayer_journal_yearly");
            const monthly = products.find((p) => p.id === "prayer_journal_monthly");
            return (
              <>
                <TouchableOpacity
                  style={[styles.card, selectedPlan === "annual" && styles.cardActive]}
                  onPress={() => selectPlan("annual")}
                  activeOpacity={0.85}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Most Popular</Text>
                  </View>
                  <Text style={styles.cardTitle}>Annual</Text>
                  <Text style={styles.cardPrice}>{yearly?.displayPrice ?? "Loading…"}</Text>
                  <Text style={styles.cardMeta}>7-day free trial</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.card, selectedPlan === "monthly" && styles.cardActive]}
                  onPress={() => selectPlan("monthly")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cardTitle}>Monthly</Text>
                  <Text style={styles.cardPrice}>{monthly?.displayPrice ?? "Loading…"}</Text>
                  <Text style={styles.cardMeta}>7-day free trial</Text>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.trialNotice}>Free trial ends on [Date]. Cancel anytime.</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title={loading ? "Starting..." : "Start Free Trial"} onPress={handlePurchase} disabled={loading} />
        {loading ? <ActivityIndicator style={styles.spinner} /> : null}
        {purchaseError ? <Text style={styles.purchaseError}>{purchaseError}</Text> : null}

        <View style={styles.legalRow}>
          <LinkText text="Terms" underlineText="Terms" />
          <Text style={styles.legalDivider}>•</Text>
          <LinkText text="Privacy" underlineText="Privacy" />
          <Text style={styles.legalDivider}>•</Text>
          <LinkText text="Restore" underlineText="Restore" />
        </View>

      
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
  cards: {
    marginTop: spacing.xl,
    width: "100%",
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: "#FFFFFF",
  },
  cardActive: {
    borderColor: colors.accentGold,
    backgroundColor: "rgba(227, 198, 123, 0.12)",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textPrimary,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  cardPrice: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  cardMeta: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  features: {
    marginTop: spacing.xl,
    width: "100%",
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureBullet: {
    fontSize: 16,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  featureText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  trialNotice: {
    marginTop: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  legalRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  legalDivider: {
    marginHorizontal: spacing.sm,
    color: colors.textSecondary,
  },
  skip: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
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
  purchaseError: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: "#B00020",
    textAlign: "center",
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
