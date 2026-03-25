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
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { requestNotificationPermissions } from "@/lib/notifications";
import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { identifyUser, initPostHog, resetAnalytics } from "@/lib/posthog";
import "@/lib/prayerWalkLocationTask";
import { refreshAppleSubscriptionIfNeeded } from "@/lib/refreshSubscription";
import { DevBuildGate } from "@/lib/runtime/requireDevBuild";
import { getEntitlement } from "@/lib/subscriptions";

function RootNavigator() {
  const auth = useAuth();
  if (!auth) return null;

  const { user, loading } = auth;
  const userId = user?.id ?? null;
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);
  const [entitled, setEntitled] = useState<boolean | null>(null);
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
        setOnboardingStep(null);
        setEntitled(null);
        paywallUpsertedForUserRef.current = null;
        lastSnapshotLogKeyRef.current = null;
        return;
      }
      await refreshAppleSubscriptionIfNeeded(userId);
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
      setOnboardingStep(step);
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
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  if (loading || (userId && (onboardingComplete === null || entitled === null))) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
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
      ) : entitled === false ? (
        <Stack.Screen name="(auth)" />
      ) : (
        // Ensure tabs mounts to an existing route (you do NOT have app/(tabs)/index.tsx)
        <Stack.Screen name="(tabs)"/>
      )}
    </Stack>
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

  const navigateFromDeepLink = useCallback((url: string | null) => {
    if (!url) return;
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? "").replace(/^\/+/, "");
    if (path === "pray") {
      router.replace("/(tabs)/pray");
    }
  }, [router]);

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
      const url = response.notification.request.content.data?.url;
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
              <RootNavigator />
            </SafeAreaProvider>
          </AuthProvider>
        </ThemeProvider>
      </DevBuildGate>
    </GestureHandlerRootView>
  );
}
