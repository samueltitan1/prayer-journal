// app/_layout.tsx
import { Inter_400Regular } from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_500Medium,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { requestNotificationPermissions } from "@/lib/notifications";

function RootNavigator() {
  const auth = useAuth();
  const user = auth?.user ?? null;

  return (
    <SettingsProvider userId={user?.id ?? null}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* 👇 Explicitly registered route groups */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </SettingsProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    Inter_400Regular,
  });

  useEffect(() => {
    requestNotificationPermissions();
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
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}