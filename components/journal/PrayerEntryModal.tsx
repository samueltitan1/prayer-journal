// components/journal/PrayerEntryModal.tsx
import { Ionicons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fonts, spacing } from "../../theme/theme";
import AudioPlayer from "./AudioPlayer";

export type Prayer = {
  id: string;
  prayed_at: string;
  transcript_text: string | null;
  duration_seconds: number | null;
  audio_path: string | null;
  signed_audio_url: string | null;
};

type Props = {
  visible: boolean;
  prayer: Prayer | null;
  onClose: () => void;
  onDelete: (prayer: Prayer) => Promise<void> | void;
};

const formatClockFromMs = (ms?: number | null) => {
  if (ms == null) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function PrayerEntryModal({
  visible,
  prayer,
  onClose,
  onDelete,
}: Props) {
  const { colors } = useTheme();

  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [useSpeaker, setUseSpeaker] = useState(true);

  // Reset whenever modal or prayer changes
  useEffect(() => {
    if (!visible) {
      cleanupSound();
      return;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setPositionMs(0);
    setDurationMs((prayer?.duration_seconds ?? 0) * 1000 || null);
  }, [visible, prayer?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSound();
    };
  }, []);

  const cleanupSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }
    } catch {
      // ignore
    } finally {
      soundRef.current = null;
      setIsPlaying(false);
      setPositionMs(0);
    }
  };

  const ensureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        // On iOS, enabling recording tends to prefer the earpiece route
        allowsRecordingIOS: !useSpeaker,
        // On Android, explicit earpiece vs speaker flag
        playsThroughEarpieceAndroid: !useSpeaker,
      });
    } catch {
      // best-effort, ignore failures
    }
  };

  const handlePlayPause = async () => {
    if (!prayer || !prayer.signed_audio_url) {
      Alert.alert("Unable to play", "No audio recording is available.");
      return;
    }

    // If already playing → stop
    if (isPlaying && soundRef.current) {
      await cleanupSound();
      return;
    }

    setIsLoading(true);
    try {
      await ensureAudioMode();

      // If we already have a sound, resume from current position
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        setIsLoading(false);
        return;
      }

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: prayer.signed_audio_url },
        { shouldPlay: true },
        (playbackStatus: AVPlaybackStatus) => {
          if (!playbackStatus.isLoaded) return;

          if (typeof playbackStatus.positionMillis === "number") {
            setPositionMs(playbackStatus.positionMillis);
          }
          if (typeof playbackStatus.durationMillis === "number") {
            setDurationMs(playbackStatus.durationMillis);
          }

          if (playbackStatus.didJustFinish) {
            setIsPlaying(false);
            setPositionMs(0);
            // leave sound loaded so we can replay quickly
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      if (status.isLoaded && status.durationMillis != null) {
        setDurationMs(status.durationMillis);
      }
    } catch (err) {
      console.warn("Audio playback error:", err);
      await cleanupSound();
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeaker = async () => {
    setUseSpeaker((prev) => !prev);
    // Next playback will use new route; if currently playing, re-apply mode
    await ensureAudioMode();
  };

  const handleDeletePress = () => {
    if (!prayer) return;

    Alert.alert(
      "Delete prayer?",
      "This will remove the recording and transcript for this entry.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await cleanupSound();
            await onDelete(prayer);
          },
        },
      ]
    );
  };

  if (!visible || !prayer) return null;

  const dt = new Date(prayer.prayed_at);
  const headerDate = dt.toLocaleDateString("en-GB", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const headerTime = dt.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  const progress =
    durationMs && durationMs > 0 ? positionMs / durationMs : 0;

  const currentLabel = formatClockFromMs(positionMs);
  const totalLabel = formatClockFromMs(
    durationMs ?? (prayer.duration_seconds ?? 0) * 1000
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-down"
              size={22}
              color={colors.textPrimary}
            />
          </TouchableOpacity>

          <Text style={[styles.topTitle, { color: colors.textPrimary }]}>
            Prayer Entry
          </Text>

          {/* Delete */}
          <TouchableOpacity
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Date/time heading */}
          <Text
            style={[styles.dateLabel, { color: colors.textSecondary }]}
          >
            {headerDate} • {headerTime}
          </Text>

          {/* Audio player */}
          <View style={{ marginTop: spacing.md }}>
            <AudioPlayer
              isPlaying={isPlaying}
              isLoading={isLoading}
              progress={progress}
              currentLabel={currentLabel}
              totalLabel={totalLabel}
              onPlayPause={handlePlayPause}
              useSpeaker={useSpeaker}
              onToggleSpeaker={handleToggleSpeaker}
              accentColor={colors.accent}
              textColor={colors.textSecondary}
            />
          </View>

          {/* Transcript */}
          {prayer.transcript_text && (
            <View
              style={[
                styles.transcriptCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.transcriptLabel,
                  { color: colors.textSecondary },
                ]}
              >
                TRANSCRIPT
              </Text>
              <Text
                style={[
                  styles.transcriptBody,
                  { color: colors.textPrimary },
                ]}
              >
                {prayer.transcript_text}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  dateLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  transcriptCard: {
    marginTop: spacing.lg,
    borderRadius: 16,
    padding: spacing.md,
  },
  transcriptLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  transcriptBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
});