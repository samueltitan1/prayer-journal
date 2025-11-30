// components/journal/PrayerEntryModal.tsx

import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { Prayer } from "@/types/Prayer";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ---- Types: minimal shape of a prayer used by this modal ----


type Props = {
  visible: boolean;
  prayer: Prayer | null;
  onClose: () => void;

  // playback state (re-used from JournalScreen)
  isPlaying: boolean;
  isLoadingAudio: boolean;
  playbackPositionMs: number;
  playbackDurationMs: number | null;

  // actions
  onPlayPause: (p: Prayer) => void;
  onToggleBookmark: (id: string) => void;
  onDeletePrayer: (p: Prayer) => void;
  onToggleTranscript: (id: string) => void;
};

// ---- Helpers ----------------------------------------------------------

const formatHeaderDateTime = (prayed_at: string) => {
  const d = new Date(prayed_at);
  const date = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} – ${time}`;
};

const formatMsToClock = (ms?: number | null) => {
  if (ms == null) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

// ---- Component --------------------------------------------------------

const PrayerEntryModal: React.FC<Props> = ({
  visible,
  prayer,
  onClose,
  isPlaying,
  isLoadingAudio,
  playbackPositionMs,
  playbackDurationMs,
  onPlayPause,
  onToggleBookmark,
  onDeletePrayer,
}) => {
  const { colors } = useTheme();
  console.log(
    "PrayerEntryModal render",
    "visible:", visible,
    "hasPrayer:", !!prayer,
    "prayerId:", prayer?.id
  );

  if (!prayer) return null;

  const totalMs =
    playbackDurationMs ?? (prayer.duration_seconds ?? 0) * 1000;

  const progress =
    totalMs > 0 ? Math.min(1, Math.max(0, playbackPositionMs / totalMs)) : 0;

  const metaLabel = formatHeaderDateTime(prayer.prayed_at);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* ===== Backdrop ===== */}
      <View style={styles.backdrop}>
        {/* ===== Card container ===== */}
        <SafeAreaView
          style={[
            styles.cardContainer,
            { backgroundColor: colors.background },
          ]}
        >
          {/* ===== Header: title + date/time + actions ===== */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: colors.textSecondary + "20" },
            ]}
          >
            <View>
              <Text
                style={[styles.headerTitle, { color: colors.textPrimary }]}
              >
                Prayer Entry
              </Text>
              <Text
                style={[styles.headerMeta, { color: colors.textSecondary }]}
              >
                {metaLabel}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {/* Bookmark */}
              {onToggleBookmark && (
                <TouchableOpacity
                  onPress={() => onToggleBookmark(prayer.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 12 }}
                >
                  <Ionicons
                    name={
                      prayer.is_bookmarked ? "heart" : "heart-outline"
                    }
                    size={22}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              )}

              {/* Delete */}
              {onDeletePrayer && (
                <TouchableOpacity
                  onPress={() => onDeletePrayer(prayer)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 12 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}

              {/* Close */}
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Body ===== */}
          <View style={styles.body}>
            {/* --- Audio block (big play button + progress) --- */}
            <View
              style={[
                styles.audioCard,
                { backgroundColor: colors.card },
              ]}
            >
              {/* Play button */}
              <TouchableOpacity
                style={[
                  styles.bigPlayButton,
                  { backgroundColor: colors.accent + "30" },
                ]}
                onPress={() => onPlayPause(prayer)}
                disabled={isLoadingAudio}
              >
                {isLoadingAudio ? (
                  <Ionicons
                    name="ellipse-outline"
                    size={32}
                    color={colors.accent}
                  />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={32}
                    color={colors.accent}
                  />
                )}
              </TouchableOpacity>

              {/* Progress + times */}
              <View style={styles.audioRight}>
                {/* Progress bar */}
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.textSecondary + "22" },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.accent,
                        width: `${progress * 100}%`,
                      },
                    ]}
                  />
                </View>

                {/* Times */}
                <View style={styles.timesRow}>
                  <Text
                    style={[
                      styles.timeLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isPlaying
                      ? formatMsToClock(playbackPositionMs)
                      : "0:00"}
                  </Text>
                  <Text
                    style={[
                      styles.timeLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatMsToClock(totalMs)}
                  </Text>
                </View>
              </View>
            </View>

            {/* --- Transcript label --- */}
            {!!prayer.transcript_text && (
              <>
                <Text
                  style={[
                    styles.transcriptLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  TRANSCRIPT
                </Text>

                {/* Full transcript */}
                <Text
                  style={[
                    styles.transcriptBody,
                    { color: colors.textPrimary },
                  ]}
                >
                  {prayer.transcript_text}
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Backdrop behind the card
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  // Main white card
  cardContainer: {
    borderRadius: 24,
    overflow: "hidden",
  },

  // Header row
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  headerMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Body area
  body: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  // Audio card section
  audioCard: {
    borderRadius: 20,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  bigPlayButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  audioRight: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  timesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // Transcript
  transcriptLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  transcriptBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
  },
});

export default PrayerEntryModal;