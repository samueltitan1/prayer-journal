// supabase/functions/validate-apple-subscription/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

type ValidateRequest = {
  transactionId?: string;
  productId?: string;
};

const APPLE_API = "https://api.storekit.itunes.apple.com/inApps/v1/transactions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ensurePem = (raw: string) => {
  if (raw.includes("BEGIN PRIVATE KEY")) return raw;
  const cleaned = raw.replace(/\\n/g, "\n");
  return `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`;
};

const base64UrlToJson = (value: string) => {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const decoded = atob(base64);
  return JSON.parse(decoded);
};

const decodeSignedTransaction = (signed: string) => {
  const parts = signed.split(".");
  if (parts.length < 2) return null;
  return base64UrlToJson(parts[1]);
};

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as ValidateRequest;
    const transactionId = body.transactionId?.trim();
    const productId = body.productId?.trim();

    if (!transactionId || !productId) {
      return json({ error: "Missing transactionId or productId" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const issuerId = Deno.env.get("APPLE_ISSUER_ID");
    const keyId = Deno.env.get("APPLE_KEY_ID");
    const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
    const bundleId = Deno.env.get("APPLE_BUNDLE_ID");

    if (!issuerId || !keyId || !privateKey) {
      return json({ error: "Missing Apple credentials" }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: Record<string, string> = {
      iss: issuerId,
      aud: "appstoreconnect-v1",
    };
    if (bundleId) jwtPayload.bid = bundleId;

    const jwt = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 20 * 60)
      .sign(await importPKCS8(ensurePem(privateKey), "ES256"));

    const appleRes = await fetch(`${APPLE_API}/${transactionId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!appleRes.ok) {
      return json({ error: "Apple validation failed" }, 400);
    }

    const appleJson = await appleRes.json();
    const signedInfo = appleJson?.signedTransactionInfo;
    if (!signedInfo) {
      return json({ error: "Missing signedTransactionInfo" }, 400);
    }

    const tx = decodeSignedTransaction(signedInfo);
    if (!tx) return json({ error: "Invalid signedTransactionInfo" }, 400);

    const resolvedProductId = tx?.productId ?? tx?.product_id;
    if (resolvedProductId && resolvedProductId !== productId) {
      return json({ error: "Product mismatch" }, 400);
    }

    const originalTransactionId =
      tx?.originalTransactionId ?? tx?.originalTransactionIdentifierIOS ?? null;
    const expiresMs = tx?.expiresDate ?? tx?.expirationDate ?? null;
    const expiresAt =
      typeof expiresMs === "string" || typeof expiresMs === "number"
        ? new Date(Number(expiresMs)).toISOString()
        : null;

    const active = !!(expiresAt && new Date(expiresAt).getTime() > Date.now());
    const status = active ? "active" : "expired";
    const plan =
      productId === "prayer_journal_monthly"
        ? "monthly"
        : productId === "prayer_journal_yearly"
        ? "yearly"
        : "unknown";

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertError } = await service.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider: "apple",
        plan,
        status,
        current_period_end: expiresAt,
        apple_product_id: productId,
        apple_transaction_id: transactionId,
        apple_original_transaction_id: originalTransactionId,
        last_validated_at: new Date().toISOString(),
        environment: tx?.environment ?? null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return json({ error: "Failed to update subscription" }, 500);
    }

    return json({ active, currentPeriodEnd: expiresAt, status });
  } catch (e) {
    console.error("validate-apple-subscription error", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
