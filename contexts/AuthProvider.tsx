// contexts/AuthProvider.tsx
import { scheduleDailyPrayerNotification } from "@/lib/notifications";
import { getSupabase } from "@/lib/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---- Types ----
type AuthContextType = {
  user: User | null;
  loading: boolean;
  emailConfirmed: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

// ---- Context ----
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Keep a stable Supabase client instance for the lifetime of this provider.
  const supabaseRef = useRef<ReturnType<typeof getSupabase> | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = getSupabase();
  }
  const supabase = supabaseRef.current;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    let isMounted = true;

        // Ensure we only apply the pending reminder once per app run.
        const didApplyPendingReminderRef = { current: false } as { current: boolean };

        const applyPendingReminderIfAny = async (uid: string) => {
          if (didApplyPendingReminderRef.current) return;
    
          try {
            const raw = await AsyncStorage.getItem("pending_prayer_reminder");
            if (!raw) return;
    
            const parsed = JSON.parse(raw) as { enabled?: boolean; time?: string };
            const enabled = parsed?.enabled === true;
            const time = typeof parsed?.time === "string" ? parsed.time : null;
    
            // If payload is incomplete, clear it so we don't retry forever.
            if (!enabled || !time) {
              await AsyncStorage.removeItem("pending_prayer_reminder");
              didApplyPendingReminderRef.current = true;
              return;
            }
    
            // Schedule local daily reminder.
            await scheduleDailyPrayerNotification(time);
    
            // Persist to DB now that we have userId.
            await supabase.from("user_settings").upsert({
              user_id: uid,
              daily_reminder_enabled: true,
              reminder_time: time,
            });
    
            // Clean up
            await AsyncStorage.removeItem("pending_prayer_reminder");
            didApplyPendingReminderRef.current = true;
          } catch {
            // Never block auth flow
          }
        };

    // 1. Load initial session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
    
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setEmailConfirmed(!!nextUser?.email_confirmed_at);
      setLoading(false);
    
      if (nextUser?.id) {
        await applyPendingReminderIfAny(nextUser.id);
      }
    });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
    
      if (event === "SIGNED_OUT") {
        setUser(null);
        setEmailConfirmed(false);
        setLoading(false);
        return;
      }
    
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setEmailConfirmed(!!nextUser?.email_confirmed_at);
      setLoading(false);
    
      if (nextUser?.id) {
        await applyPendingReminderIfAny(nextUser.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading, emailConfirmed }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};