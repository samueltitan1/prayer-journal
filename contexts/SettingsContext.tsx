// contexts/settingsContext.tsx
import {
  cancelDailyPrayerNotification,
  requestNotificationPermissions,
  scheduleDailyPrayerNotification,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";

type Settings = {
  dailyReminderEnabled: boolean;
  reminderTime: string;
  deleteAudioAfterTranscription: boolean;
  darkModePreference: "light" | "dark";
  subscriptionPlan: string;
  version: string;
};

interface SettingsContextValue extends Settings {
  refreshSettings: () => Promise<void>;
  updateSetting: (key: keyof Settings, value: any) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings>({
    dailyReminderEnabled: false,
    reminderTime: "08:00",
    deleteAudioAfterTranscription: false,
    darkModePreference: "light",
    subscriptionPlan: "Core Plan",
    version: "v1.0.0",
  });

  /** Load settings from Supabase */
  const refreshSettings = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return;

    setSettings({
      dailyReminderEnabled: data.daily_reminder_enabled ?? false,
      reminderTime: data.reminder_time ?? "08:00",
      deleteAudioAfterTranscription: data.delete_audio_after_transcription ?? false,
      darkModePreference: data.dark_mode_preference ?? "light",
      subscriptionPlan: data.subscription_plan ?? "Core Plan",
      version: data.version ?? "v1.0.0",
    });
  };

  /** Update single setting in DB and local state */
  const updateSetting = async (key: keyof Settings, value: any) => {
    if (!userId) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    await supabase.from("user_settings").upsert({ user_id: userId, [key]: value });
  };

  /** Load settings on login */
  useEffect(() => {
    refreshSettings();
  }, [userId]);

  /**
   * === Automatic side effects ===
   * These run automatically whenever reminder settings change.
   */
  useEffect(() => {
    const syncNotifications = async () => {
      if (!settings.dailyReminderEnabled) {
        await cancelDailyPrayerNotification();
        return;
      }

      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in Settings to receive your daily prayer reminder."
        );
        await updateSetting("dailyReminderEnabled", false);
        return;
      }

      await scheduleDailyPrayerNotification(settings.reminderTime);
    };

    // Only trigger when these two values change
    syncNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.dailyReminderEnabled, settings.reminderTime]);

  return (
    <SettingsContext.Provider value={{ ...settings, refreshSettings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside a <SettingsProvider>");
  return ctx;
}