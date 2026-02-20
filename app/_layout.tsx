// app/_layout.tsx
import { Inter_400Regular, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { requestNotificationPermissions } from "@/lib/notifications";
import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { identifyUser, initPostHog, resetAnalytics } from "@/lib/posthog";
import { DevBuildGate } from "@/lib/runtime/requireDevBuild";
import { getEntitlement } from "@/lib/subscriptions";

function RootNavigator() {
  const auth = useAuth();
  if (!auth) return null;

  const { user, loading } = auth;
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);
  const [entitled, setEntitled] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user?.id) {
      identifyUser(user.id);
    } else {
      resetAnalytics();
    }
  }, [loading, user]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) {
        setOnboardingComplete(null);
        setOnboardingStep(null);
        setEntitled(null);
        return;
      }
      const [onboarding, entitlement] = await Promise.all([
        getOnboardingResponsesSnapshot(user.id),
        getEntitlement(user.id),
      ]);
      if (cancelled) return;
      const completed = Boolean(onboarding?.onboarding_completed_at);
      setOnboardingComplete(completed);
      setOnboardingStep(onboarding?.onboarding_step ?? null);
      setEntitled(entitlement.active);
      if (__DEV__) {
        console.log("layout: snapshot", {
          completed,
          step: onboarding?.onboarding_step ?? null,
          entitled: entitlement.active,
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (onboardingComplete === true && entitled === false) {
      void upsertOnboardingResponses(user.id, { onboarding_step: "paywall" });
    }
  }, [entitled, onboardingComplete, user?.id]);

  if (loading || (user?.id && (onboardingComplete === null || entitled === null))) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack
      key={user ? "authenticated" : "unauthenticated"}
      screenOptions={{ headerShown: false }}
    >
      {!user ? (
        <Stack.Screen name="(auth)" />
      ) : onboardingComplete === false ? (
        <Stack.Screen name="(auth)" />
      ) : entitled === false ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <Stack.Screen name="(tabs)" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_700Bold,
  });

  useEffect(() => {
    requestNotificationPermissions();
    initPostHog();
  }, []);

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
