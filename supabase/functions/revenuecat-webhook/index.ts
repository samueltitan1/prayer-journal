// supabase/functions/revenuecat-webhook/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const toIso = (value: string | number | null | undefined) => {
  if (!value) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString();
};

const mapProvider = (store: string | null | undefined) => {
  const normalized = (store ?? "").toLowerCase();
  if (normalized.includes("app_store")) return "apple";
  if (normalized.includes("play_store")) return "google";
  if (normalized.includes("stripe")) return "stripe";
  return null;
};

const inferPlan = (productId: string | null | undefined) => {
  const normalized = (productId ?? "").toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("year") || normalized.includes("annual")) return "yearly";
  if (normalized.includes("month")) return "monthly";
  if (normalized.includes("life")) return "lifetime";
  return "unknown";
};

const inferStatus = (eventType: string, expiresAt: string | null, periodType: string | null) => {
  const type = (eventType ?? "").toUpperCase();
  if (type.includes("EXPIRATION")) return "expired";
  if (type.includes("BILLING_ISSUE")) return "past_due";
  if (type.includes("CANCELLATION")) return "canceled";
  if (type.includes("TRANSFER")) return "active";

  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!expiresAt || expiresMs <= Date.now()) return "expired";
  return (periodType ?? "").toLowerCase() === "trial" ? "trialing" : "active";
};

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    const event = payload?.event ?? payload ?? {};
    const eventId = event?.id ?? event?.event_id ?? null;
    const appUserId = event?.app_user_id ?? event?.original_app_user_id ?? null;

    if (!eventId || !appUserId) {
      return json({ error: "Missing event id or app user id" }, 400);
    }

    const { data: existing, error: existingError } = await service
      .from("revenuecat_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      return json({ error: existingError.message }, 500);
    }

    if (existing) {
      return json({ received: true, duplicate: true });
    }

    const entitlementIds = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
    const entitlementId = entitlementIds[0] ?? null;
    const productId = event?.product_id ?? null;
    const provider = mapProvider(event?.store ?? null);
    const expiresAt = toIso(event?.expiration_at_ms ?? event?.expiration_at ?? null);
    const periodType = event?.period_type ?? null;
    const status = inferStatus(event?.type ?? "", expiresAt, periodType);
    const plan = inferPlan(productId);

    const { error: insertEventError } = await service.from("revenuecat_webhook_events").insert({
      event_id: eventId,
      app_user_id: appUserId,
      payload: payload,
    });

    if (insertEventError) {
      return json({ error: insertEventError.message }, 500);
    }

    const { error: upsertError } = await service.from("subscriptions").upsert(
      {
        user_id: appUserId,
        provider,
        plan,
        status,
        current_period_end: expiresAt,
        environment: event?.environment ?? null,
        revenuecat_app_user_id: appUserId,
        revenuecat_product_id: productId,
        revenuecat_entitlement_id: entitlementId,
        revenuecat_event_id: eventId,
        provider_meta: {
          source: "revenuecat_webhook",
          event_type: event?.type ?? null,
          period_type: periodType,
          store: event?.store ?? null,
          transferred_from: event?.transferred_from ?? null,
          transferred_to: event?.transferred_to ?? null,
        },
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return json({ error: upsertError.message }, 500);
    }

    return json({ received: true, status });
  } catch (error) {
    console.error("revenuecat-webhook error", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
