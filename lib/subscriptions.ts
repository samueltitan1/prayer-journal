import { getSupabase } from "@/lib/supabaseClient";

export type SubscriptionSnapshot = {
  status?: string | null;
  current_period_end?: string | null;
};

export async function getEntitlement(userId: string | null | undefined) {
  if (!userId) return { active: false, currentPeriodEnd: null };

  try {
    const { data, error } = await getSupabase()
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load subscription snapshot", error);
      return { active: false, currentPeriodEnd: null };
    }

    const end = data?.current_period_end ?? null;
    const endMs = end ? new Date(end).getTime() : 0;
    const activeByStatus =
      data?.status === "active" || data?.status === "trialing";
    const activeByEnd = !!end && endMs > Date.now();
    const active = activeByStatus || activeByEnd;
    return { active, currentPeriodEnd: end };
  } catch (e) {
    console.warn("Failed to load subscription snapshot (exception)", e);
    return { active: false, currentPeriodEnd: null };
  }
}
