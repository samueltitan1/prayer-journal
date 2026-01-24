import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const KEY = "security_notice_dont_show_again_v1";

export async function shouldShowSecurityNotice(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  return v !== "true";
}

type Props = {
  visible: boolean;
  onClose: () => void;       // user cancels
  onContinue: () => void;    // user proceeds to record
};

export default function SecurityNoticeModal({ visible, onClose, onContinue }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem(KEY, "true");
    }
    onContinue();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>We Respect Your Privacy</Text>

          <Text style={styles.body}>
            Your prayers are private. We never read or access them.{"\n\n"}
            They're stored securely and you can delete them permanently at any time.{"\n\n"}
            Learn more in our <Text style={styles.link} onPress={() => Linking.openURL("https://prayerjournal.app/privacy")}>Privacy Policy</Text>.{"\n"}
            
          </Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxOn]} />
            <Text style={styles.checkboxLabel}>Don’t show again</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleContinue} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#111", borderRadius: 18, padding: 18 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 10 },
  body: { color: "#cfcfcf", fontSize: 13, lineHeight: 18, marginBottom: 14 },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: "#666", marginRight: 10 },
  checkboxOn: { backgroundColor: "#fff", borderColor: "#fff" },
  checkboxLabel: { color: "#cfcfcf", fontSize: 13 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  secondaryText: { color: "#cfcfcf", fontSize: 13 },
  primaryBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#fff", borderRadius: 12 },
  primaryText: { color: "#000", fontSize: 13, fontWeight: "600" },
  link: { color: "#fff", fontSize: 13, textDecorationLine: "underline" },
});