import { getSupabase } from "@/lib/supabaseClient";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const MIN_TRIGGER_LEAD_MS = 60 * 1000;

type TrialReminderRow = {
  status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  auto_renew_enabled: boolean | null;
  cancellation_detected_at: string | null;
  trial_reminder_dedupe_key: string | null;
  trial_reminder_scheduled_at: string | null;
  trial_reminder_inapp_shown_at: string | null;
};

export type TrialReminderPlan = {
  dedupeKey: string;
  triggerAt: Date;
  title: string;
  body: string;
  fallbackMessage: string;
};

export async function getTrialReminderRow(userId: string): Promise<TrialReminderRow | null> {
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select(
      "status,current_period_end,trial_ends_at,auto_renew_enabled,cancellation_detected_at,trial_reminder_dedupe_key,trial_reminder_scheduled_at,trial_reminder_inapp_shown_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load trial reminder row", error);
    return null;
  }
  return (data as TrialReminderRow | null) ?? null;
}

export function buildTrialReminderPlan(
  row: TrialReminderRow | null,
  nowMs = Date.now()
): TrialReminderPlan | null {
  if (!row) return null;
  if ((row.status ?? "").toLowerCase() !== "trialing") return null;

  const trialEndRaw = row.trial_ends_at ?? row.current_period_end ?? null;
  if (!trialEndRaw) return null;

  const trialEndMs = new Date(trialEndRaw).getTime();
  if (!Number.isFinite(trialEndMs) || trialEndMs <= nowMs) return null;

  const dedupeKey = `trial_end:${new Date(trialEndMs).toISOString()}`;
  if (row.trial_reminder_dedupe_key === dedupeKey) {
    return null;
  }

  const triggerAtMs = Math.max(nowMs + MIN_TRIGGER_LEAD_MS, trialEndMs - FORTY_EIGHT_HOURS_MS);
  const autoRenewOff = row.auto_renew_enabled === false || Boolean(row.cancellation_detected_at);

  const title = autoRenewOff ? "Your trial ends soon" : "Don’t lose your prayer rhythm";
  const body = autoRenewOff
    ? "Auto-renew is off. Keep your streak and reflections by choosing a plan before trial ends."
    : "Your free trial ends soon. Keep your streak and reflections uninterrupted.";

  return {
    dedupeKey,
    triggerAt: new Date(triggerAtMs),
    title,
    body,
    fallbackMessage: body,
  };
}

export async function markTrialReminderScheduled(userId: string, dedupeKey: string) {
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      trial_reminder_dedupe_key: dedupeKey,
      trial_reminder_scheduled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.warn("Failed to mark trial reminder scheduled", error);
  }
}

export async function markTrialReminderInAppShown(userId: string, dedupeKey: string) {
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      trial_reminder_dedupe_key: dedupeKey,
      trial_reminder_inapp_shown_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.warn("Failed to mark trial reminder in-app shown", error);
  }
}
