// app/(auth)/confirm-email.tsx
import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export default function ConfirmEmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: 22,
          color: colors.textPrimary,
          marginBottom: spacing.md,
          textAlign: "center",
        }}
      >
        Please confirm your email
      </Text>

      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        We’ve sent you a link to verify your email address.
        Once confirmed, return here to sign in.
      </Text>

      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: spacing.md,
        }}
      >
        Confirmed?{" "}
        <Text
          style={{
            textDecorationLine: "underline",
            color: colors.accent,
          }}
          onPress={() => router.replace("/(auth)/login")}
        >
          Sign in
        </Text>
      </Text>
    </View>
  );
}