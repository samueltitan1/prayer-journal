// supabase/functions/generate_reflection/index.ts
// @ts-nocheck  // 👈 Removes Deno/TS import noise inside Cursor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import OpenAI from "npm:openai";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------
interface ReflectionRequest {
  user_id: string;
  type: "weekly" | "monthly";
}

serve(async (req: Request): Promise<Response> => {
  try {
    const { user_id, type }: ReflectionRequest = await req.json();

    if (!user_id || !["weekly", "monthly"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid parameters" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // -----------------------------------------------------
    // DATE HELPERS
    // -----------------------------------------------------
    const today = new Date();

    const startOfWeek = () => {
      const d = new Date(today);
      const day = d.getDay(); // Sunday = 0
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfWeek = () => {
      const d = startOfWeek();
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const startOfMonth = () => new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = () =>
      new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    let rangeStart: Date;
    let rangeEnd: Date;

    // -----------------------------------------------------
    // DETERMINE RANGE + VALIDATION
    // -----------------------------------------------------
    if (type === "weekly") {
      // Only generate on Sundays
      if (today.getDay() !== 0) {
        return new Response(JSON.stringify({ skipped: "Not Sunday" }), {
          status: 200,
        });
      }

      // ✅ Summarize the *previous* full week (Sun–Sat) that just ended.
      // If today is Sunday, the week we want ends at Saturday 23:59:59.999.
      const end = new Date(today);
      end.setHours(0, 0, 0, 0); // today 00:00
      end.setMilliseconds(end.getMilliseconds() - 1); // yesterday 23:59:59.999

      const start = new Date(end);
      start.setDate(start.getDate() - 6); // back to Sunday 00:00
      start.setHours(0, 0, 0, 0);

      rangeStart = start;
      rangeEnd = end;
    } else {
      // ✅ Only run on the 1st of the month
      const isFirstDay = today.getDate() === 1;
      if (!isFirstDay) {
        return new Response(JSON.stringify({ skipped: "Not first day of month" }), {
          status: 200,
        });
      }

      // ✅ Summarize the *previous* calendar month.
      const prevMonthAnchor = new Date(today.getFullYear(), today.getMonth() - 1, 15);

      const start = new Date(prevMonthAnchor.getFullYear(), prevMonthAnchor.getMonth(), 1);
      start.setHours(0, 0, 0, 0);

      const end = new Date(prevMonthAnchor.getFullYear(), prevMonthAnchor.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);

      rangeStart = start;
      rangeEnd = end;
    }

    // -----------------------------------------------------
    // PREVENT DUPLICATE REFLECTIONS
    // -----------------------------------------------------
    // Block only if we already generated a reflection *today (UTC)*.
    // Do NOT use the summarized period for dedupe, because a reflection created
    // on the boundary (e.g., last Sunday) can fall inside the next week's range.

    const startOfTodayUTC = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    const endOfTodayUTC = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const { data: existing, error } = await supabase
      .from("reflections")
      .select("id, created_at")
      .eq("user_id", user_id)
      .eq("type", type)
      .gte("created_at", startOfTodayUTC.toISOString())
      .lte("created_at", endOfTodayUTC.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking existing reflections:", error);
    }

    if (existing) {
      return new Response(
        JSON.stringify({
          skipped: "Reflection already exists for today",
          debug: {
            user_id,
            type,
            now: new Date().toISOString(),
            startOfTodayUTC: startOfTodayUTC.toISOString(),
            endOfTodayUTC: endOfTodayUTC.toISOString(),
            existing,
          },
        }),
        { status: 200 }
      );
    }

    // -----------------------------------------------------
    // FETCH PRAYERS IN RANGE
    // -----------------------------------------------------
    const { data: prayers, error: prayersError } = await supabase
      .from("prayers")
      .select("transcript_text, prayed_at")
      .eq("user_id", user_id)
      .gte("prayed_at", rangeStart.toISOString())
      .lte("prayed_at", rangeEnd.toISOString())
      .order("prayed_at", { ascending: true });

    if (prayersError) throw prayersError;

    const transcripts = (prayers || [])
      .filter((p) => p.transcript_text)
      .map((p) => p.transcript_text)
      .join("\n");

    // -----------------------------------------------------
    // MINIMUM REQUIREMENTS
    // -----------------------------------------------------
    if (type === "weekly" && (prayers?.length ?? 0) < 2) {
      return new Response(
        JSON.stringify({ skipped: "Not enough prayers for weekly" }),
        { status: 200 }
      );
    }

    if (type === "monthly" && (prayers?.length ?? 0) < 4) {
      return new Response(
        JSON.stringify({ skipped: "Not enough prayers for monthly" }),
        { status: 200 }
      );
    }

    if (!transcripts || transcripts.trim().length < 20) {
      return new Response(
        JSON.stringify({ skipped: "Transcripts too short" }),
        { status: 200 }
      );
    }

    // -----------------------------------------------------
    // GENERATE REFLECTION
    // -----------------------------------------------------
    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY")!,
    });

    // -----------------------------------------------------
// PROMPTS (SEPARATED BY TYPE)
// -----------------------------------------------------

const weeklyPrompt = `
You are creating a gentle, observational reflection on someone's personal prayers from the past week.

YOUR ROLE:
- You are a compassionate witness, not an advisor or interpreter
- You notice patterns in themes, emotions, and spiritual movements
- You reflect what is present without adding meaning or direction

TONE & VOICE:
- Warm, calm, and contemplative
- Conversational but reverent
- Use "you" language naturally
- Mirror the emotional texture of the prayers

WHAT TO NOTICE:
- Recurring themes or concerns
- Emotional patterns
- Spiritual postures
- Shifts or movements within the week

WHAT TO AVOID:
- No advice, instruction, or direction
- No theological interpretation
- No platitudes or forced positivity

STRUCTURE (MANDATORY):
1. Primary themes
2. How they appeared
3. The week's spiritual texture
4. Gentle closing reflection

OUTPUT REQUIREMENT (MANDATORY):
- Write BETWEEN 80 AND 120 WORDS.
- If you are below 80 words, you MUST continue writing until you reach at least 80 words.
- Do NOT stop early.
- Do NOT add new themes. You may ONLY expand by describing how the SAME themes/emotions/postures showed up across the period.
- Output ONLY the reflection text.

PRAYERS FROM THIS WEEK
-------------------------
${transcripts}
-------------------------
`;

const monthlyPrompt = `
You are creating a thoughtful, observational reflection on someone's personal prayers from the past month.

YOUR ROLE:
- You are a compassionate witness to a spiritual journey
- You notice patterns, shifts, and emotional landscapes
- You reflect without interpreting God's intent

TONE & VOICE:
- Warm, contemplative, and expansive
- Reverent but conversational
- Allow tension and nuance

WHAT TO NOTICE:
- Persistent themes
- Emotional shifts
- Evolving spiritual postures
- Contrasts and tensions
- What seemed to matter most

WHAT TO AVOID:
- No advice or instruction
- No theological interpretation
- No growth assessments
- No forced resolution

STRUCTURE (MANDATORY):
1. Overall atmosphere
2. Primary theme
3. Secondary movement or tension
4. Gentle closing reflection

OUTPUT REQUIREMENT (MANDATORY):
- Write BETWEEN 150 AND 200 WORDS.
- If you are below 150 words, you MUST continue writing until you reach at least 150 words.
- Do NOT stop early.
- Do NOT add new themes. You may ONLY expand by describing how the SAME themes/emotions/postures showed up across the period.
- Output ONLY the reflection text.

PRAYERS FROM THIS MONTH
-------------------------
${transcripts}
-------------------------
`;

const prompt = type === "weekly" ? weeklyPrompt : monthlyPrompt;

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content:
        "You are writing a reflection. You MUST obey the requested word-count range exactly. Output ONLY the reflection text.",
    },
    { role: "user", content: prompt },
  ],
  temperature: 0.35,
  max_tokens: 1200,
});

    const summary = completion.choices[0].message?.content?.trim() ?? null;

if (!summary) {
  return new Response(JSON.stringify({ error: "AI returned no content" }), {
    status: 500,
  });
}

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const bounds =
  type === "weekly" ? { min: 80, max: 120 } : { min: 150, max: 200 };

const enforceWordBounds = async (text: string) => {
  const targetWords = Math.round((bounds.min + bounds.max) / 2);

  const rewritePrompt = `
Rewrite the reflection below so it is WITHIN ${bounds.min}–${bounds.max} words.

Rules (do not break these):
- Keep the same tone and constraints (no advice, no interpretation of God's intent, no platitudes).
- Do NOT add new themes. You may ONLY expand by describing how the SAME themes/emotions/postures showed up across the period.
- Output ONLY the reflection text.

If you struggle to hit the range, aim for EXACTLY ${targetWords} words.

REFLECTION TO REWRITE:
${text}
`;

  const retry = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You MUST obey the requested word-count range. Output ONLY the reflection text.",
      },
      { role: "user", content: rewritePrompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  });

  return retry.choices[0].message?.content?.trim() ?? text;
};

// Enforce bounds (one retry)
let finalSummary = summary;
let finalWc = countWords(finalSummary);

if (finalWc < bounds.min || finalWc > bounds.max) {
  finalSummary = await enforceWordBounds(finalSummary);
  finalWc = countWords(finalSummary);
}

// INSERT REFLECTION
await supabase.from("reflections").insert({
  user_id,
  type,
  title: type === "weekly" ? "This Week’s Reflection" : "This Month’s Reflection",
  body: finalSummary,
  created_at: new Date().toISOString(),
});

return new Response(
  JSON.stringify({ summary: finalSummary, word_count: finalWc, bounds, type }),
  { headers: { "Content-Type": "application/json" }, status: 200 }
);
} catch (err: any) {
  console.error("Reflection generation error:", err);
  return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
});