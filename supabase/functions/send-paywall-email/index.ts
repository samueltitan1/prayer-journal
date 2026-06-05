// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { renderAsync } from "https://esm.sh/@react-email/render@1.0.3";
import React from "https://esm.sh/react@18.3.1";
import {
  PAYWALL_EMAIL_SUBJECT,
  PaywallEmail,
} from "../_templates/paywall-email.tsx";

type QueueRow = {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
};

const FROM_ADDRESS = "Samuel from Prayer Journal <samuel@prayerjournal.app>";
const BATCH_LIMIT = 50;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildUnsubscribeUrl(userId: string): string {
  return `https://prayerjournal.app/email/unsubscribe?user_id=${encodeURIComponent(userId)}`;
}

async function sendWithResend(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing required env" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  const { data: rows, error: queryError } = await supabase
    .from("paywall_email_queue")
    .select("id, user_id, email, first_name")
    .lte("send_after", nowIso)
    .is("sent_at", null)
    .eq("suppressed", false)
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error("send-paywall-email: query failed", queryError);
    return json(500, { error: queryError.message });
  }

  const dueRows = (rows ?? []) as QueueRow[];
  if (dueRows.length === 0) {
    return json(200, { ok: true, sent: 0, skipped: 0 });
  }

  const userIds = dueRows.map((r) => r.user_id);
  const { data: trialing } = await supabase
    .from("subscriptions")
    .select("user_id")
    .in("user_id", userIds)
    .not("trial_started_at", "is", null);

  const trialUserIds = new Set((trialing ?? []).map((r) => r.user_id));

  let sent = 0;
  let skipped = 0;
  const errors: { id: string; message: string }[] = [];

  for (const row of dueRows) {
    if (trialUserIds.has(row.user_id)) {
      skipped += 1;
      await supabase
        .from("paywall_email_queue")
        .update({ suppressed: true })
        .eq("id", row.id)
        .is("sent_at", null);
      continue;
    }

    try {
      const html = await renderAsync(
        React.createElement(PaywallEmail, {
          firstName: row.first_name,
          unsubscribeUrl: buildUnsubscribeUrl(row.user_id),
        })
      );

      await sendWithResend(resendApiKey, row.email, PAYWALL_EMAIL_SUBJECT, html);

      const { error: updateError } = await supabase
        .from("paywall_email_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("sent_at", null);

      if (updateError) {
        throw new Error(updateError.message);
      }

      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("send-paywall-email: row failed", row.id, message);
      errors.push({ id: row.id, message });
    }
  }

  return json(200, {
    ok: true,
    sent,
    skipped,
    errors: errors.length ? errors : undefined,
  });
});
