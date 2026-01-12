// components/TranscriptEditor.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fonts, spacing } from "../theme/theme";

interface TranscriptEditorProps {
  visible: boolean;
  mode: "audio" | "text";
  transcript: string;
  onChangeText: (text: string) => void;
  onSave: (opts?: { isBookmarked?: boolean; keepAudio?: boolean }) => void;
  onDiscard: () => void;
  loading?: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  keepAudio: boolean;
  onToggleKeepAudio: () => void;
}

export default function TranscriptEditor({
  visible,
  mode,
  transcript,
  onChangeText,
  onSave,
  onDiscard,
  loading,
  isBookmarked,
  onToggleBookmark,
  keepAudio,
  onToggleKeepAudio,
}: TranscriptEditorProps) {
  const { colors } = useTheme();

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {mode === "text" ? "Journal Entry" : "Review your prayer"}
          </Text>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleBookmark();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isBookmarked ? "heart" : "heart-outline"}
                  size={22}
                  color={isBookmarked ? colors.accent : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {mode === "text"
                ? "Write your prayer and save it to your journal."
                : "You can correct any words before saving."}
            </Text>

            {mode === "audio" && (
              <View
                style={[
                  styles.keepAudioRow,
                  {
                    borderColor: colors.textSecondary + "33",
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View style={styles.keepAudioLeft}>
                  <Text style={[styles.keepAudioText, { color: colors.textPrimary }]}>
                    Save audio file
                  </Text>
                  <Text style={[styles.keepAudioHint, { color: colors.textSecondary }]}>
                    (optional)
                  </Text>
                </View>

                <Switch
                  value={keepAudio}
                  onValueChange={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleKeepAudio();
                  }}
                  disabled={loading}
                />
              </View>
            )}

            <TextInput
              multiline
              value={transcript}
              onChangeText={onChangeText}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  borderColor: colors.textSecondary + "33",
                },
              ]}
              placeholder="Your words to the Father..."
              placeholderTextColor={colors.textSecondary + "77"}
              textAlignVertical="top"
            />

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={onDiscard}
                disabled={loading}
              >
                <Text
                  style={[styles.btnGhostText, { color: colors.textSecondary }]}
                >
                  Discard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={() => onSave({ isBookmarked, keepAudio })}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={[styles.btnText, { color: "#000" }]}>
                    Save Prayer
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "90%",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 140,
    maxHeight: 260,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    marginRight: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
  },
  btnGhostText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  btnText: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  keepAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  keepAudioLeft: {
    flexDirection: "column",
    flex: 1,
    paddingRight: spacing.md,
  },
  keepAudioText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  keepAudioHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});