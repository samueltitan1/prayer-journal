// components/SettingsModal.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
  cancelDailyPrayerNotification,
  requestNotificationPermissions,
  scheduleDailyPrayerNotification,
} from "../lib/notifications";

import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { fonts, spacing } from "../theme/theme";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;

export default function SettingsModal({
  visible,
  onClose,
  userId,
}: SettingsModalProps) {
  const { theme, setTheme, colors } = useTheme();
  const isDark = theme === "dark";

  // ==========================
  // State
  // ==========================
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deleteAudioAfterTranscription, setDeleteAudioAfterTranscription] =
    useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("Core Plan");
  const [version, setVersion] = useState("v1.0.0");
  const [hasReflectiveSummary, setHasReflectiveSummary] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

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
    fadeInBackdrop();
    openSheet();

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setDailyReminderEnabled(data.daily_reminder_enabled ?? false);
        setReminderTime(data.reminder_time ?? "08:00");
        setDeleteAudioAfterTranscription(
          data.delete_audio_after_transcription ?? false
        );
        setSubscriptionPlan(data.subscription_plan ?? "Core Plan");
        setVersion(data.version ?? "1.0.0");
        setHasReflectiveSummary(data.has_reflective_summary ?? false);

        if (data.dark_mode_preference && data.dark_mode_preference !== theme) {
          setTheme(data.dark_mode_preference);
        }
      }

      setLoadingSettings(false);
    };

    loadSettings();
  }, [visible, userId]);

  // ==========================
  // Update Setting helper
  // ==========================
  const updateSetting = async (key: string, value: any) => {
    if (!userId) return;
    await supabase.from("user_settings").upsert({
      user_id: userId,
      [key]: value,
    });
  };

  // ==========================
  // Handlers
  // ==========================
  const handleDarkMode = async () => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    await updateSetting("dark_mode_preference", newTheme);
    showToast(newTheme === "dark" ? "Dark mode enabled" : "Light mode enabled");
  };

  const handleReminderToggle = async () => {
    const next = !dailyReminderEnabled;
    setDailyReminderEnabled(next);
    setShowTimePicker(next); // open picker when turning ON, hide when OFF
    await updateSetting("daily_reminder_enabled", next);

    if (next) {
      const ok = await requestNotificationPermissions();
      if (!ok) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications to receive reminders."
        );
        setDailyReminderEnabled(false);
        setShowTimePicker(false);
        await updateSetting("daily_reminder_enabled", false);
        return;
      }
      await scheduleDailyPrayerNotification(reminderTime);
      showToast(`Reminder set for ${reminderTime}`);
    } else {
      await cancelDailyPrayerNotification();
      showToast("Daily reminder turned off");
    }
  };

  const handleTimeChange = async (_: any, date?: Date) => {
    if (!date) return;

    const hrs = `${date.getHours()}`.padStart(2, "0");
    const mins = `${date.getMinutes()}`.padStart(2, "0");
    const t = `${hrs}:${mins}`;

    setReminderTime(t);
    await updateSetting("reminder_time", t);

    if (dailyReminderEnabled) {
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    closeEverything();
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "This will permanently delete your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("delete_user_and_settings");
          if (error) {
            Alert.alert("Error", error.message);
            return;
          }
          await supabase.auth.signOut();
          closeEverything();
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
                Dark Mode
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                {isDark ? "Dark theme active" : "Light theme active"}
              </Text>
            </View>
            <Switch value={isDark} onValueChange={handleDarkMode} />
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
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            PRIVACY
          </Text>

          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                Delete Audio Files
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                Remove after transcription
              </Text>
            </View>
            <Switch
              value={deleteAudioAfterTranscription}
              onValueChange={handleDeleteToggle}
            />
          </View>

          {/* REFLECTIVE SUMMARY */}
          <View
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
          </Text>

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
            <View>
              <Text
                style={[styles.settingLabel, { color: colors.textPrimary }]}
              >
                {subscriptionPlan}
              </Text>
              <Text
                style={[styles.settingSub, { color: colors.textSecondary }]}
              >
                £2.99/month
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.manageBtn,
                { backgroundColor: colors.accent + "22" },
              ]}
            >
              <Text
                style={[styles.manageText, { color: colors.accent }]}
              >
                Manage Subscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* SUPPORT & LEGAL */}
          <Text
            style={[styles.category, { color: colors.textSecondary }]}
          >
            SUPPORT & LEGAL
          </Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL("mailto:info@sinai.global")}
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
            onPress={() => Linking.openURL("https://sinai.global/privacy")}
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
            onPress={() => Linking.openURL("https://sinai.global/terms")}
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
          <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
            <Text
              style={[styles.signOutText, { color: colors.textPrimary }]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
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
  settingSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  timePickerContainer: {
    borderRadius: 16,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  subscriptionBox: {
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  manageText: { fontFamily: fonts.body, fontSize: 13 },
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