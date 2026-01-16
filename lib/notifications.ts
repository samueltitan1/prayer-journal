// lib/notifications.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const DAILY_KIND = "daily_prayer_reminder";
const NIGHTLY_KIND = "nightly_reflection_prompt";

async function cancelScheduledByKind(kind: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matches = scheduled.filter((n: any) => n?.content?.data?.kind === kind);
  await Promise.all(
    matches.map((n: any) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

async function isScheduledKind(kind: string): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n: any) => n?.content?.data?.kind === kind);
}

// Global handler – how notifications behave when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: Platform.OS === "ios",
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") {
    console.log("Notifications permissions not supported on web; skipping request.");
    return false;
  }
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
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web; skipping scheduleDailyPrayerNotification.");
    return null;
  }
  const [hStr, mStr] = time.split(":");
  const hour = parseInt(hStr || "8", 10);
  const minute = parseInt(mStr || "0", 10);

  // Only cancel daily reminders, not all notifications
  await cancelScheduledByKind(DAILY_KIND);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to pray 🙏",
      body: "Take a moment to pause and pray.",
      sound: Platform.OS === "ios" ? "default" : undefined,
      data: { kind: DAILY_KIND },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyPrayerNotification() {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web; skipping cancelDailyPrayerNotification.");
    return;
  }
  await cancelScheduledByKind(DAILY_KIND);
}

export async function getDailyPrayerReminderStatus(): Promise<{
  enabled: boolean;
  time: string | null;
}> {
  if (Platform.OS === "web") {
    return { enabled: false, time: null };
  }

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const match = scheduled.find((n: any) => {
      const kind = n?.content?.data?.kind;
      if (kind === DAILY_KIND) return true;

      // Back-compat: older scheduled notifications may not have `data`
      const title = (n?.content?.title ?? "").toString();
      return title.includes("Time to pray");
    });

    if (!match) return { enabled: false, time: null };

    const trig: any = match.trigger;
    const hour = typeof trig?.hour === "number" ? trig.hour : null;
    const minute = typeof trig?.minute === "number" ? trig.minute : null;

    if (hour === null || minute === null) {
      return { enabled: true, time: null };
    }

    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    return { enabled: true, time: `${hh}:${mm}` };
  } catch {
    return { enabled: false, time: null };
  }
}

// --- NIGHTLY REFLECTION PROMPT ---
export async function scheduleNightlyReflectionPrompt() {
  if (Platform.OS === "web") return null;

  // Only schedule once (idempotent)
  if (await isScheduledKind(NIGHTLY_KIND)) return null;

  // Ensure we don't duplicate an older version
  await cancelScheduledByKind(NIGHTLY_KIND);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Evening Examen",
      body: "Where did you see God today? Where did you resist God? What are you grateful for?",
      sound: Platform.OS === "ios" ? "default" : undefined,
      data: { kind: NIGHTLY_KIND },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 21,
      minute: 0,
      repeats: true,
    },
  });
}

export async function cancelNightlyReflectionPrompt() {
  if (Platform.OS === "web") return;
  await cancelScheduledByKind(NIGHTLY_KIND);
}

export async function getNightlyReflectionPromptStatus(): Promise<{ enabled: boolean }> {
  if (Platform.OS === "web") return { enabled: false };
  try {
    const enabled = await isScheduledKind(NIGHTLY_KIND);
    return { enabled };
  } catch {
    return { enabled: false };
  }
}