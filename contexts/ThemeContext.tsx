// contexts/ThemeContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ThemePreference = "light" | "dark" | "system";
type ThemeType = "light" | "dark";

interface ThemeContextType {
  theme: ThemeType;
  themePreference: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  toggleTheme: () => void;
  colors: Record<string, string>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  themePreference: "system",
  setTheme: () => {},
  toggleTheme: () => {},
  colors: {},
  loading: true,
});

const THEME_STORAGE_KEY = "app_theme";

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

const resolveTheme = (
  preference: ThemePreference,
  systemTheme: "light" | "dark" | null | undefined
): ThemeType => {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  return systemTheme === "dark" ? "dark" : "light";
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [loading, setLoading] = useState(true);
  const theme = resolveTheme(themePreference, systemTheme);

  const colors =
    theme === "dark"
      ? {
          background: "#121212",
          card: "#1E1E1E",
          textPrimary: "#FFFFFF",
          textSecondary: "#BBBBBB",
          accent: "#C4A572",
        }
      : {
          background: "#FFFFFF",
          card: "#FAFAFA",
          textPrimary: "#111111",
          textSecondary: "#666666",
          accent: "#C4A572",
        };

  const applyTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isThemePreference(saved)) {
          setThemePreference(saved);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
        setTheme: applyTheme,
        toggleTheme,
        colors,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);