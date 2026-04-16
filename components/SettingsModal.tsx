// components/SettingsModal.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Application from "expo-application";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getBiometricAvailability,
  getBiometricLockEnabled as getBiometricLockEnabledStorage,
  promptBiometricAuth,
  setBiometricLockEnabled as setBiometricLockEnabledStorage,
} from "../lib/biometricLock";
import {
  cancelDailyPrayerNotification,
  cancelNightlyReflectionPrompt,
  getNightlyReflectionPromptStatus,
  requestNotificationPermissions,
  scheduleDailyPrayerNotification,
  scheduleNightlyReflectionPrompt,
} from "../lib/notifications";
import { capture } from "../lib/posthog";

import { router } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../contexts/ThemeContext";
import { getSupabase } from "../lib/supabaseClient";
import { setWidgetSignedInState } from "../lib/widgetAuthState";
import { fonts, spacing } from "../theme/theme";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
}

type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  provider: string | null;
  current_period_end: string | null;
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;
const DAILY_REMINDER_COLUMN_CANDIDATES = [
  "daily_reminder_enabled",
  "reminder_enabled",
] as const;

function getRuntimeVersionLabel() {
  const appVersion = Application.nativeApplicationVersion ?? "1.0.0";
  const buildVersion = Application.nativeBuildVersion;
  return buildVersion ? `v${appVersion} (${buildVersion})` : `v${appVersion}`;
}

