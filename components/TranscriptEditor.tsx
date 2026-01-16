// components/TranscriptEditor.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Image,
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
  onPressVerse?: () => void;
  onPressPhoto?: () => void;
  onPressCamera?: () => void;
  onPressScan?: () => void;
  verseLabel?: string | null;
  showScanHint?: boolean;
  photoUris?: string[];
  onRemovePhotoAt?: (index: number) => void;
  locationLabel?: string | null;
  onPressLocation?: () => void;
  onRemoveLocation?: () => void;
  verseEditorOpen?: boolean;
  verseDraftRef?: string;
  verseDraftVersion?: string;
  onChangeVerseRef?: (v: string) => void;
  onChangeVerseVersion?: (v: string) => void;
  onAttachVerse?: () => void;
  onRemoveVerse?: () => void;
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
  onPressVerse,
  onPressPhoto,
  onPressCamera,
  onPressScan,
  verseLabel,
  showScanHint,
  photoUris,
  onRemovePhotoAt,
  locationLabel,
  onPressLocation,
  onRemoveLocation,
  verseEditorOpen,
  verseDraftRef,
  verseDraftVersion,
  onChangeVerseRef,
  onChangeVerseVersion,
  onAttachVerse,
  onRemoveVerse,
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

            {(onPressVerse || onPressPhoto || onPressCamera || onPressScan || onPressLocation) && (
              <View style={styles.enrichBlock}>
                <View style={styles.enrichRow}>
                  <TouchableOpacity
                    style={[
                      styles.enrichChip,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPressCamera?.();
                    }}
                    disabled={loading || !onPressCamera}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.enrichChip,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPressPhoto?.();
                    }}
                    disabled={loading || !onPressPhoto}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="image-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.enrichChip,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPressScan?.();
                    }}
                    disabled={loading || !onPressScan}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="scan-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.enrichChip,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPressVerse?.();
                    }}
                    disabled={loading || !onPressVerse}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.enrichChip,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPressLocation?.();
                    }}
                    disabled={loading || !onPressLocation}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {verseLabel ? (
                  <View
                    style={[
                      styles.verseCard,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Ionicons name="bookmark-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.verseCardText, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {verseLabel}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onRemoveVerse?.();
                      }}
                      disabled={loading || !onRemoveVerse}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {verseEditorOpen ? (
                  <View
                    style={[
                      styles.verseEditorCard,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Text style={[styles.verseEditorTitle, { color: colors.textPrimary }]}>Add verse</Text>

                    <View style={styles.verseRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.verseEditorLabel, { color: colors.textSecondary }]}>Verse</Text>
                        <TextInput
                          value={verseDraftRef ?? ""}
                          onChangeText={(t) => onChangeVerseRef?.(t)}
                          placeholder="e.g. John 3:16"
                          placeholderTextColor={colors.textSecondary + "77"}
                          style={[
                            styles.verseEditorInput,
                            { color: colors.textPrimary, borderColor: colors.textSecondary + "33" },
                          ]}
                          editable={!loading}
                          autoCapitalize="words"
                          returnKeyType="next"
                        />
                      </View>

                      <View style={{ width: 96 }}>
                        <Text style={[styles.verseEditorLabel, { color: colors.textSecondary }]}>Trans (optional)</Text>
                        <TextInput
                          value={verseDraftVersion ?? ""}
                          onChangeText={(t) => onChangeVerseVersion?.(t)}
                          placeholder="NKJV"
                          placeholderTextColor={colors.textSecondary + "77"}
                          style={[
                            styles.verseEditorInput,
                            { color: colors.textPrimary, borderColor: colors.textSecondary + "33" },
                          ]}
                          editable={!loading}
                          autoCapitalize="characters"
                          maxLength={8}
                        />
                      </View>
                    </View>

                    <View style={styles.verseEditorButtons}>
                      <TouchableOpacity
                        style={[styles.verseEditorBtnGhost, { borderColor: colors.textSecondary + "33" }]}
                        onPress={() => onPressVerse?.()}
                        disabled={loading}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.verseEditorBtnGhostText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.verseEditorBtn, { backgroundColor: colors.accent }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onAttachVerse?.();
                        }}
                        disabled={loading}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.verseEditorBtnText, { color: "#000" }]}>Attach</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {locationLabel ? (
                  <View
                    style={[
                      styles.verseCard,
                      {
                        borderColor: colors.textSecondary + "33",
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.verseCardText, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {locationLabel}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onRemoveLocation?.();
                      }}
                      disabled={loading || !onRemoveLocation}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {showScanHint ? (
                  <Text style={[styles.scanHint, { color: colors.textSecondary }]}>
                    Scanned handwriting — please review for accuracy.
                  </Text>
                ) : null}
              </View>
            )}

            <View style={styles.inputBlock}>
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

              {Array.isArray(photoUris) && photoUris.length > 0 ? (
                <View style={styles.thumbRow}>
                  {photoUris.slice(0, 3).map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={styles.thumbWrapRow}>
                      <Image source={{ uri }} style={styles.thumbImgRow} />
                      <TouchableOpacity
                        style={[styles.thumbRemove, { backgroundColor: colors.card }]}
                        onPress={() => onRemovePhotoAt?.(idx)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        disabled={loading}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="close" size={14} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

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
    padding: spacing.sm,
    minHeight: 140,
    maxHeight: 260,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  inputBlock: {
    width: "100%",
  },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  thumbWrapRow: {
    width: 64,
    height: 64,
  },
  thumbImgRow: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbRemove: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#00000022",
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
  enrichBlock: {
    marginBottom: spacing.sm,
  },
  enrichLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: spacing.xs,
    opacity: 0.9,
  },
  enrichRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  enrichChip: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  verseCardText: {
    fontFamily: fonts.body,
    fontSize: 13,
    flex: 1,
  },
  verseEditorCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  verseEditorTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    opacity: 0.9,
  },
  verseRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  verseEditorLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    opacity: 0.9,
  },
  verseEditorInput: {
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  verseEditorButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  verseEditorBtnGhost: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  verseEditorBtnGhostText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  verseEditorBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  verseEditorBtnText: {
    fontFamily: fonts.heading,
    fontSize: 13,
  },
  scanHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
});