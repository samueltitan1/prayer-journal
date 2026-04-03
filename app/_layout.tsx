// app/_layout.tsx
import { Inter_400Regular, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import {
  getBiometricLockEnabled,
  hasSeenBiometricOnboarding,
  promptBiometricAuth,
} from "@/lib/biometricLock";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  requestNotificationPermissions,
  scheduleTrialEndingReminderNotification,
} from "@/lib/notifications";
import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { identifyUser, initPostHog, resetAnalytics } from "@/lib/posthog";
import "@/lib/prayerWalkLocationTask";
import { refreshSubscriptionIfNeeded } from "@/lib/refreshSubscription";
import { DevBuildGate } from "@/lib/runtime/requireDevBuild";
import { getEntitlement } from "@/lib/subscriptions";
import { getSupabase } from "@/lib/supabaseClient";
import {
  buildTrialReminderPlan,
  getTrialReminderRow,
  markTrialReminderInAppShown,
  markTrialReminderScheduled,
} from "@/lib/trialReminders";

function RootNavigator() {
  const auth = useAuth();
  if (!auth) return null;

  const router = useRouter();
  const { user, loading } = auth;
  const userId = user?.id ?? null;
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [biometricOnboardingSeen, setBiometricOnboardingSeen] = useState<boolean | null>(null);
  const [trialReminderFallback, setTrialReminderFallback] = useState<string | null>(null);
  const paywallUpsertedForUserRef = useRef<string | null>(null);
  const lastSnapshotLogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (userId) {
      identifyUser(userId);
    } else {
      resetAnalytics();
    }
  }, [loading, userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) {
        setOnboardingComplete(null);
        setEntitled(null);
        setBiometricOnboardingSeen(null);
        paywallUpsertedForUserRef.current = null;
        lastSnapshotLogKeyRef.current = null;
        return;
      }
      try {
        const seen = await hasSeenBiometricOnboarding();
        if (cancelled) return;
        setBiometricOnboardingSeen(seen);
        await refreshSubscriptionIfNeeded(userId);
        if (cancelled) return;
        const [onboarding, entitlement] = await Promise.all([
          getOnboardingResponsesSnapshot(userId),
          getEntitlement(userId),
        ]);
        if (cancelled) return;
        const completed = Boolean(onboarding?.onboarding_completed_at);
        const step = onboarding?.onboarding_step ?? null;
        const entitlementActive = entitlement.active;
        setOnboardingComplete(completed);
        setEntitled(entitlement.active);
        if (__DEV__) {
          const snapshotLogKey = `${userId}:${String(completed)}:${String(step)}:${String(
            entitlementActive
          )}`;
          if (lastSnapshotLogKeyRef.current !== snapshotLogKey) {
            lastSnapshotLogKeyRef.current = snapshotLogKey;
            console.log("layout: snapshot", {
              completed,
              step,
              entitled: entitlementActive,
            });
          }
        }
      } catch (error) {
        console.error("layout: failed to load auth snapshot", error);
        if (!cancelled) {
          setOnboardingComplete(false);
          setEntitled(false);
          setBiometricOnboardingSeen(true);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (onboardingComplete !== true) return;
    if (biometricOnboardingSeen !== false) return;
    void upsertOnboardingResponses(userId, {
      onboarding_step: "biometric-setup",
      onboarding_last_seen_at: new Date().toISOString(),
    });
    router.replace("/(auth)/onboarding/biometric-setup");
  }, [biometricOnboardingSeen, onboardingComplete, router, userId]);

  useEffect(() => {
    if (!userId) {
      paywallUpsertedForUserRef.current = null;
      return;
    }
    if (onboardingComplete === true && entitled === false && paywallUpsertedForUserRef.current !== userId) {
      paywallUpsertedForUserRef.current = userId;
      void upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
    }
  }, [entitled, onboardingComplete, userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId || onboardingComplete !== true) {
        setTrialReminderFallback(null);
        return;
      }

      try {
        const row = await getTrialReminderRow(userId);
        if (cancelled) return;

        const plan = buildTrialReminderPlan(row);
        if (!plan) {
          setTrialReminderFallback(null);
          return;
        }

        const scheduled = await scheduleTrialEndingReminderNotification({
          dedupeKey: plan.dedupeKey,
          triggerAt: plan.triggerAt,
          title: plan.title,
          body: plan.body,
        });
        if (cancelled) return;

        if (scheduled.scheduled) {
          await markTrialReminderScheduled(userId, plan.dedupeKey);
          if (cancelled) return;
          setTrialReminderFallback(null);
          return;
        }

        if (scheduled.reason === "already_scheduled") {
          await markTrialReminderScheduled(userId, plan.dedupeKey);
          if (cancelled) return;
          setTrialReminderFallback(null);
          return;
        }

        await markTrialReminderInAppShown(userId, plan.dedupeKey);
        if (cancelled) return;
        setTrialReminderFallback(plan.fallbackMessage);
      } catch (error) {
        console.error("layout: trial reminder sync failed", error);
        if (!cancelled) setTrialReminderFallback(null);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onboardingComplete, userId]);

  if (
    loading ||
    (userId && (onboardingComplete === null || entitled === null || biometricOnboardingSeen === null))
  ) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        key={userId ? "authenticated" : "unauthenticated"}
        screenOptions={{ headerShown: false }}
      >
        {/*
          Keep `index` registered at the root so the app shell remains complete.
        */}
        <Stack.Screen name="index" />
  
        {!userId ? (
          <Stack.Screen name="(auth)" />
        ) : onboardingComplete === false ? (
          <Stack.Screen name="(auth)" />
        ) : biometricOnboardingSeen === false ? (
          <Stack.Screen name="(auth)" />
        ) : entitled === false ? (
          <Stack.Screen name="(auth)" />
        ) : (
          // Ensure tabs mounts to an existing route (you do NOT have app/(tabs)/index.tsx)
          <Stack.Screen name="(tabs)"/>
        )}
      </Stack>
      {trialReminderFallback ? (
        <View style={styles.trialFallbackBanner}>
          <Text style={styles.trialFallbackText}>{trialReminderFallback}</Text>
          <TouchableOpacity onPress={() => setTrialReminderFallback(null)}>
            <Text style={styles.trialFallbackDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function BiometricLockGate({ children }: { children: any }) {
  const auth = useAuth();
  if (!auth) return children;
  const { user, loading } = auth;
  const userId = user?.id ?? null;

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const unlockingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const unlock = useCallback(async () => {
    if (!biometricEnabled) return;
    if (unlockingRef.current) return;
    unlockingRef.current = true;
    try {
      const result = await promptBiometricAuth("Unlock Prayer Journal");
      if (result.success) setLocked(false);
    } finally {
      unlockingRef.current = false;
    }
  }, [biometricEnabled]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId || loading) {
        setBiometricEnabled(false);
        setLocked(false);
        setChecking(false);
        return;
      }
      const enabled = await getBiometricLockEnabled();
      if (cancelled) return;
      setBiometricEnabled(enabled);
      if (!enabled) {
        setLocked(false);
        setChecking(false);
        return;
      }
      setLocked(true);
      setChecking(false);
      await unlock();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loading, unlock, userId]);

  useEffect(() => {
    if (!userId || !biometricEnabled) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === "background" || nextState === "inactive") {
        setLocked(true);
        return;
      }
      if (nextState === "active" && prevState !== "active" && locked) {
        void unlock();
      }
    });
    return () => sub.remove();
  }, [biometricEnabled, locked, unlock, userId]);

  if (checking) {
    return (
      <View style={styles.lockWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && biometricEnabled ? (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockTitle}>App Locked</Text>
          <Text style={styles.lockBody}>Unlock with Face ID / Touch ID to continue.</Text>
          <TouchableOpacity style={styles.lockButton} onPress={() => void unlock()}>
            <Text style={styles.lockButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_700Bold,
  });

  const navigateFromDeepLink = useCallback(
    (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = (parsed.path ?? "").replace(/^\/+/, "");
      if (path !== "pray") return;

      void (async () => {
        try {
          const { data } = await getSupabase().auth.getSession();
          const userId = data.session?.user?.id ?? null;

          if (!userId) {
            router.replace("/(auth)/onboarding/welcome");
            return;
          }

          const onboarding = await getOnboardingResponsesSnapshot(userId);
          const completed = Boolean(onboarding?.onboarding_completed_at);
          const step = onboarding?.onboarding_step ?? null;

          if (!completed) {
            const allowed = new Set([
              "welcome",
              "survey",
              "privacy",
              "apple-health",
              "reminder",
              "preparing",
              "paywall",
              "congratulations",
            ]);
            const next = step && allowed.has(step) ? step : "welcome";
            router.replace(`/(auth)/onboarding/${next}`);
            return;
          }

          const entitlement = await getEntitlement(userId);
          if (!entitlement.active) {
            await upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
            router.replace("/(auth)/onboarding/paywall");
            return;
          }

          router.replace("/(tabs)/pray");
        } catch {
          router.replace("/(auth)/onboarding/welcome");
        }
      })();
    },
    [router]
  );

  useEffect(() => {
    requestNotificationPermissions();
    initPostHog();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      navigateFromDeepLink(url);
    });

    const sub = Linking.addEventListener("url", (event) => {
      navigateFromDeepLink(event.url);
    });

    return () => {
      sub.remove();
    };
  }, [navigateFromDeepLink]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (typeof url === "string") {
        navigateFromDeepLink(url);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (typeof url === "string") {
        navigateFromDeepLink(url);
      }
    });

    return () => {
      sub.remove();
    };
  }, [navigateFromDeepLink]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#E3C67B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DevBuildGate>
        <ThemeProvider>
          <AuthProvider>
            <SafeAreaProvider>
              <BiometricLockGate>
                <RootNavigator />
              </BiometricLockGate>
            </SafeAreaProvider>
          </AuthProvider>
        </ThemeProvider>
      </DevBuildGate>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  lockWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  lockTitle: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  lockBody: {
    marginTop: 10,
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  lockButton: {
    marginTop: 16,
    backgroundColor: "#E3C67B",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lockButtonText: {
    color: "#2F2F2F",
    fontWeight: "700",
  },
  trialFallbackBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  trialFallbackText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
  trialFallbackDismiss: {
    color: "#E3C67B",
    fontWeight: "700",
  },
});
