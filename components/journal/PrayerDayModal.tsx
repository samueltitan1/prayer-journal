// components/journal/PrayerDayModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";

export type Prayer = {
  id: string;
  user_id: string;
  prayed_at: string;
  transcript_text: string | null;
  duration_seconds: number | null;
  audio_path: string | null;
  signed_audio_url: string | null;
};

type Props = {
  visible: boolean;
  dateKey: string | null;
  prayers: Prayer[];
  onClose: () => void;
  onDeletePrayer: (p: Prayer) => void;

  // Playback (shared with JournalScreen)
  onPlayPause: (p: Prayer) => void;
  playingId: string | null;
  loadingAudioId: string | null;
  playbackPosition: number;
  playbackDuration: number | null;

  // Transcript expansion (shared state)
  expandedPrayerId: string | null;
  onToggleTranscript: (id: string) => void;

  // Speaker routing
  useSpeaker: boolean;
  onToggleSpeaker: () => void;
};

const PrayerDayModal: React.FC<Props> = ({
  visible,
  dateKey,
  prayers,
  onClose,
  onDeletePrayer,
  onPlayPause,
  playingId,
  loadingAudioId,
  playbackPosition,
  playbackDuration,
  expandedPrayerId,
  onToggleTranscript,
  useSpeaker,
  onToggleSpeaker,
}) => {
  const { colors } = useTheme();

  if (!visible || !dateKey) return null;

  const dateLabel = new Date(dateKey).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const formatDuration = (s: number | null) =>
    !s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const formatMsToClock = (ms?: number | null) => {
    if (ms == null) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                Prayer Entry
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {dateLabel}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-outline"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {prayers.length === 0 ? (
            <View style={styles.emptyWrapper}>
              <Ionicons
                name="mic-outline"
                size={20}
                color={colors.accent}
                style={{ marginBottom: spacing.xs }}
              />
              <Text
                style={[styles.emptyText, { color: colors.textSecondary }]}
              >
                No prayers recorded on this day.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {prayers.map((p) => {
                const isPlaying = playingId === p.id;
                const isExpanded = expandedPrayerId === p.id;
                const progress =
                  isPlaying && playbackDuration
                    ? playbackPosition / playbackDuration
                    : 0;

                const timeLabel = new Date(p.prayed_at).toLocaleTimeString(
                  "en-GB",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.prayerCard,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    {/* Header row: time + duration + delete */}
                    <View style={styles.prayerHeaderRow}>
                      <Text
                        style={[
                          styles.prayerTime,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {timeLabel} • {formatDuration(p.duration_seconds)}
                      </Text>

                      <TouchableOpacity
                        onPress={() => onDeletePrayer(p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Audio row: play + speaker toggle */}
                    <View style={styles.audioRow}>
                      {/* Play button */}
                      <TouchableOpacity
                        onPress={() => onPlayPause(p)}
                        style={styles.playButton}
                      >
                        {loadingAudioId === p.id ? (
                          <ActivityIndicator color={colors.accent} />
                        ) : (
                          <Ionicons
                            name={
                              isPlaying ? "pause-circle" : "play-circle"
                            }
                            size={36}
                            color={colors.accent}
                          />
                        )}
                      </TouchableOpacity>

                      {/* Progress + times */}
                      {p.signed_audio_url && (
                        <View style={{ flex: 1 }}>
                          <View
                            style={[
                              styles.playbackTrack,
                              {
                                backgroundColor:
                                  colors.textSecondary + "22",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.playbackFill,
                                {
                                  backgroundColor: colors.accent,
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, progress * 100)
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.playbackTimesRow}>
                            <Text
                              style={[
                                styles.playbackTimeLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {isPlaying
                                ? formatMsToClock(playbackPosition)
                                : "0:00"}
                            </Text>
                            <Text
                              style={[
                                styles.playbackTimeLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {formatMsToClock(
                                playbackDuration ??
                                  (p.duration_seconds ?? 0) * 1000
                              )}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Speaker toggle */}
                      <TouchableOpacity
                        onPress={onToggleSpeaker}
                        style={styles.speakerToggle}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={
                            useSpeaker
                              ? "volume-high-outline"
                              : "headset-outline"
                          }
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Transcript */}
                    {p.transcript_text && (
                      <View style={{ marginTop: spacing.sm }}>
                        <Text
                          style={[
                            styles.prayerText,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={isExpanded ? undefined : 3}
                        >
                          {p.transcript_text}
                        </Text>

                        <TouchableOpacity
                          onPress={() => onToggleTranscript(p.id)}
                          style={styles.transcriptToggleRow}
                        >
                          <Text
                            style={[
                              styles.transcriptToggleText,
                              { color: colors.accent },
                            ]}
                          >
                            {isExpanded ? "Hide transcript" : "Show full"}
                          </Text>
                          <Ionicons
                            name={
                              isExpanded
                                ? "chevron-up-outline"
                                : "chevron-down-outline"
                            }
                            size={16}
                            color={colors.accent}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  scroll: {
    marginTop: spacing.sm,
  },
  emptyWrapper: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
  },
  prayerCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  prayerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  prayerTime: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  playButton: {
    marginRight: spacing.md,
  },
  playbackTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  playbackFill: {
    height: "100%",
    borderRadius: 999,
  },
  playbackTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  playbackTimeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  speakerToggle: {
    marginLeft: spacing.sm,
  },
  prayerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  transcriptToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  transcriptToggleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginRight: 4,
  },
});

export default PrayerDayModal;