// contexts/AuthProvider.tsx
import { scheduleDailyPrayerNotification } from "@/lib/notifications";
import { syncRevenueCatIdentity } from "@/lib/revenuecat";
import { getSupabase } from "@/lib/supabaseClient";
import { setWidgetSignedInState } from "@/lib/widgetAuthState";
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
import { AppState } from "react-native";

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
const PENDING_PRAYER_REMINDER_KEY_PREFIX = "pending_prayer_reminder";
const LEGACY_PENDING_PRAYER_REMINDER_KEY = "pending_prayer_reminder";
const getPendingPrayerReminderKey = (uid: string) =>
  `${PENDING_PRAYER_REMINDER_KEY_PREFIX}:${uid}`;

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

  const logAuthSnapshot = (
    source: "getSession" | "onAuthStateChange",
    event: string,
    sessionUserId: string | null | undefined
  ) => {
    if (!__DEV__) return;
    console.log("auth: snapshot", {
      source,
      event,
      hasSession: Boolean(sessionUserId),
      userId: sessionUserId ?? null,
    });
  };

  useEffect(() => {
    let isMounted = true;

        // Ensure we only apply the pending reminder once per app run.
        const didApplyPendingReminderRef = { current: false } as { current: boolean };

        const applyPendingReminderIfAny = async (uid: string) => {
          if (didApplyPendingReminderRef.current) return;
    
          try {
            const scopedKey = getPendingPrayerReminderKey(uid);
            const raw = await AsyncStorage.getItem(scopedKey);
            if (!raw) {
              await AsyncStorage.removeItem(LEGACY_PENDING_PRAYER_REMINDER_KEY);
              return;
            }
    
            const parsed = JSON.parse(raw) as {
              enabled?: boolean;
              time?: string;
              userId?: string;
            };
            const enabled = parsed?.enabled === true;
            const time = typeof parsed?.time === "string" ? parsed.time : null;
            const ownerUserId =
              typeof parsed?.userId === "string" ? parsed.userId : null;
    
            // If payload is incomplete, clear it so we don't retry forever.
            if (!enabled || !time || (ownerUserId && ownerUserId !== uid)) {
              await AsyncStorage.removeItem(scopedKey);
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
            await AsyncStorage.removeItem(scopedKey);
            await AsyncStorage.removeItem(LEGACY_PENDING_PRAYER_REMINDER_KEY);
            didApplyPendingReminderRef.current = true;
          } catch {
            // Never block auth flow
          }
        };

    // 1. Load initial session
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) return;
        logAuthSnapshot("getSession", "INITIAL_SESSION", data.session?.user?.id ?? null);

        const nextUser = data.session?.user ?? null;
        setUser(nextUser);
        setEmailConfirmed(!!nextUser?.email_confirmed_at);
        setLoading(false);
        await setWidgetSignedInState(Boolean(nextUser?.id));

        if (nextUser?.id) {
          await applyPendingReminderIfAny(nextUser.id);
        }
        try {
          await syncRevenueCatIdentity(nextUser?.id ?? null);
          if (__DEV__) {
            console.log("auth: revenuecat identity synced from getSession", {
              userId: nextUser?.id ?? null,
            });
          }
        } catch (error) {
          console.warn("RevenueCat identity sync failed", error);
        }
      })
      .catch(async (error) => {
        console.warn("AuthProvider getSession failed", error);
        if (!isMounted) return;
        setUser(null);
        setEmailConfirmed(false);
        setLoading(false);
        await setWidgetSignedInState(false);
      });

    // Keep refresh running only while app is active (RN best practice).
    supabase.auth.startAutoRefresh();
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      logAuthSnapshot("onAuthStateChange", event, session?.user?.id ?? null);
    
      if (event === "SIGNED_OUT") {
        setUser(null);
        setEmailConfirmed(false);
        setLoading(false);
        await setWidgetSignedInState(false);
        try {
          await syncRevenueCatIdentity(null);
          if (__DEV__) {
            console.log("auth: revenuecat identity cleared on sign-out");
          }
        } catch (error) {
          console.warn("RevenueCat sign-out sync failed", error);
        }
        return;
      }
    
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setEmailConfirmed(!!nextUser?.email_confirmed_at);
      setLoading(false);
      await setWidgetSignedInState(Boolean(nextUser?.id));
    
      if (nextUser?.id) {
        await applyPendingReminderIfAny(nextUser.id);
      }
      try {
        await syncRevenueCatIdentity(nextUser?.id ?? null);
        if (__DEV__) {
          console.log("auth: revenuecat identity synced from auth change", {
            event,
            userId: nextUser?.id ?? null,
          });
        }
      } catch (error) {
        console.warn("RevenueCat identity sync failed", error);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSub.remove();
      supabase.auth.stopAutoRefresh();
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
