import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL_PUBLIC || process.env.EXPO_PUBLIC_SUPABASE_URL || "";

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PUBLIC || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const FALLBACK_SUPABASE_URL = "https://invalid.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "invalid-anon-key";

let didWarnMissingConfig = false;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const resolvedUrl = isSupabaseConfigured ? SUPABASE_URL : FALLBACK_SUPABASE_URL;
const resolvedAnonKey = isSupabaseConfigured ? SUPABASE_ANON_KEY : FALLBACK_SUPABASE_ANON_KEY;

if (!isSupabaseConfigured && !didWarnMissingConfig) {
  didWarnMissingConfig = true;
  console.error(
    "Supabase environment variables are missing. Auth/network calls will fail until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set."
  );
}

// True singleton Supabase client.
export const supabase: SupabaseClient = createClient(resolvedUrl, resolvedAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "prayer-journal-auth",
    flowType: "pkce",
  },
});

// Backwards compatibility for existing imports
export const getSupabase = () => supabase;
