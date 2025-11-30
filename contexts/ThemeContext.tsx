// contexts/ThemeContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";

type ThemeType = "light" | "dark";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
  toggleTheme: () => void;
  colors: Record<string, string>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  colors: {},
  loading: true,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeType>("light");
  const [loading, setLoading] = useState(true);

  const colors =
    theme === "dark"
      ? {
          background: "#121212",
          card: "#1E1E1E",
          textPrimary: "#FFFFFF",
          textSecondary: "#BBBBBB",
          accent: "#F8E38A",
        }
      : {
          background: "#FFFFFF",
          card: "#FAFAFA",
          textPrimary: "#111111",
          textSecondary: "#666666",
          accent: "#F8E38A",
        };

  const applyTheme = (t: ThemeType) => {
    setThemeState(t);
    AsyncStorage.setItem("app_theme", t).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("app_theme");
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
        } else {
          const sys = Appearance.getColorScheme();
          if (sys) setThemeState(sys);
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