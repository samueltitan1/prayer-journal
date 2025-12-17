import { useAuth } from "@/contexts/AuthProvider";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const auth = useAuth();

  // While auth is initializing, render nothing
  if (!auth || auth.loading) return null;

  // If user somehow exists, never allow auth stack
  if (auth.user) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, force entry to login
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}