export default function SettingsModal({
  visible,
  onClose,
  userId,
}: SettingsModalProps) {
  const { theme, themePreference, setTheme, colors } = useTheme();
  const isDark = theme === "dark";
  const themeStatusLabel =
    themePreference === "system"
      ? `Following system (${theme === "dark" ? "Dark" : "Light"})`
      : theme === "dark"
      ? "Dark theme active"
      : "Light theme active";

  // ==========================
  // State
  // ==========================
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [nightlyReflectionEnabled, setNightlyReflectionEnabled] = useState(true);
  const [deleteAudioAfterTranscription, setDeleteAudioAfterTranscription] =
    useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [subscriptionRow, setSubscriptionRow] = useState<SubscriptionRow | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [version] = useState(getRuntimeVersionLabel);
  const [hasReflectiveSummary, setHasReflectiveSummary] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [biometricHasHardware, setBiometricHasHardware] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const dailyReminderColumnRef = useRef<(typeof DAILY_REMINDER_COLUMN_CANDIDATES)[number]>(
    "daily_reminder_enabled"
  );
  // ==========================
  // Toast
  // ==========================
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  const refreshBiometricAvailability = async () => {
    try {
      const availability = await getBiometricAvailability();
      setBiometricHasHardware(availability.hasHardware);
      setBiometricEnrolled(availability.isEnrolled);
      const supported = availability.supported;

      if (!supported) {
        setBiometricLockEnabled(false);
        await setBiometricLockEnabledStorage(false);
        return { hasHardware: availability.hasHardware, isEnrolled: availability.isEnrolled };
      }

      const stored = await getBiometricLockEnabledStorage();
      setBiometricLockEnabled(stored);
      return { hasHardware: true, isEnrolled: true };
    } catch {
      setBiometricHasHardware(false);
      setBiometricEnrolled(false);
      setBiometricLockEnabled(false);
      await setBiometricLockEnabledStorage(false);
      return { hasHardware: false, isEnrolled: false };
    }
  };

  // ==========================
  // Backdrop
  // ==========================
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const fadeInBackdrop = () => {
    backdropOpacity.setValue(0);
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  const fadeOutBackdrop = (callback?: () => void) => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  };

  // ==========================
  // Bottom Sheet
  // ==========================
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const openSheet = () => {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.spring(translateY, {
      toValue: SHEET_HEIGHT,
      damping: 20,
      stiffness: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  };

  const closeEverything = () => {
    fadeOutBackdrop();
    closeSheet(onClose);
  };

  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          closeEverything();
        } else {
          openSheet();
        }
      },
    })
  ).current;

  // ==========================
  // Load settings
  // ==========================
  useEffect(() => {
    if (!visible || !userId) return;

    setLoadingSettings(true);
    setLoadingSubscription(true);
    setUserEmail(null);
    setSubscriptionRow(null);
    fadeInBackdrop();
    openSheet();
    void refreshBiometricAvailability();
    const loadSettings = async () => {
      const { data, error } = await getSupabase()
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const reminderColumn = DAILY_REMINDER_COLUMN_CANDIDATES.find(
          (key) => typeof (data as any)?.[key] === "boolean"
        );
        if (reminderColumn) {
          dailyReminderColumnRef.current = reminderColumn;
        }
        setDailyReminderEnabled(
          (data as any)?.[dailyReminderColumnRef.current] ?? false
        );
        setReminderTime(data.reminder_time ?? "08:00");
        setDeleteAudioAfterTranscription(
          data.delete_audio_after_transcription ?? false
        );
        setHasReflectiveSummary(data.has_reflective_summary ?? false);
      }

      setLoadingSettings(false);
    };

    loadSettings();

    const loadAccountAndSubscription = async () => {
      try {
        const { data: userData } = await getSupabase().auth.getUser();
        setUserEmail(userData?.user?.email ?? null);
      } catch {
        setUserEmail(null);
      }

      try {
        const { data, error } = await getSupabase()
          .from("subscriptions")
          .select("plan,status,provider,current_period_end,created_at")
          .eq("user_id", userId)
          .order("current_period_end", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          setSubscriptionRow(null);
        } else {
          setSubscriptionRow({
            plan: data.plan ?? null,
            status: data.status ?? null,
            provider: data.provider ?? null,
            current_period_end: data.current_period_end ?? null,
          });
        }
      } catch {
        setSubscriptionRow(null);
      } finally {
        setLoadingSubscription(false);
      }
    };
    loadAccountAndSubscription();

    // Nightly reflection toggle and schedule (local-only)
    (async () => {
      try {
        // Default ON unless user explicitly turned it off before
        const stored = await AsyncStorage.getItem("nightly_reflection_enabled");
        const enabled = stored === null ? true : stored === "true";
        setNightlyReflectionEnabled(enabled);

        if (!enabled) {
          await cancelNightlyReflectionPrompt();
          return;
        }

        // Ensure it's scheduled (idempotent)
        const status = await getNightlyReflectionPromptStatus();
        if (!status.enabled) {
          const ok = await requestNotificationPermissions();
          if (ok) await scheduleNightlyReflectionPrompt();
        }
      } catch {
        // ignore
      }
    })();
  }, [visible, userId]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshBiometricAvailability();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [visible]);

  const normalizedProvider = (subscriptionRow?.provider ?? "").toLowerCase();
  const providerLabel =
    normalizedProvider === "apple"
      ? "Apple"
      : normalizedProvider === "stripe"
      ? "Stripe"
      : "—";
  const canManageSubscription = normalizedProvider === "apple";
  const planLabel = subscriptionRow?.plan ?? "—";
  const statusLabel = subscriptionRow?.status ?? "Subscription unavailable";
  const renewalLabel = (() => {
    if (!subscriptionRow?.current_period_end) return "—";
    const date = new Date(subscriptionRow.current_period_end);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();
  const handleNightlyReflectionToggle = async () => {
    const next = !nightlyReflectionEnabled;
    setNightlyReflectionEnabled(next);
    await AsyncStorage.setItem("nightly_reflection_enabled", String(next));

    if (next) {
      const ok = await requestNotificationPermissions();
      if (!ok) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications to receive nightly reflection prompts."
        );
        setNightlyReflectionEnabled(false);
        await AsyncStorage.setItem("nightly_reflection_enabled", "false");
        return;
      }
      await scheduleNightlyReflectionPrompt();
      capture("nightly_prompt_toggled", { enabled: true });
      showToast("Nightly reflection prompt enabled");
    } else {
      await cancelNightlyReflectionPrompt();
      capture("nightly_prompt_toggled", { enabled: false });
      showToast("Nightly reflection prompt disabled");
    }
  };

  // ==========================
  // Update Setting helper
  // ==========================
  const updateSetting = async (key: string, value: any) => {
    if (!userId) return;

    const attempt = async (actualKey: string) =>
      getSupabase()
        .from("user_settings")
        .upsert(
          {
            user_id: userId,
            [actualKey]: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

    let actualKey = key;
    if (key === "daily_reminder_enabled") {
      actualKey = dailyReminderColumnRef.current;
    }

    const { error } = await attempt(actualKey);
    if (!error) {
      return;
    }

    // Compatibility fallback for legacy schema that still uses reminder_enabled.
    if (
      key === "daily_reminder_enabled" &&
      error?.code === "PGRST204" &&
      actualKey !== "reminder_enabled"
    ) {
      const retry = await attempt("reminder_enabled");
      if (!retry.error) {
        dailyReminderColumnRef.current = "reminder_enabled";
        return;
      }
    }

    console.log("updateSetting error:", key, value, error);
    throw error;
  };

  // ==========================
  // Handlers
  // ==========================
  const handleThemePreferenceChange = (nextTheme: "light" | "dark" | "system") => {
    if (themePreference === nextTheme) return;
    setTheme(nextTheme);

    if (nextTheme === "system") {
      showToast("Theme set to system");
      return;
    }

    showToast(nextTheme === "dark" ? "Dark mode enabled" : "Light mode enabled");
  };

  const handleReminderToggle = async () => {
    const next = !dailyReminderEnabled;
    setDailyReminderEnabled(next);
    setShowTimePicker(next);
  
    try {
      if (next) {
        const ok = await requestNotificationPermissions();
        if (!ok) {
          Alert.alert(
            "Notifications Disabled",
            "Enable notifications to receive reminders."
          );
          setDailyReminderEnabled(false);
          setShowTimePicker(false);
          return;
        }

        // Persist both values together (with schema-compatible reminder column).
        await updateSetting("daily_reminder_enabled", true);
        await updateSetting("reminder_time", reminderTime);

        await scheduleDailyPrayerNotification(reminderTime);
        capture("daily_reminder_toggled", { enabled: true, time: reminderTime });
        showToast(`Reminder set for ${reminderTime}`);
      } else {
        await updateSetting("daily_reminder_enabled", false);
        await cancelDailyPrayerNotification();
        capture("daily_reminder_toggled", { enabled: false });
        showToast("Daily reminder turned off");
      }
    } catch {
      Alert.alert("Couldn’t update reminder setting", "Please try again.");
      // Roll back optimistic state change.
      setDailyReminderEnabled(!next);
      if (!next) setShowTimePicker(true);
      return;
    }
  };

  const handleTimeChange = async (_: any, date?: Date) => {
    if (!date) return;

    const hrs = `${date.getHours()}`.padStart(2, "0");
    const mins = `${date.getMinutes()}`.padStart(2, "0");
    const t = `${hrs}:${mins}`;

    setReminderTime(t);

    try {
      await updateSetting("reminder_time", t);
    } catch {
      Alert.alert("Couldn’t save reminder time", "Please try again.");
      return;
    }

    if (dailyReminderEnabled) {
      await cancelDailyPrayerNotification();
      await scheduleDailyPrayerNotification(t);
      showToast(`Reminder updated to ${t}`);
    }
  };

  const handleDeleteToggle = async () => {
    const next = !deleteAudioAfterTranscription;
    setDeleteAudioAfterTranscription(next);
    await updateSetting("delete_audio_after_transcription", next);
    showToast(
      next
        ? "Audio will be deleted after transcription"
        : "Audio will be kept"
    );
  };

  const handleReflectiveToggle = async (value: boolean) => {
    setHasReflectiveSummary(value);
    await updateSetting("has_reflective_summary", value);
    showToast(
      value ? "Reflective summaries enabled" : "Reflective summaries disabled"
    );
  };
  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      try {
        const availability = await refreshBiometricAvailability();

        const promptToOpenSettings = () => {
          Alert.alert(
            "Face ID / Touch ID Not Set Up",
            "Set up Face ID or Touch ID in your iPhone settings, then return here to enable app lock.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]
          );
        };
  
        if (!availability.hasHardware) {
          promptToOpenSettings();
          setBiometricLockEnabled(false);
          await setBiometricLockEnabledStorage(false);
          return;
        }

        if (!availability.isEnrolled) {
          promptToOpenSettings();
          setBiometricLockEnabled(false);
          await setBiometricLockEnabledStorage(false);
          return;
        }
  
        // Verify now so user knows it works
        const auth = await promptBiometricAuth("Enable Face ID / Touch ID");
  
        if (!auth.success) {
          setBiometricLockEnabled(false);
          await setBiometricLockEnabledStorage(false);
          return;
        }
        setBiometricLockEnabled(true);
        await setBiometricLockEnabledStorage(true);
        showToast("Face ID / Touch ID lock enabled");
        return;
      } catch {
        Alert.alert(
          "Face ID / Touch ID Error",
          "We couldn’t enable Face ID / Touch ID lock right now. Please try again."
        );
        setBiometricLockEnabled(false);
        await setBiometricLockEnabledStorage(false);
        return;
      }
    }
  
    setBiometricLockEnabled(false);
    await setBiometricLockEnabledStorage(false);
    showToast("Face ID / Touch ID lock disabled");
  };

  const handleSignOut = async () => {
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) {
        throw error;
      }
      await setWidgetSignedInState(false);

      // Clear session keys used by this app and older builds.
      await AsyncStorage.removeItem("prayer-journal-auth");
      await AsyncStorage.removeItem("supabase_session");

      // Best effort cleanup of user-facing reminders after sign-out.
      await cancelDailyPrayerNotification();
      await cancelNightlyReflectionPrompt();

      closeEverything();
      router.replace("/(auth)/onboarding/welcome");
    } catch (err: any) {
      Alert.alert("Sign out failed", err?.message ?? "Please try again.");
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    Alert.alert("Delete Account", "This will permanently delete your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (deletingAccount) return;
          setDeletingAccount(true);
          try {
            const { error } = await getSupabase().rpc("delete_user_and_settings");
            if (error) throw error;

            await getSupabase().auth.signOut();
            await setWidgetSignedInState(false);
            await AsyncStorage.removeItem("prayer-journal-auth");
            await AsyncStorage.removeItem("supabase_session");
            await cancelDailyPrayerNotification();
            await cancelNightlyReflectionPrompt();

            capture("delete_account_success");
            closeEverything();
            router.replace("/(auth)/onboarding/welcome");
          } catch (err: any) {
            capture("delete_account_failure", {
              message: err?.message ?? "unknown_error",
            });
            Alert.alert("Error", err?.message ?? "Could not delete account. Please try again.");
          } finally {
            setDeletingAccount(false);
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  // ==========================
  // JSX
  // ==========================
  return (
    <Modal transparent animationType="none" visible={visible}>
      {/* BACKDROP LAYER */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <BlurView
            tint={isDark ? "dark" : "light"}
            intensity={40}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeEverything} />
      </View>

      {/* SHEET */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: colors.background,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleBar} />
        </View>

        {/* HEADER */}
        <View
          style={[
            styles.headerRow,
            { borderBottomColor: colors.textSecondary + "22" },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Settings
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Manage your preferences and account
            </Text>
          </View>
          <TouchableOpacity onPress={closeEverything}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* BODY */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          {/* APPEARANCE */}
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            APPEARANCE
          </Text>

          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="sunny-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                Night Mode
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                {themeStatusLabel}
              </Text>
            </View>
            <View style={styles.themeOptionGroup}>
              {(["light", "dark", "system"] as const).map((option) => {
                const selected = themePreference === option;
                const label =
                  option === "light" ? "Light" : option === "dark" ? "Dark" : "System";

                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.85}
                    style={[
                      styles.themeOptionButton,
                      {
                        backgroundColor: selected
                          ? colors.accent + "2B"
                          : colors.background,
                        borderColor: selected
                          ? colors.accent
                          : colors.textSecondary + "44",
                      },
                    ]}
                    onPress={() => handleThemePreferenceChange(option)}
                  >
                    <Text
                      style={[
                        styles.themeOptionText,
                        {
                          color: selected ? colors.accent : colors.textSecondary,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* NOTIFICATIONS */}
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            NOTIFICATIONS
          </Text>

          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                Daily Reminder
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                Get reminded to pray
              </Text>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={handleReminderToggle}
            />
          </View>

          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="moon-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                Evening Examen
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                Reflect on God's presence in your day
              </Text>
            </View>
            <Switch
              value={nightlyReflectionEnabled}
              onValueChange={handleNightlyReflectionToggle}
              disabled={loadingSettings}
            />
          </View>

          {dailyReminderEnabled && (
            <>
              <View
                style={[
                  styles.settingRow,
                  { backgroundColor: colors.card },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.textPrimary}
                />
                <View style={styles.settingText}>
                  <Text
                    style={[
                      styles.settingLabel,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Reminder Time
                  </Text>
                  <Text
                    style={[
                      styles.settingSub,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {reminderTime}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowTimePicker((v) => !v)}
                >
                  <Ionicons
                    name={
                      showTimePicker
                        ? "chevron-up-outline"
                        : "chevron-down-outline"
                    }
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {showTimePicker && (
                <View
                  style={[
                    styles.timePickerContainer,
                    { backgroundColor: colors.card },
                  ]}
                >
                  <DateTimePicker
                    value={
                      new Date(
                        2024,
                        0,
                        1,
                        parseInt(reminderTime.split(":")[0] || "8", 10),
                        parseInt(reminderTime.split(":")[1] || "0", 10)
                      )
                    }
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    themeVariant={isDark ? "dark" : "light"}
                  />
                </View>
              )}
            </>
          )}

          {/* PRIVACY */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            PRIVACY
          </Text>

          {/* Delete audio */}
          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <Ionicons name="trash-outline" size={20} color={colors.textPrimary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                Delete Audio Files
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Remove after transcription
              </Text>
            </View>
            <Switch
              value={deleteAudioAfterTranscription}
              onValueChange={handleDeleteToggle}
            />
          </View>

          {/* Face ID / Touch ID lock */}
          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.textPrimary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                Face ID / Touch ID Lock
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Require biometric unlock to open the app
              </Text>
            </View>
            <Switch
              value={biometricLockEnabled}
              onValueChange={handleBiometricToggle}
              disabled={loadingSettings}
              trackColor={{ false: "#777", true: colors.accent }}
              thumbColor={biometricLockEnabled ? "#fff" : "#ccc"}
            />
          </View>

          {/* REFLECTIVE SUMMARY */}
          {/* <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="book-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                Reflective Summaries
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                Generate gentle overviews of your recent prayers
              </Text>
            </View>
            <Switch
              value={hasReflectiveSummary}
              onValueChange={handleReflectiveToggle}
              disabled={loadingSettings}
              trackColor={{ false: "#777", true: colors.accent }}
              thumbColor={hasReflectiveSummary ? "#fff" : "#ccc"}
            />
          </View>

          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: spacing.sm,
            }}
          >
            When enabled, Sinai creates short reflective summaries of your own
            prayers to help you notice themes. This is private and optional.
          </Text> */}

          {/* SUBSCRIPTION */}
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            SUBSCRIPTION
          </Text>

          <View
            style={[
              styles.subscriptionBox,
              { backgroundColor: colors.card },
            ]}
          >
            <View style={styles.subscriptionDetails}>
              <View style={styles.subscriptionRow}>
                <Text style={[styles.subscriptionKey, { color: colors.textSecondary }]}>
                  Account:
                </Text>
                <Text
                  style={[styles.subscriptionValue, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {userEmail ?? "—"}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={[styles.subscriptionKey, { color: colors.textSecondary }]}>
                  Plan:
                </Text>
                <Text style={[styles.subscriptionValue, { color: colors.textSecondary }]}>
                  {loadingSubscription ? "—" : planLabel}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={[styles.subscriptionKey, { color: colors.textSecondary }]}>
                  Status:
                </Text>
                <Text style={[styles.subscriptionValue, { color: colors.textSecondary }]}>
                  {loadingSubscription ? "Subscription unavailable" : statusLabel}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={[styles.subscriptionKey, { color: colors.textSecondary }]}>
                  Billing via:
                </Text>
                <Text style={[styles.subscriptionValue, { color: colors.textSecondary }]}>
                  {loadingSubscription ? "—" : providerLabel}
                </Text>
              </View>

              <View style={[styles.subscriptionRow, { marginBottom: 0 }]}>
                <Text style={[styles.subscriptionKey, { color: colors.textSecondary }]}>
                  Renews:
                </Text>
                <Text style={[styles.subscriptionValue, { color: colors.textSecondary }]}>
                  {loadingSubscription ? "—" : renewalLabel}
                </Text>
              </View>
            </View>

            {canManageSubscription ? (
              <TouchableOpacity
                style={[
                  styles.manageBtn,
                  styles.manageBtnSpacing,
                  { backgroundColor: colors.accent + "22" },
                ]}
                onPress={() =>
                  Linking.openURL("https://apps.apple.com/account/subscriptions")
                }
              >
                <Text
                  style={[styles.manageText, { color: colors.accent }]}
                >
                  Manage Subscription
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* SUPPORT & LEGAL */}
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            SUPPORT & LEGAL
          </Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL("mailto:info@prayerjournal.app")}
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={colors.textPrimary}
            />
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>
              Help & Support
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL("https://prayerjournal.app/privacy")}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.textPrimary}
            />
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL("https://prayerjournal.app/terms")}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.textPrimary}
            />
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          {/* ACCOUNT */}
          <TouchableOpacity
            style={[styles.signOut, { marginTop: spacing.xl }]}
            onPress={handleSignOut}
          >
            <Text
              style={[styles.signOutText, { color: colors.textPrimary }]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, { marginTop: spacing.lg, paddingVertical: spacing.sm }]}
            disabled={deletingAccount}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.deleteText, deletingAccount ? styles.deleteTextDisabled : null]}>
              {deletingAccount ? "Deleting account..." : "Delete Account"}
            </Text>
          </TouchableOpacity>

          {/* VERSION */}
          <Text
            style={[styles.version, { color: colors.textSecondary }]}
          >
            Prayer Journal {version}
          </Text>
        </ScrollView>

        {/* Toast */}
        {toastMessage && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              {
                opacity: toastOpacity,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Text
              style={[styles.toastText, { color: colors.textPrimary }]}
            >
              {toastMessage}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CFCFCF",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18 },
  headerSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  scroll: { marginTop: spacing.md },
  category: {
    fontFamily: fonts.heading,
    fontSize: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.sm / 2,
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 16,
  },
  settingText: { flex: 1, marginLeft: spacing.sm, marginRight: spacing.sm },
  settingLabel: { fontFamily: fonts.heading, fontSize: 15 },
  settingSub: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  themeOptionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  themeOptionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  themeOptionText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  timePickerContainer: {
    borderRadius: 16,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  subscriptionBox: {
    borderRadius: 16,
    padding: spacing.md,
  },
  subscriptionDetails: { width: "100%" },
  manageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignSelf: "flex-end",
  },
  manageBtnSpacing: { marginTop: spacing.sm },
  manageText: { fontFamily: fonts.body, fontSize: 13 },
  subscriptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  subscriptionKey: { fontFamily: fonts.heading, fontSize: 13, marginRight: spacing.sm },
  subscriptionValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "right",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  linkText: { marginLeft: spacing.sm, fontFamily: fonts.body, fontSize: 14 },
  signOut: { marginTop: spacing.lg, alignItems: "center" },
  signOutText: { fontFamily: fonts.body, fontSize: 15 },
  deleteBtn: { marginTop: spacing.sm, alignItems: "center" },
  deleteText: { color: "#E45858", fontFamily: fonts.body, fontSize: 15 },
  deleteTextDisabled: { opacity: 0.65 },
  version: {
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: { fontFamily: fonts.body, fontSize: 13 },
});
