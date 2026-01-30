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
  "imageUri",
  "audio_uri",
  "audioUri",
  "uri",
  "storagePath",
  "storage_path",
  "audio_path",
  "image_path",
  "location_name",
]);

let client: PostHog | null = null;

function redactProps(props?: Record<string, unknown>) {
  if (!props) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
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
