import AuthCard from "@/components/AuthCard";
import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OrDivider from "@/components/OrDivider";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackAuthResult,
  trackOnboardingAction,
  trackOnboardingStepViewed,
  trackSignupMethodSelected,
} from "@/lib/analytics/onboarding";
import { signInWithGoogleToSupabase } from "@/lib/auth/googleNative";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { persistOnboardingSurveyAnswers } from "@/lib/persistOnboardingSurvey";
import { getSupabase } from "@/lib/supabaseClient";
import { buttons, colors, fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function SignUp() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    trackOnboardingStepViewed("signup");
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: "signup",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const handleSignUp = async () => {
    trackSignupMethodSelected("email");
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      trackAuthResult("email", "error", error.name || error.code || "auth_error");
      Alert.alert("Sign up failed", error.message);
    } else {
      trackAuthResult("email", "success");
      const { data } = await getSupabase().auth.getSession();
      const userId = data.session?.user?.id;
      void upsertOnboardingResponses(userId, {
        onboarding_step: "preparing",
      });
      void persistOnboardingSurveyAnswers(userId);
      trackOnboardingAction("signup", "continue");
      router.replace("/(auth)/onboarding/preparing");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log("Apple sign-in pressed (signup)");
      trackSignupMethodSelected("apple");
      setErrorMessage(null);
      setAppleLoading(true);
  
      if (Platform.OS !== "ios") {
        Alert.alert("Unavailable", "Apple Sign In is only available on iOS.");
        return;
      }
  
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
  
      if (!credential.identityToken) {
        Alert.alert(
          "Sign in failed",
          "Apple did not return an identity token. Please try again."
        );
        return;
      }
  
      const { error } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        console.log("Apple sign-in error (signup)", error);
        trackAuthResult("apple", "error", error.name || error.code || "auth_error");
        setErrorMessage(error.message || "Apple sign-in failed. Please try again.");
        return;
      }
      console.log("Apple sign-in success (signup)");
      trackAuthResult("apple", "success");

      const { data } = await getSupabase().auth.getSession();
      const userId = data.session?.user?.id;
      void upsertOnboardingResponses(userId, {
        onboarding_step: "preparing",
      });
      void persistOnboardingSurveyAnswers(userId);
      trackOnboardingAction("signup", "continue");
      router.replace("/(auth)/onboarding/preparing");
    } catch (e: any) {
      // user cancels Apple sheet
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      console.log("Apple sign-in exception (signup)", e);
      trackAuthResult("apple", "error", e?.code || e?.name || "auth_error");
      setErrorMessage(e?.message ?? "Apple sign-in failed. Please try again.");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log("Google sign-in pressed (signup)");
    trackSignupMethodSelected("google");
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const userId = await signInWithGoogleToSupabase();
      if (!userId) return;
      console.log("Google sign-in success (signup)", userId);
      trackAuthResult("google", "success");
      void upsertOnboardingResponses(userId, {
        onboarding_step: "preparing",
      });
      void persistOnboardingSurveyAnswers(userId);
      trackOnboardingAction("signup", "continue");
      router.replace("/(auth)/onboarding/preparing");
    } catch (err: any) {
      console.log("Google sign-in error (signup)", err);
      trackAuthResult("google", "error", err?.code || err?.name || "auth_error");
      setErrorMessage(err?.message ?? "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        progress={getOnboardingProgress("signup")}
        onBack={() => {
          trackOnboardingAction("signup", "back");
          router.replace("/(auth)/onboarding/reminder");
        }}
      />
      <Text style={[styles.appTitle, { color: colors.textPrimary }]}>Save your progress</Text>

      <AuthCard style={{ backgroundColor: "#FFFFFF" }}>
        
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              { backgroundColor: "#FFFFFF", color: colors.textPrimary },
            ]}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: "#FFFFFF", color: colors.textPrimary },
            ]}
            placeholder="your@email.com"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={[
                styles.input,
                {
                  paddingRight: 40,
                  backgroundColor: "#FFFFFF",
                  color: colors.textPrimary,
                },
              ]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.iconWrapper}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
  
        {/* Button */}
        <TouchableOpacity
          style={[buttons.primary, { marginTop: spacing.lg }]}
          onPress={handleSignUp}
        >
          <Text style={styles.continueButton}>CREATE AN ACCOUNT</Text>
        </TouchableOpacity>

        <OrDivider textColor={colors.textSecondary} lineColor={colors.textSecondary} />

        {Platform.OS === "ios" && (
          <View style={{ marginTop: spacing.sm }}>
            <TouchableOpacity
              style={[styles.appleButton, { backgroundColor: "#000000" }]}
              onPress={handleAppleSignIn}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
              <Text style={styles.appleText}>Continue with Apple</Text>
            </TouchableOpacity>
            {appleLoading && (
              <Text style={[styles.appleLoadingText, { color: colors.textSecondary }]}>
                Signing in with Apple…
              </Text>
            )}
          </View>
        )}
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Image source={require("@/assets/google-g.png")} style={styles.googleIcon} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
        {googleLoading && (
          <Text style={[styles.appleLoadingText, { color: colors.textSecondary }]}>
            Signing in with Google…
          </Text>
        )}

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Already have an account?{" "}
          <Text
            style={[styles.link, { color: colors.accentGold }]}
            onPress={() => router.replace("/(auth)/onboarding/login")}
          >
            Sign in
          </Text>
        </Text>
      </AuthCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: spacing.xl,
    backgroundColor: colors.backgroundLight,
  },
  logo: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
  },
  appTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtext: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  fieldGroup: { marginBottom: spacing.md },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 4,
  },
  inputWrapper: { position: "relative" },
  input: {
    borderRadius: 25,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
  },
  iconWrapper: {
    position: "absolute",
    right: 16,
    top: "30%",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  checkboxText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  link: { fontFamily: fonts.body },
  note: {
    textAlign: "center",
    fontFamily: fonts.body,
    marginTop: spacing.md,
    fontSize: 12,
  },
  footerText: {
    textAlign: "center",
    marginTop: spacing.md,
    fontFamily: fonts.body,
  },
  continueButton: {
  },
  appleLoadingText: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  googleButton: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  googleIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  appleButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: "#FFFFFF",
  },

});
