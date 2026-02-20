import { getSupabase } from "@/lib/supabaseClient";

export type OnboardingUserSettingsPayload = {
  reminder_enabled?: boolean;
  reminder_time?: string;
  apple_health_connected?: boolean;
};

export type UserSettingsSnapshot = {
  reminder_enabled?: boolean | null;
  reminder_time?: string | null;
  apple_health_connected?: boolean | null;
};

const ARRAY_KEYS = new Set<string>();

const sanitizePayload = (payload: OnboardingUserSettingsPayload) => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (ARRAY_KEYS.has(key)) {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        console.warn(`Invalid array value for ${key}; expected string[]`);
        continue;
      }
      cleaned[key] = value;
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
};

export async function upsertUserSettingsOnboarding(
  userId: string | null | undefined,
  payload: OnboardingUserSettingsPayload
) {
  if (!userId) {
    console.warn("Missing userId for onboarding user_settings upsert");
    return;
  }

  const supabase = getSupabase();
  let existing: UserSettingsSnapshot | null = null;

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("reminder_enabled, reminder_time, apple_health_connected")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load user_settings for onboarding upsert", error);
    } else {
      existing = data ?? null;
    }
  } catch (e) {
    console.warn("Failed to read user_settings before onboarding upsert", e);
  }

  const cleaned = sanitizePayload(payload);

  if (Object.keys(cleaned).length === 0) return;

  try {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...cleaned }, { onConflict: "user_id" });
    if (error) {
      console.warn("Failed to upsert onboarding user_settings", error);
    }
  } catch (e) {
    console.warn("Failed to upsert onboarding user_settings (exception)", e);
  }
}

export async function getUserSettingsSnapshot(userId: string | null | undefined) {
  if (!userId) {
    console.warn("Missing userId for user_settings fetch");
    return null;
  }

  try {
    const { data, error } = await getSupabase()
      .from("user_settings")
      .select("reminder_enabled, reminder_time, apple_health_connected")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load user_settings snapshot", error);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.warn("Failed to load user_settings snapshot (exception)", e);
    return null;
  }
}
