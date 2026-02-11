import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="welcome"
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="survey" />
      <Stack.Screen name="privacy" />
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
