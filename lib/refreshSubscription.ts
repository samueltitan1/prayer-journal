import { getSupabase } from "@/lib/supabaseClient";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function refreshAppleSubscriptionIfNeeded(userId: string) {
  try {
    const { data, error } = await getSupabase()
      .from("subscriptions")
      .select("provider, apple_transaction_id, apple_product_id, last_validated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("subscription refresh failed", error);
      return;
    }

    if (!data || data.provider !== "apple") {
      if (__DEV__) console.log("subscription refresh skipped");
      return;
    }

    const transactionId = data.apple_transaction_id;
    const productId = data.apple_product_id;
    if (!transactionId || !productId) {
      if (__DEV__) console.log("subscription refresh skipped");
      return;
    }

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
    const { error: invokeError } = await getSupabase().functions.invoke(
      "validate-apple-subscription",
      { body: { transactionId, productId } }
    );
    if (invokeError) {
      console.warn("subscription refresh failed", invokeError);
    }
  } catch (error) {
    console.warn("subscription refresh failed", error);
  }
}
