// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { computePaywallSendAfter } from "../_shared/paywallSendAfter.ts";
import { normalizePaywallFirstName } from "../_shared/normalizePaywallFirstName.ts";

type PostHogWebhookPayload = {
  event?: {
    event?: string;
    distinct_id?: string;
    properties?: {
      email?: string;
      first_name?: string;
    };
  };
  person?: {
    properties?: {
      email?: string;
      name?: string;
    };
  };
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload: PostHogWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const eventName = payload.event?.event;
  if (eventName && eventName !== "paywall_exited_without_trial") {
    return new Response("ignored", { status: 200 });
  }

  const email =
    payload.person?.properties?.email?.trim() ??
    payload.event?.properties?.email?.trim();
  const rawName =
    payload.person?.properties?.name ??
    payload.event?.properties?.first_name ??
    null;

  // @privaterelay.appleid.com addresses are valid — store as-is; Apple relay
  // handles delivery when the sending domain is registered. Never discard.
  if (email?.endsWith("@privaterelay.appleid.com")) {
    // Proceed to upsert below with the relay address unchanged.
  }

  if (!email) {
    return json(400, { error: "Missing email" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: lookupData, error: lookupError } =
    await supabase.auth.admin.listUsers({ filter: `email.eq.${email}` });

  if (lookupError) {
    console.error("paywall-exit: user lookup failed", lookupError);
    return json(500, { error: lookupError.message });
  }

  const supabaseUserId = lookupData?.users?.[0]?.id;
  if (!supabaseUserId) {
    console.log("paywall-exit: no Supabase user found for email", email);
    return json(200, { ok: true, skipped: true });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", supabaseUserId)
    .maybeSingle();

  const sendAfter = computePaywallSendAfter(new Date(), settings?.timezone ?? null);
  const firstName = normalizePaywallFirstName(rawName);

  const { error } = await supabase.from("paywall_email_queue").upsert(
    {
      user_id: supabaseUserId,
      email,
      first_name: firstName,
      send_after: sendAfter.toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("paywall-exit: upsert failed", error);
    return json(500, { error: error.message });
  }

  return json(200, { ok: true });
});
