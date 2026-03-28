import { getSupabase } from "@/lib/supabaseClient";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function refreshSubscriptionIfNeeded(userId: string) {
  try {
    const { data, error } = await getSupabase()
      .from("subscriptions")
      .select(
        "provider, apple_transaction_id, apple_product_id, revenuecat_app_user_id, last_validated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("subscription refresh failed", error);
      return;
    }

    if (!data) {
      if (__DEV__) console.log("subscription refresh skipped");
      return;
    }

    const transactionId = data.apple_transaction_id;
    const productId = data.apple_product_id;
    const revenueCatAppUserId = data.revenuecat_app_user_id ?? userId;

    const lastValidatedAt = data.last_validated_at
      ? new Date(data.last_validated_at).getTime()
      : 0;
    const isRecent =
      Number.isFinite(lastValidatedAt) &&
      lastValidatedAt > 0 &&
      Date.now() - lastValidatedAt < SIX_HOURS_MS;
    if (isRecent) {
      if (__DEV__) console.log("subscription refresh skipped");
      return;
    }

    if (__DEV__) console.log("subscription refresh triggered");
    let invokeError: { message?: string } | null = null;
    if (revenueCatAppUserId) {
      const result = await getSupabase().functions.invoke("sync-revenuecat-subscription", {
        body: { appUserId: revenueCatAppUserId },
      });
      invokeError = result.error;
    } else if (data.provider === "apple" && transactionId && productId) {
      const result = await getSupabase().functions.invoke("validate-apple-subscription", {
        body: { transactionId, productId },
      });
      invokeError = result.error;
    }
    if (invokeError) {
      console.warn("subscription refresh failed", invokeError);
    }
  } catch (error) {
    console.warn("subscription refresh failed", error);
  }
}
