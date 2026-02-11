import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL = 
process.env.EXPO_PUBLIC_SUPABASE_URL_PUBLIC || 
process.env.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY = 
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PUBLIC || 
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase environment variables are missing");
}


// ✅ True singleton Supabase client (created once at module load)
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
    },
  }
);

// Backwards compatibility for existing imports
export const getSupabase = () => supabase;
