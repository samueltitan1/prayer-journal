// supabase/functions/transcribe/index.ts
// @ts-nocheck  // 👈 Removes Deno/TS import noise inside Cursor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const OPENAI_TRANSCRIPT_URL = "https://api.openai.com/v1/audio/transcriptions";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const buildTranscriptionFormData = (
  file: File,
  options: {
    includeAdvancedSilenceTuning: boolean;
  }
) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("model", "whisper-1");
  fd.append("language", "en");
  fd.append("temperature", "0");

  if (options.includeAdvancedSilenceTuning) {
    fd.append("no_speech_threshold", "0.6");
    fd.append("condition_on_previous_text", "false");
  }

  return fd;
};

const readJsonSafely = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Missing Supabase config" }, 500);
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authed.auth.getUser();
    if (authError || !user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return jsonResponse({ error: "No file" }, 400);
    }
    if (typeof file.size === "number" && file.size > MAX_AUDIO_BYTES) {
      return jsonResponse({ error: "File too large" }, 413);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonResponse({ error: "Missing OpenAI API key" }, 500);
    }

    const whisperRes = await fetch(OPENAI_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: buildTranscriptionFormData(file, { includeAdvancedSilenceTuning: true }),
    });

    let json = await readJsonSafely(whisperRes);

    // Some models/endpoints may reject advanced tuning fields. Retry once with
    // core parameters so prayer flow does not break for users.
    if (!whisperRes.ok) {
      const errorText = JSON.stringify(json ?? {}).toLowerCase();
      const mayBeUnsupportedField =
        errorText.includes("unknown parameter") ||
        errorText.includes("unrecognized request argument") ||
        errorText.includes("no_speech_threshold") ||
        errorText.includes("condition_on_previous_text");

      if (mayBeUnsupportedField) {
        const retryRes = await fetch(OPENAI_TRANSCRIPT_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
          body: buildTranscriptionFormData(file, { includeAdvancedSilenceTuning: false }),
        });
        json = await readJsonSafely(retryRes);
        if (retryRes.ok) return jsonResponse(json, 200);
        return jsonResponse(json ?? { error: "Transcription failed" }, retryRes.status || 502);
      }

      return jsonResponse(json ?? { error: "Transcription failed" }, whisperRes.status || 502);
    }

    return jsonResponse(json ?? {}, 200);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});