import { getSupabase } from "@/lib/supabaseClient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";

const extractParams = (url: string) => {
  const hash = url.split("#")[1];
  const query = url.split("?")[1];
  const params = new URLSearchParams(hash || query || "");
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    code: params.get("code"),
  };
};

export default function ResetPassword() {
  const router = useRouter();
  const supabase = getSupabase();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (url: string) => {
      const { accessToken, refreshToken, code } = extractParams(url);
      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } catch {
        // If token parsing fails, user can still retry from email link.
      } finally {
        if (isMounted) setReady(true);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        void handleUrl(url);
      } else {
        setReady(true);
      }
    });

    const sub = Linking.addEventListener("url", (event) => {
      void handleUrl(event.url);
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [supabase]);

  const handleUpdate = async () => {
    if (!password || password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", "Please re-type the same password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Password updated", "You can now sign in with your new password.");
    router.replace("/(auth)/onboarding/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.body}>
          {ready
            ? "Enter a new password below."
            : "Preparing secure reset session..."}
        </Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Updating..." : "Update password"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/onboarding/login")}>
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F4EF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    color: "#1A1A1A",
  },
  body: {
    fontSize: 14,
    color: "#6B6B6B",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  link: {
    marginTop: 14,
    color: "#6B6B6B",
    textAlign: "center",
  },
});
