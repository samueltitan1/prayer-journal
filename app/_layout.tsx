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
import { getOnboardingResponsesSnapshot } from "@/lib/onboardingResponses";
import { identifyUser, initPostHog, resetAnalytics } from "@/lib/posthog";
import { getEntitlement } from "@/lib/subscriptions";
import { getUserSettingsSnapshot } from "@/lib/userSettings";
import { DevBuildGate } from "@/lib/runtime/requireDevBuild";

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
      const [settings, onboarding, entitlement] = await Promise.all([
        getUserSettingsSnapshot(user.id),
        getOnboardingResponsesSnapshot(user.id),
        getEntitlement(user.id),
      ]);
      if (cancelled) return;
      const completed = Boolean(onboarding?.onboarding_completed_at);
      setOnboardingComplete(completed);
      setOnboardingStep(settings?.onboarding_step ?? null);
      setEntitled(entitlement.active);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
      ) : onboardingComplete === false && onboardingStep === "preparing" ? (
        <Stack.Screen name="(auth)/onboarding/preparing" />
      ) : onboardingComplete === true && entitled === false ? (
        <Stack.Screen name="(auth)/onboarding/paywall" />
      ) : onboardingComplete === false ? (
        <Stack.Screen name="(auth)/onboarding" />
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
