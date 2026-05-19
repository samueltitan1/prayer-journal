import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getNotificationPermissionStatus } from "@/lib/notifications";
import { getSupabase } from "@/lib/supabaseClient";

function getProjectId(): string | null {
  const constantsWithLegacy = Constants as typeof Constants & {
    easConfig?: { projectId?: string };
    expoConfig?: { extra?: Record<string, unknown> };
  };

  const fromEas = constantsWithLegacy.easConfig?.projectId;
  if (typeof fromEas === "string" && fromEas.trim()) {
    return fromEas.trim();
  }

  const fromExtra = constantsWithLegacy.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }

  return null;
}

function getUserTimezone() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof timeZone === "string" && timeZone.trim()) {
      return timeZone;
    }
  } catch {
    // Ignore and fallback to UTC.
  }
  return "UTC";
}

export async function syncUserNotificationContext(userId: string) {
  if (!userId || Platform.OS === "web") return;

  const supabase = getSupabase();
  const timezone = getUserTimezone();
  const now = new Date().toISOString();

  await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      timezone,
      last_active_at: now,
    },
    { onConflict: "user_id" }
  );

  const status = await getNotificationPermissionStatus();
  if (status !== "granted") {
    return;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn("Missing Expo EAS project ID; skipping push token sync.");
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = token.data?.trim();
  if (!expoPushToken) return;

  await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      timezone,
      last_seen_at: now,
      disabled_at: null,
    },
    { onConflict: "expo_push_token" }
  );
}
