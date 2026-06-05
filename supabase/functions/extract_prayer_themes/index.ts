// @ts-nocheck  // 👈 Removes Deno/TS import noise inside Cursor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import OpenAI from "npm:openai";
import {
  isClassifiedTheme,
  NOTIFICATION_RESTRICTED_THEMES,
  NOTIFICATION_SAFE_THEMES,
} from "../_shared/notificationThemeConfig.ts";

type Body = {
  prayer_id?: string;
  user_id?: string;
  prayer_text?: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizeThemes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter((value): value is string => Boolean(value) && isClassifiedTheme(value));
  return Array.from(new Set(normalized)).slice(0, 3);
}

serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const prayerId = typeof body.prayer_id === "string" ? body.prayer_id : "";
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const prayerText = typeof body.prayer_text === "string" ? body.prayer_text.trim() : "";

    if (!prayerId || !userId || !prayerText) {
      return json(400, { error: "Missing prayer_id, user_id, or prayer_text" });
    }

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await authedClient.auth.getUser();
    if (authError || !user?.id) {
      return json(401, { error: "Unauthorized" });
    }
    if (user.id !== userId) {
      return json(403, { error: "Forbidden: user mismatch" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY")!,
    });

    const safeThemesList = NOTIFICATION_SAFE_THEMES.join(", ");
    const restrictedThemesList = NOTIFICATION_RESTRICTED_THEMES.join(", ");
    const prompt = `Given this prayer, return 1-3 single-word themes. Choose only from these two separate lists:

Safe themes: [${safeThemesList}]
Restricted themes: [${restrictedThemesList}]

Prayer: "${prayerText}"
Return JSON only: {"themes": ["work", "anxiety"]}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "Return valid JSON only with a single key named themes that contains 1-3 items from the safe or restricted theme lists provided.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return json(502, { error: "OpenAI returned empty content" });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(502, { error: "OpenAI did not return valid JSON", content });
    }

    const themes = sanitizeThemes(parsed.themes);
    if (themes.length === 0) {
      return json(200, { updated: false, reason: "no_valid_themes" });
    }

    const { error: updateError } = await supabase
      .from("prayers")
      .update({ themes })
      .eq("id", prayerId)
      .eq("user_id", userId);
    if (updateError) {
      return json(500, { error: "Failed to update prayer themes", details: updateError.message });
    }

    return json(200, { updated: true, themes });
  } catch (error) {
    console.error("extract_prayer_themes failed", error);
    return json(500, { error: String(error) });
  }
});
