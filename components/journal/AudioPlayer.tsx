// components/journal/AudioPlayer.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fonts, spacing } from "../../theme/theme";

type Props = {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number; // 0–1
  currentLabel: string;
  totalLabel: string;
  onPlayPause: () => void;
  useSpeaker: boolean;
  onToggleSpeaker: () => void;
  accentColor: string;
  textColor: string;
};

export default function AudioPlayer({
  isPlaying,
  isLoading,
  progress,
  currentLabel,
  totalLabel,
  onPlayPause,
  useSpeaker,
  onToggleSpeaker,
  accentColor,
  textColor,
}: Props) {
  const clampedProgress = Math.min(1, Math.max(0, progress || 0));

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        {/* Play / pause button */}
        <TouchableOpacity style={styles.playButton} onPress={onPlayPause}>
          {isLoading ? (
            <ActivityIndicator color={accentColor} />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={22}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        {/* Progress bar + labels */}
        <View style={styles.progressArea}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${clampedProgress * 100}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: textColor }]}>{currentLabel}</Text>
            <Text style={[styles.timeLabel, { color: textColor }]}>{totalLabel}</Text>
          </View>
        </View>

        {/* Speaker / earpiece toggle */}
        <TouchableOpacity style={styles.speakerButton} onPress={onToggleSpeaker}>
          <Ionicons
            name={useSpeaker ? "volume-high-outline" : "headset-outline"}
            size={20}
            color={accentColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  progressArea: { flex: 1 },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  speakerButton: {
    marginLeft: spacing.sm,
  },
});