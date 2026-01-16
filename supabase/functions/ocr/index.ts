// supabase/functions/ocr/index.ts
// @ts-nocheck
// Azure AI Vision (Computer Vision) Read v3.2 OCR via Supabase Edge Function
// Expects secrets: AZURE_VISION_ENDPOINT and AZURE_VISION_KEY

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64ToUint8Array(base64: string) {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractTextFromReadResult(j: any): string {
  const readResults = j?.analyzeResult?.readResults;
  if (!Array.isArray(readResults)) return "";

  const lines: string[] = [];
  for (const page of readResults) {
    const pageLines = page?.lines;
    if (!Array.isArray(pageLines)) continue;
    for (const ln of pageLines) {
      const t = ln?.text;
      if (typeof t === "string" && t.trim()) lines.push(t.trim());
    }
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const image_base64 = body?.image_base64;

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Missing image_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = (Deno.env.get("AZURE_VISION_ENDPOINT") || "").replace(/\/+$/, "");
    const key = Deno.env.get("AZURE_VISION_KEY") || "";

    if (!endpoint || !key) {
      return new Response(
        JSON.stringify({
          error:
            "Missing OCR secrets. Set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY in Supabase Edge Function Secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bytes = base64ToUint8Array(image_base64);

    // Azure Vision Read v3.2 (async)
    // Docs: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/how-to/call-read-api
    const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze?readingOrder=natural`;

    const analyzeRes = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
    });

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: "Analyze request failed",
          details: errText,
          hint:
            "Check that AZURE_VISION_ENDPOINT matches the same Azure Vision (Computer Vision) resource as AZURE_VISION_KEY.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const opLoc =
      analyzeRes.headers.get("operation-location") ||
      analyzeRes.headers.get("Operation-Location");

    if (!opLoc) {
      return new Response(JSON.stringify({ error: "No Operation-Location header returned by Azure" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Poll result
    let resultJson: any = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(900);

      const r = await fetch(opLoc, {
        method: "GET",
        headers: { "Ocp-Apim-Subscription-Key": key },
      });

      if (!r.ok) continue;

      const j = await r.json().catch(() => null);
      const status = j?.status?.toLowerCase?.();

      if (status === "succeeded") {
        resultJson = j;
        break;
      }

      if (status === "failed") {
        return new Response(JSON.stringify({ error: "OCR failed", details: j }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const text = resultJson ? extractTextFromReadResult(resultJson) : "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});