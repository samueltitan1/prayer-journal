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
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82; // ~80% screen

export default function SettingsModal({
  visible,
  onClose,
  userId,
}: SettingsModalProps) {
  const { theme, setTheme, colors } = useTheme();
  const isDark = theme === "dark";

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deleteAudioAfterTranscription, setDeleteAudioAfterTranscription] =
    useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("Core Plan");
  const [version, setVersion] = useState("v1.0.0");

  // ---- Toast state (for inline feedback) ----------------------------
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    setToastMessage(message);
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
    ]).start(() => {
      setToastMessage(null);
    });
  };

  // ---- Animated bottom sheet ---------------------------------------
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const openSheet = () => {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 150,
    }).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.spring(translateY, {
      toValue: SHEET_HEIGHT,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  };

  // Drag to close (grab handle area)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80) {
          closeSheet(onClose);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 150,
          }).start();
        }
      },
    })
  ).current;

  // ---- Load settings from Supabase when sheet opens ----------------
  useEffect(() => {
    if (!visible || !userId) return;

    openSheet();

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        setDailyReminderEnabled(data.daily_reminder_enabled ?? false);
        setReminderTime(data.reminder_time ?? "08:00");
        setDeleteAudioAfterTranscription(
          data.delete_audio_after_transcription ?? false
        );
        setSubscriptionPlan(data.subscription_plan ?? "Core Plan");
        setVersion(data.version ?? "v1.0.0");

        // Sync theme from DB if present
        if (data.dark_mode_preference === "dark" && theme !== "dark") {
          setTheme("dark");
        } else if (data.dark_mode_preference === "light" && theme !== "light") {
          setTheme("light");
        }
      }
    };

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  // ---- Save single setting -----------------------------------------
  const updateSetting = async (key: string, value: any) => {
    if (!userId) return;
    await supabase.from("user_settings").upsert({ user_id: userId, [key]: value });
  };

  // ---- Dark mode toggle --------------------------------------------
  const handleDarkModeToggle = async () => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    await updateSetting("dark_mode_preference", newTheme);
    showToast(newTheme === "dark" ? "Dark mode enabled" : "Light mode enabled");
  };

  // ---- Daily reminder toggle ---------------------------------------
  const handleReminderToggle = async () => {
    const newValue = !dailyReminderEnabled;
    setDailyReminderEnabled(newValue);
    await updateSetting("daily_reminder_enabled", newValue);

    if (newValue) {
      // Turning ON
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in Settings to receive your daily prayer reminder."
        );
        setDailyReminderEnabled(false);
        await updateSetting("daily_reminder_enabled", false);
        return;
      }
      await scheduleDailyPrayerNotification(reminderTime);
      showToast(`Daily reminder set for ${reminderTime}`);
    } else {
      // Turning OFF
      await cancelDailyPrayerNotification();
      showToast("Daily reminder turned off");
    }

    setShowTimePicker(false);
  };

  // ---- Time change – save immediately ------------------------------
  const handleTimeChange = async (_: any, selectedDate?: Date) => {
    if (!selectedDate) return;
    const hours = selectedDate.getHours().toString().padStart(2, "0");
    const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setReminderTime(timeString);
    await updateSetting("reminder_time", timeString);

    if (dailyReminderEnabled) {
      await scheduleDailyPrayerNotification(timeString);
      showToast(`Reminder time updated to ${timeString}`);
    }
  };

  const handleDeleteAudioToggle = async () => {
    const newValue = !deleteAudioAfterTranscription;
    setDeleteAudioAfterTranscription(newValue);
    await updateSetting("delete_audio_after_transcription", newValue);
    showToast(
      newValue
        ? "Audio will be deleted after transcription"
        : "Audio will be kept after transcription"
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    closeSheet(onClose);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc("delete_user_and_settings");
              if (error) throw error;
              Alert.alert("Account deleted", "Your account has been removed.");
              await supabase.auth.signOut();
              closeSheet(onClose);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account.");
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      {/* Backdrop with blur */}
      <Pressable style={styles.backdrop} onPress={() => closeSheet(onClose)}>
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      {/* Bottom Sheet */}
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

        {/* Header */}
        <View
          style={[
            styles.headerRow,
            { borderBottomColor: colors.textSecondary + "22" },
          ]}
        >
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Settings
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Manage your preferences and account settings
            </Text>
          </View>
          <TouchableOpacity onPress={() => closeSheet(onClose)}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          {/* === APPEARANCE === */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            APPEARANCE
          </Text>
          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <Ionicons name="sunny-outline" size={20} color={colors.textPrimary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                {isDark ? "Dark theme active" : "Light theme active"}
              </Text>
            </View>
            <Switch value={isDark} onValueChange={handleDarkModeToggle} />
          </View>

          {/* === NOTIFICATIONS === */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            NOTIFICATIONS
          </Text>
          <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.textPrimary}
            />
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                Daily Reminder
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Get reminded to pray
              </Text>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={handleReminderToggle}
            />
          </View>

          {/* Reminder time row */}
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: colors.card,
                opacity: dailyReminderEnabled ? 1 : 0.4,
              },
            ]}
          >
            <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                Reminder Time
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                {reminderTime}
              </Text>
            </View>
            <TouchableOpacity
              disabled={!dailyReminderEnabled}
              onPress={() => setShowTimePicker((prev) => !prev)}
            >
              <Ionicons
                name={
                  showTimePicker ? "chevron-up-outline" : "chevron-down-outline"
                }
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {dailyReminderEnabled && showTimePicker && (
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

          {/* === PRIVACY === */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            PRIVACY
          </Text>
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
              onValueChange={handleDeleteAudioToggle}
            />
          </View>

          {/* === SUBSCRIPTION === */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            SUBSCRIPTION
          </Text>
          <View
            style={[styles.subscriptionBox, { backgroundColor: colors.card }]}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                {subscriptionPlan}
              </Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                £2.99/month
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.manageBtn,
                { backgroundColor: colors.accent + "22" },
              ]}
            >
              <Text style={[styles.manageText, { color: colors.accent }]}>
                Manage Subscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* === SUPPORT & LEGAL === */}
          <Text style={[styles.category, { color: colors.textSecondary }]}>
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

          {/* === ACCOUNT === */}
          <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
            <Text style={[styles.signOutText, { color: colors.textPrimary }]}>
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>

          {/* === VERSION === */}
          <Text style={[styles.version, { color: colors.textSecondary }]}>
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
            <Text style={[styles.toastText, { color: colors.textPrimary }]}>
              {toastMessage}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
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
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    marginTop: spacing.md,
  },
  category: {
    fontFamily: fonts.heading,
    fontSize: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  settingLabel: {
    fontFamily: fonts.heading,
    fontSize: 15,
  },
  settingSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  timePickerContainer: {
    borderRadius: 16,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  subscriptionBox: {
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageBtn: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  manageText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  linkText: {
    marginLeft: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  signOut: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  signOutText: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  deleteBtn: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  deleteText: {
    color: "#E45858",
    fontFamily: fonts.body,
    fontSize: 15,
  },
  version: {
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});