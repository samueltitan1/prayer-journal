import { getSupabase } from "@/lib/supabaseClient";

export type OnboardingResponsesPayload = {
  onboarding_started_at?: string;
  onboarding_completed_at?: string;
  onboarding_step?: string | null;
  onboarding_last_seen_at?: string;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
  q5?: string;
  q6?: string;
  q7?: string[];
  q8?: string[];
};

export type OnboardingResponsesSnapshot = {
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
  onboarding_step?: string | null;
  onboarding_last_seen_at?: string | null;
};

const ARRAY_KEYS = new Set(["q7", "q8"]);

const sanitizePayload = (payload: OnboardingResponsesPayload) => {
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

export async function upsertOnboardingResponses(
  userId: string | null | undefined,
  payload: OnboardingResponsesPayload
) {
  if (!userId) {
    console.warn("Missing userId for onboarding_responses upsert");
    return;
  }

  const supabase = getSupabase();
  let existing: OnboardingResponsesSnapshot | null = null;

  try {
    const { data, error } = await supabase
      .from("onboarding_responses")
      .select("onboarding_started_at,onboarding_completed_at,onboarding_step,onboarding_last_seen_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load onboarding_responses for upsert", error);
    } else {
      existing = data ?? null;
    }
  } catch (e) {
    console.warn("Failed to read onboarding_responses before upsert", e);
  }

  const cleaned = sanitizePayload(payload);

  if (
    existing?.onboarding_started_at &&
    Object.prototype.hasOwnProperty.call(cleaned, "onboarding_started_at")
  ) {
    delete cleaned.onboarding_started_at;
  }

  if (Object.keys(cleaned).length === 0) return;

  try {
    const { error } = await supabase
      .from("onboarding_responses")
      .upsert({ user_id: userId, ...cleaned }, { onConflict: "user_id" });
    if (error) {
      console.warn("Failed to upsert onboarding_responses", error);
    }
  } catch (e) {
    console.warn("Failed to upsert onboarding_responses (exception)", e);
  }
}

export async function getOnboardingResponsesSnapshot(
  userId: string | null | undefined
) {
  if (!userId) {
    console.warn("Missing userId for onboarding_responses fetch");
    return null;
  }

  try {
    const { data, error } = await getSupabase()
      .from("onboarding_responses")
      .select("onboarding_completed_at,onboarding_started_at,onboarding_step,onboarding_last_seen_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load onboarding_responses snapshot", error);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.warn("Failed to load onboarding_responses snapshot (exception)", e);
    return null;
  }
}
