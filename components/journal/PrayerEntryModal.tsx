import { useTheme } from "@/contexts/ThemeContext";
import { getSupabase } from "@/lib/supabaseClient";
import { fonts, spacing } from "@/theme/theme";
import { Prayer } from "@/types/Prayer";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  onSeek: (prayer: Prayer, positionMs: number) => void;
  onSeekCompleteCooldown: () => void;
};

// ---- Helpers ----------------------------------------------------------

const formatHeaderDateTime = (prayed_at: string) => {
  const d = new Date(prayed_at);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
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
  onToggleTranscript,
  onSeek,
  onSeekCompleteCooldown,
}) => {
  const { colors } = useTheme();
  const [loadedDurationMs, setLoadedDurationMs] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressTrackWidth = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const dragPositionRef = useRef<number | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  // ---- Attachment + image viewer state ----
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  // Load photo attachments (signed URLs) when modal opens
  useEffect(() => {
    let cancelled = false;

    const loadAttachments = async () => {
      if (!visible) {
        setAttachmentUrls([]);
        return;
      }
      if (!prayer?.id) {
        setAttachmentUrls([]);
        return;
      }

      try {
        const { data: rows, error } = await getSupabase()
          .from("prayer_attachments")
          .select("storage_path")
          .eq("prayer_id", prayer.id)
          .order("created_at", { ascending: true });

        if (error || !rows) {
          if (!cancelled) setAttachmentUrls([]);
          return;
        }

        const urls: string[] = [];
        for (const r of rows as any[]) {
          const p = r?.storage_path;
          if (!p) continue;
          const { data } = await getSupabase()
            .storage
            .from("prayer-attachments")
            .createSignedUrl(p, 60 * 10);

          if (data?.signedUrl) urls.push(data.signedUrl);
        }

        if (!cancelled) setAttachmentUrls(urls);
      } catch {
        if (!cancelled) setAttachmentUrls([]);
      }
    };

    loadAttachments();

    return () => {
      cancelled = true;
    };
  }, [visible, prayer?.id]);
  // --- Audio reset/unload helpers ---
  const resetAudioUiState = () => {
    setLoadedDurationMs(null);
    setPlaybackUrl(null);
    setIsDragging(false);
    setDragPosition(null);
    dragPositionRef.current = null;
  };

  const unloadCurrentSound = async () => {
    const s = soundRef.current;
    if (!s) return;

    try {
      await s.stopAsync();
    } catch {}

    try {
      await s.unloadAsync();
    } catch {}

    soundRef.current = null;
  };
  console.log(
    "PrayerEntryModal render",
    "visible:", visible,
    "hasPrayer:", !!prayer,
    "prayerId:", prayer?.id
  );
  // If the modal closes OR a different prayer opens, stop/unload any prior audio
  // and reset UI so we never show/play the previous prayer's audio.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Always unload + reset when closing
      if (!visible) {
        await unloadCurrentSound();
        if (!cancelled) resetAudioUiState();
        return;
      }

      // When switching to a new prayer while open:
      await unloadCurrentSound();
      if (!cancelled) resetAudioUiState();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [visible, prayer?.id]);

