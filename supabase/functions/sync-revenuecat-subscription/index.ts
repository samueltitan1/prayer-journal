// supabase/functions/sync-revenuecat-subscription/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

type SyncRequest = {
  appUserId?: string;
};

const REVENUECAT_API = "https://api.revenuecat.com/v1/subscribers";

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

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as SyncRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "pro";

    if (!revenueCatSecret) {
      return json({ error: "Missing REVENUECAT_SECRET_API_KEY" }, 500);
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authed.auth.getUser();

    if (authError || !user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const appUserId = body.appUserId?.trim() || user.id;
    if (appUserId !== user.id) {
      return json({ error: "appUserId must match authenticated user" }, 403);
    }

    const rcRes = await fetch(`${REVENUECAT_API}/${encodeURIComponent(appUserId)}`, {
      headers: {
        Authorization: `Bearer ${revenueCatSecret}`,
      },
    });

    if (!rcRes.ok) {
      const text = await rcRes.text();
      return json({ error: "RevenueCat lookup failed", details: text }, 400);
    }

    const rcJson = await rcRes.json();
    const subscriber = rcJson?.subscriber ?? {};
    const entitlements = subscriber?.entitlements ?? {};
    const subscriptions = subscriber?.subscriptions ?? {};
    const activeEntitlement = entitlements?.[entitlementId] ?? null;
    const productId =
      activeEntitlement?.product_identifier ??
      Object.keys(subscriptions ?? {})[0] ??
      null;
    const subscription = productId ? subscriptions?.[productId] ?? null : null;
    const expiresAt = toIso(activeEntitlement?.expires_date ?? subscription?.expires_date ?? null);
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    const periodType =
      (subscription?.period_type ?? activeEntitlement?.period_type ?? "").toLowerCase();
    const active = Boolean(expiresAt && expiresMs > Date.now());
    const status = active ? (periodType === "trial" ? "trialing" : "active") : "expired";
    const provider = mapProvider(subscription?.store ?? null);
    const plan = inferPlan(productId);

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertError } = await service.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider,
        plan,
        status,
        current_period_end: expiresAt,
        revenuecat_app_user_id: appUserId,
        revenuecat_customer_id: subscriber?.original_app_user_id ?? subscriber?.app_user_id ?? null,
        revenuecat_product_id: productId,
        revenuecat_entitlement_id: entitlementId,
        environment:
          subscription?.is_sandbox === true
            ? "sandbox"
            : subscription?.is_sandbox === false
            ? "production"
            : null,
        provider_meta: {
          source: "revenuecat_sync",
          entitlement: activeEntitlement,
          subscription,
        },
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return json({ error: "Failed to update subscription", details: upsertError.message }, 500);
    }

    return json({ active, status, currentPeriodEnd: expiresAt, provider, plan });
  } catch (e) {
    console.error("sync-revenuecat-subscription error", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
