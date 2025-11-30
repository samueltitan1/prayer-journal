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

      const isLastDay =
        today.toDateString() === endOfMonth().toDateString();
      const isFirstDay = today.getDate() === 1;

      if (!isLastDay && !isFirstDay) {
        return new Response(
          JSON.stringify({ skipped: "Not end/start of month" }),
          { status: 200 }
        );
      }
    }

    // -----------------------------------------------------
    // PREVENT DUPLICATE REFLECTIONS
    // -----------------------------------------------------
    const { data: existing } = await supabase
      .from("reflections")
      .select("id")
      .eq("user_id", user_id)
      .eq("type", type)
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ skipped: "Reflection already exists" }),
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

    const prompt = `
You are producing a short reflective summary of someone's personal prayers.

Write in a calm, gentle, descriptive tone — never directive or instructive.
Avoid advice, commands, should/must language, or interpretation.
Only reflect patterns in the actual text.

Keep reflection under 120 words.

PRAYERS BELOW
-------------------------
${transcripts}
-------------------------
`;

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