useEffect(() => {
  let cancelled = false;

  const loadAudio = async () => {
    // Written-prayer mode: nothing to load/play.
    if (!visible) return;
    if (!prayer?.audio_path) return;

    try {
      let url = prayer.signed_audio_url;

      if (!url) {
        const { data, error } = await getSupabase()
          .storage
          .from("prayer-audio")
          .createSignedUrl(prayer.audio_path, 60 * 60);

        if (error || !data?.signedUrl) {
          console.warn("No signed_audio_url for prayer", prayer.id);
          return;
        }

        url = data.signedUrl;
      }

      if (cancelled) return;

      setPlaybackUrl(url);

      // Create a fresh sound instance for this prayer.
      const result = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false }
      );

      if (cancelled) {
        try {
          await result.sound.unloadAsync();
        } catch {}
        return;
      }

      soundRef.current = result.sound;

      if (result.status.isLoaded && result.status.durationMillis) {
        setLoadedDurationMs(result.status.durationMillis);
      }
    } catch (e) {
      console.log("audio preload error", e);
    }
  };

  loadAudio();

  return () => {
    cancelled = true;
    // Important: do NOT unload here; unloading is centralized in the reset effect above.
    // This avoids an old effect unloading a newly-created sound during fast prayer switching.
  };
}, [visible, prayer?.id, prayer?.audio_path]);

  const totalMs =
    loadedDurationMs ??
    playbackDurationMs ??
    (prayer?.duration_seconds ?? 0) * 1000;

  const effectivePositionMs =
    isDragging && dragPosition != null ? dragPosition : playbackPositionMs;

  const progress =
    totalMs > 0
      ? Math.min(1, Math.max(0, effectivePositionMs / totalMs))
      : 0;

  const metaLabel = prayer ? formatHeaderDateTime(prayer.prayed_at) : "";

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (!progressTrackWidth.current || !totalMs) return;
          setIsDragging(true);
          const { locationX } = evt.nativeEvent;
          const clampedX = Math.max(
            0,
            Math.min(progressTrackWidth.current, locationX)
          );
          const ratio = clampedX / progressTrackWidth.current;
          const newMs = totalMs * ratio;
          setDragPosition(newMs);
          dragPositionRef.current = newMs;
        },
        onPanResponderMove: (evt) => {
          if (!progressTrackWidth.current || !totalMs) return;
          const { locationX } = evt.nativeEvent;
          const clampedX = Math.max(
            0,
            Math.min(progressTrackWidth.current, locationX)
          );
          const ratio = clampedX / progressTrackWidth.current;
          const newMs = totalMs * ratio;
          setDragPosition(newMs);
          dragPositionRef.current = newMs;
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
          const finalMs = dragPositionRef.current;
          if (finalMs != null && prayer) {
            onSeek(prayer, finalMs);
            Haptics.selectionAsync();
            onSeekCompleteCooldown();
          }
          setDragPosition(null);
          dragPositionRef.current = null;
        },
      }),
      [totalMs, prayer, onSeek, onSeekCompleteCooldown]
  );

  if (!prayer) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* ===== Backdrop + card ===== */}
      <View style={styles.backdrop}>
        {/* Tap outside card to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        {/* Card */}
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
              <TouchableOpacity
                onPress={() => onToggleBookmark(prayer.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={prayer.is_bookmarked ? "heart" : "heart-outline"}
                  size={22}
                  color={colors.accent}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Body ===== */}
          <View style={styles.body}>
            <View>
              {/* --- Audio block (only if this entry has audio) --- */}
              {!!prayer.audio_path && (
                <View
                  key={prayer.id}
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
                  onPress={() => {
                    const url = playbackUrl ?? prayer.signed_audio_url ?? null;
                    if (!url) {
                      console.warn("No signed_audio_url for prayer", prayer.id);
                      return;
                    }
                    onPlayPause({
                      ...prayer,
                      signed_audio_url: url,
                    });
                  }}
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
                    {...panResponder.panHandlers}
                    onLayout={(e) => {
                      progressTrackWidth.current = e.nativeEvent.layout.width;
                    }}
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
                    {/* Small scrub handle (Spotify-style) */}
                    <View
                      style={[
                        styles.scrubHitbox,
                        {
                          left:
                            progressTrackWidth.current > 0
                              ? progressTrackWidth.current * progress - 16
                              : 0,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.scrubHandle,
                          {
                            backgroundColor: colors.accent,
                            shadowColor: "#000",
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            shadowOffset: { width: 0, height: 2 },
                            transform: [{ scale: isDragging ? 1.1 : 1 }],
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Times */}
                  <View style={styles.timesRow}>
                    <Text
                      style={[
                        styles.timeLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatMsToClock(effectivePositionMs)}
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
            )}
              {/* --- Transcript label --- */}
              {!!prayer.transcript_text && (
                <>
                  <View style={{ height: 8 }} />
                  {/* Full transcript */}
                  <ScrollView
                    style={{ maxHeight: 250 }}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[styles.transcriptBody, { color: colors.textPrimary }]}> 
                      {prayer.transcript_text}
                      {prayer.bible_reference ? "\n" : ""}
                      {prayer.bible_reference ? (
                        <Text style={[styles.verseMeta, { color: colors.textSecondary }]}>
                          {` - ${prayer.bible_reference}${prayer.bible_version ? ` (${prayer.bible_version})` : ""}`}
                        </Text>
                      ) : null}
                    </Text>
                  </ScrollView>
                  {attachmentUrls.length > 0 && (
                    <View style={{ marginTop: spacing.md }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: spacing.sm }}
                      >
                        {attachmentUrls.map((url) => (
                          <TouchableOpacity
                            key={url}
                            onPress={() => {
                              setActiveImageUrl(url);
                              setImageViewerOpen(true);
                            }}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: url }}
                              style={{ width: 64, height: 64, borderRadius: 10 }}
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
            

            <View style={[styles.footerRow, { marginTop: spacing.lg }]}> 
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                {!!prayer.location_name && (
                  <Text
                    numberOfLines={1}
                    style={[styles.footerMeta, { color: colors.textSecondary + "60" }]}
                  >
                    {prayer.location_name}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {imageViewerOpen && activeImageUrl && (
            <Modal
              visible={imageViewerOpen}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setImageViewerOpen(false);
                setActiveImageUrl(null);
              }}
            >
              <TouchableWithoutFeedback
                onPress={() => {
                  setImageViewerOpen(false);
                  setActiveImageUrl(null);
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.9)",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: spacing.lg,
                  }}
                >
                  <Image
                    source={{ uri: activeImageUrl }}
                    style={{ width: "100%", height: "80%", resizeMode: "contain" }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}

          {showDeleteConfirm && (
            <View style={styles.confirmOverlay}>
              <View style={[styles.confirmBox, { backgroundColor: colors.card }]}>
                <Text style={[styles.confirmText, { color: colors.textPrimary }]}>
                  Are you sure you want to delete this prayer entry?
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity onPress={() => setShowDeleteConfirm(false)}>
                    <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowDeleteConfirm(false); onDeletePrayer(prayer); }}>
                    <Text style={[styles.deleteBtn, { color: colors.accent }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
    maxHeight: "85%",
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
    height: 8, // increased for better touch target
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: spacing.xs,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  scrubHandle: {
    position: "absolute",
    top: -3, // centers the 14px circle on the 8px track
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  scrubHitbox: {
    position: "absolute",
    top: -12,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
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
  transcriptBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
  },
  verseMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontStyle: "italic",
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
  },

  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBox: {
    padding: spacing.lg,
    borderRadius: 16,
    width: "80%",
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  confirmButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.lg,
  },
  cancelBtn: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  deleteBtn: {
    fontFamily: fonts.heading,
    fontSize: 15,
  },
});

export default PrayerEntryModal;