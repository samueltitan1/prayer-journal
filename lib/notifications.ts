// lib/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase } from "./supabaseClient";
import { capture } from "./posthog";

const DAILY_KIND = "daily_prayer_reminder";
const DAILY_NOTIFICATION_ID_KEY = "daily_prayer_notification_id_v1";
const NIGHTLY_KIND = "nightly_reflection_prompt";
const REFLECTION_KIND = "reflection_ready";
const INACTIVE_KIND = "inactive_nudge";
const REFLECTION_NOTIFY_TIME_LOCAL = "09:00";
const INACTIVE_NUDGE_STORAGE_PREFIX = "inactive_nudge_last_date_v1";

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

function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLocalMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseTimeString(time: string) {
  const [hStr, mStr] = time.split(":");
  const hour = parseInt(hStr || "9", 10);
  const minute = parseInt(mStr || "0", 10);
  return { hour, minute };
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
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  // Cancel previously scheduled reminder (by stored ID)
  const existingId = await AsyncStorage.getItem(DAILY_NOTIFICATION_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(DAILY_NOTIFICATION_ID_KEY);
  }

  const { hour, minute } = parseTimeString(time);

  const id = await Notifications.scheduleNotificationAsync({
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

  await AsyncStorage.setItem(DAILY_NOTIFICATION_ID_KEY, id);
  return id;
}

export async function cancelDailyPrayerNotification() {
  if (Platform.OS === "web") return;

  const existingId = await AsyncStorage.getItem(DAILY_NOTIFICATION_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(DAILY_NOTIFICATION_ID_KEY);
  }
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

export async function scheduleReflectionReadyNotificationsForUser(userId: string) {
  if (Platform.OS === "web") return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const { data, error } = await getSupabase()
    .from("reflections")
    .select("id, created_at, notified_at, type")
    .eq("user_id", userId)
    .is("notified_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const todayKey = toLocalDateKey(new Date());
  const { hour, minute } = parseTimeString(REFLECTION_NOTIFY_TIME_LOCAL);

  const counts: Record<"weekly" | "monthly", number> = {
    weekly: 0,
    monthly: 0,
  };

  for (const reflection of data as any[]) {
    const createdAt = reflection?.created_at ? new Date(reflection.created_at) : null;
    if (!createdAt) continue;

    if (toLocalDateKey(createdAt) !== todayKey) {
      continue;
    }

    const alreadyScheduled = scheduled.some(
      (n: any) =>
        n?.content?.data?.kind === REFLECTION_KIND &&
        n?.content?.data?.reflection_id === reflection.id
    );

    if (alreadyScheduled) {
      await getSupabase()
        .from("reflections")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", reflection.id);
      continue;
    }

    const now = new Date();
    const triggerAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    const scheduledDate = now > triggerAt ? new Date(now.getTime() + 60 * 1000) : triggerAt;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your reflection is ready",
        body: "Open Prayer Journal to read it.",
        sound: Platform.OS === "ios" ? "default" : undefined,
        data: { kind: REFLECTION_KIND, reflection_id: reflection.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: scheduledDate },
    });

    await getSupabase()
      .from("reflections")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", reflection.id);

    if (reflection?.type === "weekly" || reflection?.type === "monthly") {
      const type = reflection.type as "weekly" | "monthly";
      counts[type] += 1;
    }
  }

  if (counts.weekly > 0) {
    capture("reflection_notification_scheduled", {
      type: "weekly",
      scheduled_for: "today",
      count: counts.weekly,
    });
  }
  if (counts.monthly > 0) {
    capture("reflection_notification_scheduled", {
      type: "monthly",
      scheduled_for: "today",
      count: counts.monthly,
    });
  }
}

export async function scheduleInactiveNudgeIfNeeded(userId: string) {
  if (Platform.OS === "web") return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const { data, error } = await getSupabase()
    .from("user_stats")
    .select("last_prayer_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.last_prayer_date) return;

  const lastPrayerDate = new Date(data.last_prayer_date);
  const today = new Date();
  const todayKey = toLocalDateKey(today);

  if (toLocalDateKey(lastPrayerDate) === todayKey) return;

  const diffMs = getLocalMidnight(today).getTime() - getLocalMidnight(lastPrayerDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 2) return;

  const storageKey = `${INACTIVE_NUDGE_STORAGE_PREFIX}:${userId}`;
  const lastNudgeKey = await AsyncStorage.getItem(storageKey);
  if (lastNudgeKey === todayKey) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Come back to prayer",
      body: "Take a moment to pray — even a short prayer counts.",
      sound: Platform.OS === "ios" ? "default" : undefined,
      data: { kind: INACTIVE_KIND, date: todayKey },
    },
    trigger: null,
  });

  await AsyncStorage.setItem(storageKey, todayKey);
  capture("inactive_nudge_sent", { days_inactive: diffDays });
}
