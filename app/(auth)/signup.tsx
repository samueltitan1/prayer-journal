import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AuthCard from "../../components/AuthCard";
import { useTheme } from "../../contexts/ThemeContext";
import { getSupabase } from "../../lib/supabaseClient";
import { buttons, fonts, spacing } from "../../theme/theme";

export default function SignUp() {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSignUp = async () => {
    if (!agreed) {
      Alert.alert("Agreement required", "Please agree to the terms first.");
      return;
    }
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) Alert.alert("Sign up failed", error.message);
    else router.replace("/(auth)/confirm-email");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} />
      <Text style={[styles.appTitle, { color: colors.textPrimary }]}>Prayer Journal</Text>

      <AuthCard style={{ backgroundColor: colors.card }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create your account</Text>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.textPrimary },
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

        {/* Terms */}
        <View style={styles.checkboxRow}>
          <Switch
            value={agreed}
            onValueChange={setAgreed}
            thumbColor={agreed ? colors.accent : "#ccc"}
            trackColor={{ true: colors.accent + "40", false: "#ddd" }}
          />
          <Text style={[styles.checkboxText, { color: colors.textSecondary }]}>
            I agree to the{" "}
            <Text
              style={[styles.link, { color: colors.accent }]}
              onPress={() => Linking.openURL("https://your-terms-url.com")}
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              style={[styles.link, { color: colors.accent }]}
              onPress={() => Linking.openURL("https://your-privacy-url.com")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[buttons.primary, { marginTop: spacing.lg }]}
          onPress={handleSignUp}
        >
          <Text style={styles.continueButton}>CREATE ACCOUNT</Text>
        </TouchableOpacity>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          You can adjust notifications anytime.
        </Text>

        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Already have an account?{" "}
          <Text
            style={[styles.link, { color: colors.accent }]}
            onPress={() => router.replace("/(auth)/login")}
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
  continueButton: {}
});