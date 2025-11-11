import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import OpenAI from "npm:openai";

serve(async (req) => {
  try {
    const { user_id, type } = await req.json();

    if (!user_id || !["weekly", "monthly"].includes(type)) {
      return new Response(JSON.stringify({ error: "Missing or invalid parameters" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recent prayers
    const days = type === "weekly" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data: prayers, error } = await supabase
      .from("prayers")
      .select("transcript_text, prayed_at")
      .eq("user_id", user_id)
      .gte("prayed_at", cutoff.toISOString());

    if (error) throw error;

    const transcripts = (prayers || [])
      .map((p) => p.transcript_text)
      .filter(Boolean)
      .join("\n");

    if (!transcripts || transcripts.trim().length < 20) {
      return new Response(JSON.stringify({ summary: null, note: "Not enough text to summarise" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

    // SAFETY PROMPT
    const prompt = `
You are producing a short reflective summary of someone's personal prayers.

Write in a calm, gentle, descriptive tone — never directive or instructive.
Avoid words like "should", "must", "need", or "God is saying".
Do not provide advice, prophecy, interpretation, or judgment.

Your role is simply to *mirror themes* the person prayed about,
so they can notice patterns and give thanks.

Always describe rather than interpret.
Never assume intent or outcome.

Style examples:
- "This week, your prayers often mentioned gratitude and peace."
- "You frequently reflected on patience, faith, and trust during challenges."

Keep it under 100 words.
Focus only on recurring emotions, topics, or expressions in the text.

PRAYERS START BELOW
-------------------------------------
${transcripts}
-------------------------------------
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 180,
      temperature: 0.4,
    });

    const summary = completion.choices[0].message?.content?.trim() ?? null;

    if (summary) {
      await supabase.from("reflections").insert({
        user_id,
        type,
        title: type === "weekly" ? "This Week’s Reflection" : "This Month’s Reflection",
        body: summary,
      });
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Error generating reflection:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});