import { Stack } from 'expo-router';
import { useEffect } from "react";
import { AppState } from "react-native";
import { trackOnboardingAbandoned } from "@/lib/analytics/onboarding";

export default function OnboardingLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        trackOnboardingAbandoned("app_background");
      }
    });
    return () => {
      subscription.remove();
      trackOnboardingAbandoned("screen_unmount");
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="index"
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="survey" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="biometric-setup" />
      <Stack.Screen name="apple-health" />
      <Stack.Screen name="login" />
      <Stack.Screen name="reminder" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="confirm-email" />
      <Stack.Screen name="preparing" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="congratulations" />
    </Stack>
  );
}
