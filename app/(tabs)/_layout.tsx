import SettingsModal from "@/components/SettingsModal";
import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { getEntitlement } from "@/lib/subscriptions";
import { getSupabase } from "@/lib/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, spacing } from "../../theme/theme";
import { useTheme } from "../../contexts/ThemeContext";

type TabsChromeContextValue = {
  openSettings: () => void;
  settingsRefreshNonce: number;
  setHeaderVisible: (visible: boolean) => void;
};

const TabsChromeContext = createContext<TabsChromeContextValue | null>(null);

export const useTabsChrome = () => {
  const ctx = useContext(TabsChromeContext);
  if (!ctx) {
    throw new Error("useTabsChrome must be used inside app/(tabs)/_layout TabsChromeContext");
  }
  return ctx;
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const [checking, setChecking] = useState(true);
  const [settingsUserId, setSettingsUserId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsRefreshNonce, setSettingsRefreshNonce] = useState(0);
  const [headerVisible, setHeaderVisibleState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await getSupabase().auth.getSession();
      const session = data.session;
      if (!session?.user?.id) {
        setSettingsUserId(null);
        if (__DEV__) console.log("tabs guard: no session -> welcome");
        router.replace("/(auth)/onboarding/welcome");
        if (!cancelled) setChecking(false);
        return;
      }

      const userId = session.user.id;
      setSettingsUserId(userId);
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

  const getTabConfig = (rawRouteName: string) => {
    const normalizedName = rawRouteName.replace(/\/index$/, "");
    if (normalizedName === "pray") {
      return {
        title: "Pray",
        tabBarLabel: "Pray",
        iconName: "mic-outline" as const,
      };
    }
    if (normalizedName === "journal") {
      return {
        title: "Journal",
        tabBarLabel: "Journal",
        iconName: "book-outline" as const,
      };
    }
    return null;
  };

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
    setSettingsRefreshNonce((n) => n + 1);
  }, []);

  const setHeaderVisible = useCallback((visible: boolean) => {
    setHeaderVisibleState(visible);
  }, []);

  const activeTab = segments[segments.length - 1] ?? "";
  const headerBorderColor =
    activeTab === "pray" ? colors.textSecondary + "33" : colors.textSecondary + "20";

  const tabsChromeValue = useMemo(
    () => ({
      openSettings,
      settingsRefreshNonce,
      setHeaderVisible,
    }),
    [openSettings, settingsRefreshNonce, setHeaderVisible]
  );

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <TabsChromeContext.Provider value={tabsChromeValue}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {headerVisible ? (
          <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: colors.background }}>
            <View style={[styles.header, { borderBottomColor: headerBorderColor }]}>
              <View style={styles.leftHeader}>
                <Image
                  source={require("../../assets/Logo2.png")}
                  style={{ width: 44, height: 44, marginRight: 8 }}
                  resizeMode="contain"
                />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Prayer Journal
                </Text>
              </View>
              <TouchableOpacity onPress={openSettings}>
                <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        ) : null}
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={({ route }) => {
              const tabConfig = getTabConfig(route.name);
              return {
                headerShown: false,
                tabBarStyle: {
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.textSecondary + "20",
                  height: Platform.OS === "ios" ? 80 : 60,
                  paddingBottom: Platform.OS === "ios" ? 20 : 8,
                  paddingTop: 8,
                },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: {
                  fontSize: 12,
                  fontWeight: "600",
                },
                title: tabConfig?.title,
                tabBarLabel: tabConfig?.tabBarLabel,
                tabBarIcon: ({ color, size }) =>
                  tabConfig ? (
                    <Ionicons name={tabConfig.iconName} size={size ?? 22} color={color} />
                  ) : undefined,
              };
            }}
          >
            <Tabs.Screen
              name="pray/index"
              options={{
                title: "Pray",
                tabBarLabel: "Pray",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="mic-outline" size={size ?? 22} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="journal/index"
              options={{
                title: "Journal",
                tabBarLabel: "Journal",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="book-outline" size={size ?? 22} color={color} />
                ),
              }}
            />
          </Tabs>
        </View>
        <SettingsModal visible={showSettings} onClose={closeSettings} userId={settingsUserId} />
      </View>
    </TabsChromeContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftHeader: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
});
