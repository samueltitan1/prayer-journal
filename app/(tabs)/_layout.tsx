import { Ionicons } from "@expo/vector-icons";
import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { getSupabase } from "@/lib/supabaseClient";
import { getEntitlement } from "@/lib/subscriptions";
import { Tabs, useRouter } from "expo-router";
import { Platform, View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await getSupabase().auth.getSession();
      const session = data.session;
      if (!session?.user?.id) {
        if (__DEV__) console.log("tabs guard: no session -> welcome");
        router.replace("/(auth)/onboarding/welcome");
        if (!cancelled) setChecking(false);
        return;
      }

      const userId = session.user.id;
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
          "signup",
          "login",
          "preparing",
          "paywall",
          "congratulations",
        ]);
        const next = step && allowed.has(step) ? step : "welcome";
        if (__DEV__) console.log("tabs guard: onboarding incomplete ->", next);
        router.replace(`/(auth)/onboarding/${next}`);
        if (!cancelled) setChecking(false);
        return;
      }

      const entitlement = await getEntitlement(userId);
      if (!entitlement.active) {
        if (__DEV__) console.log("tabs guard: no entitlement -> paywall");
        await upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
        router.replace("/(auth)/onboarding/paywall");
        if (!cancelled) setChecking(false);
        return;
      }

      if (!cancelled) setChecking(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.textSecondary + "20",
          height: Platform.OS === "ios" ? 80 : 60,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="pray/index"
        options={{
          title: "Pray",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal/index"
        options={{
          title: "Journal",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
