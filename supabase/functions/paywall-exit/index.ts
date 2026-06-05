// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { computePaywallSendAfter } from "../_shared/paywallSendAfter.ts";
import { normalizePaywallFirstName } from "../_shared/normalizePaywallFirstName.ts";

type PostHogWebhookPayload = {
  event?: {
    distinct_id?: string;
    properties?: {
      email?: string;
      first_name?: string;
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

  const userId = payload.event?.distinct_id?.trim();
  const email = payload.event?.properties?.email?.trim();
  const rawName = payload.event?.properties?.first_name ?? null;

  if (!userId || !email) {
    return json(400, { error: "Missing distinct_id or email" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();

  const sendAfter = computePaywallSendAfter(new Date(), settings?.timezone ?? null);
  const firstName = normalizePaywallFirstName(rawName);

  const { error } = await supabase.from("paywall_email_queue").upsert(
    {
      user_id: userId,
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
