import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { supabase } from "../../lib/supabaseClient";
import { buttons, fonts, spacing } from "../../theme/theme";

export default function Login() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login failed", error.message);
    else router.replace("/pray");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter your email", "Please type your email first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
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
            onChangeText={setEmail}
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
              onChangeText={setPassword}
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
            onPress={() => router.replace("/auth/signup")}
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
});