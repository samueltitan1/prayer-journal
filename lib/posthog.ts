import PostHog from "posthog-react-native";

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;
const ANALYTICS_ENABLED = !__DEV__ && !!API_KEY && !!HOST;

const FORBIDDEN_KEYS = new Set([
  "transcript_text",
  "prayer_text",
  "ocr_text",
  "verse_text",
  "image_base64",
  "image_uri",
  "imageuri",
  "audio_uri",
  "audiouri",
  "uri",
  "storagepath",
  "storage_path",
  "audio_path",
  "image_path",
  "location_name",
  "walk_map_path",
  "walkmappath",
  "walk_map_uri",
  "walkmapuri",
  "signed_url",
  "signedurl",
  "token",
  "latitude",
  "longitude",
  "coords",
  "walkcoords",
  "route",
  "polyline",
]);

let client: PostHog | null = null;

const URL_KEY_RE = /(url|uri)/i;

function redactProps(props?: Record<string, unknown>) {
  if (!props) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const keyLower = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(keyLower)) continue;
    if (typeof value === "string") {
      const lowered = value.toLowerCase();
      if (lowered.startsWith("http") || lowered.startsWith("file://") || lowered.startsWith("data:")) {
        continue;
      }
    }
    if (URL_KEY_RE.test(keyLower)) {
      if (typeof value === "boolean") {
        cleaned[key] = value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        cleaned[key] = value;
      }
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export function initPostHog() {
  if (!ANALYTICS_ENABLED || client) return;
  client = new PostHog(API_KEY as string, { host: HOST });
}

export function identifyUser(userId: string) {
  if (!ANALYTICS_ENABLED || !client) return;
  try {
    client.identify(userId);
  } catch {}
}

export function resetAnalytics() {
  if (!ANALYTICS_ENABLED || !client) return;
  try {
    client.reset();
  } catch {}
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (!ANALYTICS_ENABLED || !client) return;
  try {
    client.capture(event, redactProps(props));
  } catch {}
}
