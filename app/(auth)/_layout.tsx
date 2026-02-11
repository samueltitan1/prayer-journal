import { useAuth } from "@/contexts/AuthProvider";
import { Redirect, Stack, useSegments } from "expo-router";

export default function AuthLayout() {
  const auth = useAuth();
  const segments = useSegments();
  const isOnboardingRoute = segments.includes("onboarding");

  if (!auth || auth.loading) return null;

  // If user is logged in, only allow access to onboarding routes from within (auth)
  if (auth.user && !isOnboardingRoute) {
    return <Redirect href="/(tabs)" />;
  }

  // Always mount onboarding stack inside (auth)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
