// contexts/AuthProvider.tsx
import { getSupabase } from "@/lib/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// ---- Types ----
type AuthContextType = {
  user: User | null;
  loading: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

// ---- Context ----
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const { data } = await getSupabase().auth.getSession();
      setUser(data?.session?.user ?? null);
      setLoading(false);
    };
    initSession();

    const { data: listener } = getSupabase().auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          await AsyncStorage.setItem("supabase_session", JSON.stringify(session));
        } else {
          await AsyncStorage.removeItem("supabase_session");
        }
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);