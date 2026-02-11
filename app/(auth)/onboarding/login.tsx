import AuthCard from "@/components/AuthCard";
import OrDivider from "@/components/OrDivider";
import { useAuth } from "@/contexts/AuthProvider";
import { useTheme } from "@/contexts/ThemeContext";
import {
  trackAuthResult,
  trackOnboardingAction,
  trackOnboardingStepViewed,
  trackSignupMethodSelected,
} from "@/lib/analytics/onboarding";
import { signInWithGoogleToSupabase } from "@/lib/auth/googleNative";
import { getSupabase } from "@/lib/supabaseClient";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { buttons, fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Login() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trackOnboardingStepViewed("login");
    void upsertUserSettingsOnboarding(user?.id, {
      onboarding_step: "login",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  useEffect(() => {
    if (errorMessage) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [errorMessage]);

  const handleLogin = async () => {
    // Basic guard to avoid confusing Supabase errors
    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }
    trackSignupMethodSelected("email");
  
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  
    if (error) {
      trackAuthResult("email", "error", error.name || error.code || "auth_error");
      const msg = (error.message || "").toLowerCase();
  
      // Common for new accounts if email isn't confirmed yet
      if (msg.includes("email") && (msg.includes("confirm") || msg.includes("confirmed"))) {
        setErrorMessage("Please confirm your email, then sign in again.");
        return;
      }
  
      setErrorMessage("Incorrect email or password. Please try again.");
      return;
    }
  
    setErrorMessage(null);
    trackAuthResult("email", "success");
    trackOnboardingAction("login", "continue");
  
    // ✅ Correct route into the tabs group
    router.replace("/(tabs)/pray");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter your email", "Please type your email first.");
      return;
    }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check your inbox", "We’ve sent you a reset link.");
  };

  const handleAppleSignIn = async () => {
    try {
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
        trackAuthResult("apple", "error", error.name || error.code || "auth_error");
        setErrorMessage(error.message || "Apple sign-in failed. Please try again.");
        return;
      }
  
      trackAuthResult("apple", "success");
      trackOnboardingAction("login", "continue");
      router.replace("/(tabs)/pray");
    } catch (e: any) {
      // user cancels Apple sheet
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      trackAuthResult("apple", "error", e?.code || e?.name || "auth_error");
      setErrorMessage(e?.message ?? "Apple sign-in failed. Please try again.");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    trackSignupMethodSelected("google");
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const userId = await signInWithGoogleToSupabase();
      if (!userId) return;
      trackAuthResult("google", "success");
      trackOnboardingAction("login", "continue");
      router.replace("/(tabs)/pray");
    } catch (err: any) {
      trackAuthResult("google", "error", err?.code || err?.name || "auth_error");
      setErrorMessage(err?.message ?? "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require("@/assets/logo.png")} style={styles.logo} />
      <Text style={[styles.appTitle, { color: colors.textPrimary }]}>Prayer Journal</Text>

      <AuthCard style={{ backgroundColor: colors.card }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.textPrimary },
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
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry={!showPassword}
              style={[
                styles.input,
                {
                  paddingRight: 40,
                  backgroundColor: colors.card,
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

        {errorMessage && (
          <Animated.Text
            style={[styles.errorText, { color: "#D64545", opacity: fadeAnim }]}
          >
            {errorMessage}
          </Animated.Text>
        )}

        {/* Forgot password */}
        <Text style={[styles.forgot, { color: colors.textSecondary }]} onPress={handleForgotPassword}>
          Forgot password?
        </Text>

        {/* Sign in button */}
        <TouchableOpacity
          style={[buttons.primary, { marginTop: spacing.sm }]}
          onPress={handleLogin}
        >
          <Text style={styles.continueButton}>SIGN IN</Text>
        </TouchableOpacity>

        <OrDivider />

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
        <TouchableOpacity
          style={[
            styles.googleButton,
            { backgroundColor: colors.card, borderColor: colors.textSecondary },
          ]}
          onPress={handleGoogleSignIn}
        >
          <Image source={require("@/assets/google-g.png")} style={styles.googleIcon} />
          <Text style={[styles.googleText, { color: colors.textPrimary }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>
        {googleLoading && (
          <Text style={[styles.appleLoadingText, { color: colors.textSecondary }]}>
            Signing in with Google…
          </Text>
        )}

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Don’t have an account?{" "}
          <Text
            style={[styles.link, { color: colors.accent }]}
            onPress={() => router.replace("/(auth)/onboarding/welcome")}
          >
            Sign up
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
  },
  logo: { width: 48, height: 48, marginBottom: spacing.xs },
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
  forgot: {
    textAlign: "right",
    fontSize: 13,
    marginBottom: spacing.lg,
    fontFamily: fonts.body,
  },
  footerText: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontFamily: fonts.body,
  },
  link: {
    fontFamily: fonts.body,
  },
  continueButton: {},
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.sm,
    textAlign: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleText: {
    fontFamily: fonts.body,
    fontSize: 14,
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
