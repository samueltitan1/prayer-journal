// supabase/functions/transcribe/index.ts
// @ts-nocheck  // 👈 Removes Deno/TS import noise inside Cursor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file" }), { status: 400 });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: (() => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("model", "whisper-1");
        return fd;
      })(),
    });

    const json = await whisperRes.json();
    return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});