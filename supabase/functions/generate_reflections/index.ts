// supabase/functions/generate_reflections/index.ts
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
      rangeStart = startOfWeek();
      rangeEnd = endOfWeek();

      // Only generate on Sundays
      if (today.getDay() !== 0) {
        return new Response(
          JSON.stringify({ skipped: "Not Sunday" }),
          { status: 200 }
        );
      }
    } else {
      rangeStart = startOfMonth();
      rangeEnd = endOfMonth();

     // ✅ Only run on the 1st of the month
      const isFirstDay = today.getDate() === 1;

      if (!isFirstDay) {
        return new Response(
          JSON.stringify({ skipped: "Not first day of month" }),
          { status: 200 }
        );
      }
    }

    // -----------------------------------------------------
    // PREVENT DUPLICATE REFLECTIONS
    // -----------------------------------------------------
    const { data: existing, error } = await supabase
      .from("reflections")
      .select("id, created_at")
      .eq("user_id", user_id)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
      if (error) {
        console.error("Error checking existing reflections:", error);
      }
      
      if (existing) {
        const lastCreated = new Date(existing.created_at);
    
      // If the latest reflection already falls inside this week's/month's range, skip
      if (lastCreated >= rangeStart && lastCreated <= rangeEnd) {
        return new Response(
          JSON.stringify({
            skipped: "Reflection already exists for this period",
          }),
          { status: 200 }
        );
      }
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

STRUCTURE (80–100 words):
1. Primary themes
2. How they appeared
3. The week's spiritual texture

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

STRUCTURE (150–200 words):
1. Overall atmosphere
2. Primary theme
3. Secondary movement or tension
4. Gentle closing reflection

PRAYERS FROM THIS MONTH
-------------------------
${transcripts}
-------------------------
`;

const prompt = type === "weekly" ? weeklyPrompt : monthlyPrompt;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 200,
    });

    const summary = completion.choices[0].message?.content?.trim() ?? null;

    if (!summary) {
      return new Response(
        JSON.stringify({ error: "AI returned no content" }),
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // INSERT REFLECTION
    // -----------------------------------------------------
    await supabase.from("reflections").insert({
      user_id,
      type,
      title: type === "weekly" ? "This Week’s Reflection" : "This Month’s Reflection",
      body: summary,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ summary }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("Reflection generation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});