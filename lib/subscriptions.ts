import { getSupabase } from "@/lib/supabaseClient";

export type SubscriptionSnapshot = {
  status?: string | null;
  current_period_end?: string | null;
  access_override?: boolean | null;
  access_override_expires_at?: string | null;
};

export async function getEntitlement(userId: string | null | undefined) {
  if (!userId) return { active: false, currentPeriodEnd: null, source: "none" as const };

  try {
    const { data, error } = await getSupabase()
      .from("subscriptions")
      .select("status, current_period_end, access_override, access_override_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load subscription snapshot", error);
      return { active: false, currentPeriodEnd: null, source: "none" as const };
    }

    const end = data?.current_period_end ?? null;
    const endMs = end ? new Date(end).getTime() : 0;
    const overrideEnabled = data?.access_override === true;
    const overrideExpiresAt = data?.access_override_expires_at ?? null;
    const overrideExpiresMs = overrideExpiresAt
      ? new Date(overrideExpiresAt).getTime()
      : 0;
    const overrideActive =
      overrideEnabled &&
      (!overrideExpiresAt ||
        (Number.isFinite(overrideExpiresMs) && overrideExpiresMs > Date.now()));
    const activeByStatus =
      data?.status === "active" || data?.status === "trialing";
    const activeByEnd = !!end && endMs > Date.now();
    const active = overrideActive || activeByStatus || activeByEnd;
    const source = overrideActive
      ? "override"
      : activeByStatus
      ? "status"
      : activeByEnd
      ? "period_end"
      : "none";
    return { active, currentPeriodEnd: end, source };
  } catch (e) {
    console.warn("Failed to load subscription snapshot (exception)", e);
    return { active: false, currentPeriodEnd: null, source: "none" as const };
  }
}
