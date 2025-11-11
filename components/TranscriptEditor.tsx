// components/TranscriptEditor.tsx
import React from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
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
  transcript: string;
  onChangeText: (text: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

export default function TranscriptEditor({
  visible,
  transcript,
  onChangeText,
  onSave,
  onDiscard,
  loading,
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Review your prayer
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You can correct any words before saving.
            </Text>

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
              placeholder="Your prayer transcription will appear here..."
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
                onPress={onSave}
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
});