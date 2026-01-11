import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AuthCard from "../../components/AuthCard";
import { useTheme } from "../../contexts/ThemeContext";
import { getSupabase } from "../../lib/supabaseClient";
import { buttons, fonts, spacing } from "../../theme/theme";

export default function Login() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

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
  
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  
    if (error) {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} />
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

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Don’t have an account?{" "}
          <Text
            style={[styles.link, { color: colors.accent }]}
            onPress={() => router.replace("/(auth)/signup")}
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
});