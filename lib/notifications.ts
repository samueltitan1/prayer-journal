// lib/notifications.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Global handler – how notifications behave when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: Platform.OS === "ios",
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === "granted";
  }
  return true;
}

/**
 * Schedule a daily notification at a given "HH:mm" time (24h)
 */
export async function scheduleDailyPrayerNotification(time: string) {
  const [hStr, mStr] = time.split(":");
  const hour = parseInt(hStr || "8", 10);
  const minute = parseInt(mStr || "0", 10);

  // Clear existing prayer notifications (simple MVP approach)
  await Notifications.cancelAllScheduledNotificationsAsync();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to pray 🙏",
      body: "Take a moment to pause and pray.",
      sound: Platform.OS === "ios" ? "default" : undefined,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyPrayerNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}