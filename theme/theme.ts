// theme/theme.ts
import { Platform } from "react-native";

export const colors = {
  backgroundLight: "#FAF9F6",
  backgroundDark: "#1A1A1A",
  textPrimary: "#2F2F2F",
  textSecondary: "#6B6B6B",
  accentGold: "#E3C67B",
};

export const fonts = {
  heading: Platform.select({
    ios: "PlayfairDisplay-Medium",
    android: "PlayfairDisplay-Medium",
    default: "Playfair Display",
  }),
  body: Platform.select({
    ios: "Inter-Regular",
    android: "Inter-Regular",
    default: "Inter",
  }),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const buttons = {
  primary: {
    backgroundColor: colors.accentGold,
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  primaryText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 24, // ensures no clipping
    color: colors.textPrimary,
    textAlign: "center" as const,
  },
};
// Shared styles for auth screens
export const authStyles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    lineHeight: 40,
    textAlign: "center" as const,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center" as const,
    marginBottom: spacing.xl,
  },
  input: {
    width: "100%" as const,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: spacing.md,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: colors.textPrimary,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  link: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center" as const,
  },
};