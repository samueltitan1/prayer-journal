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
import { colors, fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  {
    title: "Become consistent",
    subtitle: "Journal without friction by voice, text or while walking",
  },
  {
    title: "Reflect and grow",
    subtitle: "Read or listen back - search prayers by date, keyword or verse",
  },
  {
    title: "Watch your faith deepen",
    subtitle: "See patterns of God's faithfulness in your reflections",
  },
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
  const [priceLoadFailed, setPriceLoadFailed] = useState(false);

  const getDisplayedPrice = (product: any, fallback: string) =>
    product?.localizedPrice ?? product?.displayPrice ?? fallback;

  const getCurrencySymbol = (priceString: string) => {
    const match = priceString.match(/^[^\d]+/);
    return (match?.[0] ?? "£").trim();
  };

  const parsePriceNumber = (priceString: string) => {
    const normalized = priceString.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : null;
  };

  const formatMoney = (symbol: string, amount: number) =>
    `${symbol}${amount.toFixed(2)}`;

    // Helper to floor a number to 2 decimals (marketing-friendly, e.g. 4.999 -> 4.99)
    const floorTo2 = (value: number) => Math.floor(value * 100) / 100;

  useEffect(() => {
    trackPaywallViewed();
    trackOnboardingStepViewed("paywall");
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: "paywall",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await initConnection();
        // NOTE: iOS Simulator won't load real IAP products; verify on TestFlight/device.
        const subs = await fetchProducts({
          skus: productIds as unknown as string[],
          type: "subs",
        });
        if (__DEV__) {
          console.log("IAP subs:", subs);
        }
        if (mounted) setProducts(subs as ProductSubscription[]);
      } catch {
        if (__DEV__) {
          console.log("IAP subs failed to load");
        }
        // noop; UI will show fallback
      }
    };
    run();
    const timeout = setTimeout(() => {
      if (mounted && products.length === 0) setPriceLoadFailed(true);
    }, 3000);

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
        void upsertOnboardingResponses(user?.id, {
          onboarding_step: null,
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
      clearTimeout(timeout);
      updateSub.remove();
      errorSub.remove();
    };
  }, [router, user?.email, user?.email_confirmed_at, user?.id, products.length]);

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
        <Text style={styles.title}>We want you to try Prayer Journal for free</Text>
        <Text style={styles.subtitle}>No commitment - Cancel anytime</Text>
        <Image
            source={require("@/assets/silvermockup.png")}
            style={styles.image}
            resizeMode="contain"
          />
        <View style={styles.paywallCard}>
          <View style={styles.features}>
            {FEATURES.map((feature, index) => (
              <View
                key={feature.title}
                style={[
                  styles.featureRow,
                  index === FEATURES.length - 1 && styles.featureRowLast,
                ]}
              >
                <View style={styles.featureIconWrap}>
                  <Text style={styles.checkIcon}>✓</Text>
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.dividerLine} />

          <View style={styles.cards}>
            {(() => {
              const yearly = products.find(
                (p) => (p as any).productId === "prayer_journal_yearly" || p.id === "prayer_journal_yearly"
              );
              const monthly = products.find(
                (p) => (p as any).productId === "prayer_journal_monthly" || p.id === "prayer_journal_monthly"
              );
              const yearlyFull = getDisplayedPrice(yearly, "£59.99");
              const monthlyFull = getDisplayedPrice(monthly, "£9.99");

              const symbol = getCurrencySymbol(yearlyFull || monthlyFull || "£");
              const yearlyNum = parsePriceNumber(yearlyFull);
              const monthlyNum = parsePriceNumber(monthlyFull);

              const yearlyPerMonth = yearlyNum ? floorTo2(yearlyNum / 12) : 4.99;
              const monthlyPerMonth = monthlyNum ? monthlyNum : 9.99;

              const yearlyPerMonthLabel = `${formatMoney(symbol, yearlyPerMonth)} / month`;
              const monthlyPerMonthLabel = `${formatMoney(symbol, monthlyPerMonth)} / month`;

              return (
                <>
                  <TouchableOpacity
                    style={[styles.planRow, selectedPlan === "annual" && styles.planRowActive]}
                    onPress={() => selectPlan("annual")}
                    activeOpacity={0.85}
                  >
                    <View style={styles.planLeft}>
                      <View
                        style={[
                          styles.selectCircle,
                          selectedPlan === "annual" && styles.selectCircleActive,
                        ]}
                      >
                        {selectedPlan === "annual" ? (
                          <Text style={styles.selectCheck}>✓</Text>
                        ) : null}
                      </View>
                      <View style={styles.planTextCol}>
                        <Text style={styles.planTitle}>Annual</Text>
                        <Text style={styles.planSub}>
                          {yearly ? yearlyFull : priceLoadFailed ? yearlyFull : "Loading…"}
                        </Text>
                        <Text style={styles.planSubMuted}>Billed yearly</Text>
                      </View>
                    </View>
                    <View style={styles.planRight}>
                      <Text style={styles.perMonthText}>{yearlyPerMonthLabel}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.planRow, selectedPlan === "monthly" && styles.planRowActive]}
                    onPress={() => selectPlan("monthly")}
                    activeOpacity={0.85}
                  >
                    <View style={styles.planLeft}>
                      <View
                        style={[
                          styles.selectCircle,
                          selectedPlan === "monthly" && styles.selectCircleActive,
                        ]}
                      >
                        {selectedPlan === "monthly" ? (
                          <Text style={styles.selectCheck}>✓</Text>
                        ) : null}
                      </View>
                      <View style={styles.planTextCol}>
                        <Text style={styles.planTitle}>Monthly</Text>
                        <Text style={styles.planSub}>
                          {monthly ? monthlyFull : priceLoadFailed ? monthlyFull : "Loading…"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.planRight}>
                      <Text style={styles.perMonthText}>{monthlyPerMonthLabel}</Text>
                    </View>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>

          {priceLoadFailed ? (
            <Text style={styles.priceError}>Unable to load prices</Text>
          ) : null}

          <Text style={styles.commitmentText}>No Payment Due Now</Text>
          <PrimaryButton
            title={loading ? "Starting..." : "Continue"}
            onPress={handlePurchase}
            disabled={loading}
          />
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
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 29,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  paywallCard: {
    marginTop: -115,
    width: "120%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  features: {
    width: "100%",
    gap: spacing.xs,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary + "25",
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.textSecondary + "25",
    marginVertical: spacing.sm,
  },
  cards: {
    width: "100%",
    gap: spacing.sm,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "#FFFFFF",
  },
  planRowActive: {
    borderColor: colors.accentGold,
    backgroundColor: "rgba(227, 198, 123, 0.12)",
  },
  planLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  planTextCol: {
    flex: 1,
  },
  planRight: {
    alignItems: "flex-end",
    minWidth: 110,
  },
  planTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textPrimary,
  },
  planSub: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  planSubMuted: {
    marginTop: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  perMonthText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  selectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.textSecondary + "60",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  selectCircleActive: {
    backgroundColor: colors.accentGold,
    borderColor: colors.accentGold,
  },
  selectCheck: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  featureSubtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  priceError: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  commitmentText: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: "center",
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
  checkIcon: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.accentGold,
    lineHeight: 18,
  },
  image: {
    width: 350,
    height: 350,
    marginTop: spacing.xs,
  },

});
