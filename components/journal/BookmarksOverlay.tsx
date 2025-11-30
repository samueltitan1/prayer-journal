// components/BookmarksOverlay.tsx

import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabaseClient";
import { fonts, spacing } from "@/theme/theme";
import { Prayer } from "@/types/Prayer";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";


type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string | null;

  // NEW: when user taps a bookmarked prayer row
  onSelectPrayer?: (p: Prayer) => void;
};

// Format date + time + duration in one clean line
const formatPrayerMeta = (p: Prayer) => {
    const d = new Date(p.prayed_at);
  
    const date = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  
    const duration =
      p.duration_seconds != null
        ? `${Math.floor(p.duration_seconds / 60)}:${String(
            p.duration_seconds % 60
          ).padStart(2, "0")}`
        : "";
  
    return `${date} • ${time}${duration ? ` • ${duration}` : ""}`;
  };
// ---- Helper ----------------------------------------------------------

const formatDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  
  const formatDuration = (s: number | null) =>
    !s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  
  const formatMsToClock = (ms?: number | null) => {
    if (ms == null) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

// ---- Highlight matching parts of transcript ----
const highlightMatches = (
    text: string,
    query: string,
    accentColor: string
  ) => {
    if (!query.trim()) return <Text>{text}</Text>;
  
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
  
    const parts: React.ReactNode[] = [];
    let start = 0;
  
    while (true) {
      const idx = lowerText.indexOf(lowerQuery, start);
      if (idx === -1) {
        // no more matches → push remaining text
        parts.push(text.slice(start));
        break;
      }
  
      // push text before match
      if (idx > start) {
        parts.push(text.slice(start, idx));
      }
  
      // push highlighted match
      parts.push(
        <Text
          key={idx}
          style={{
            backgroundColor: accentColor + "40",
            borderRadius: 4,
            paddingHorizontal: 2,
          }}
        >
          {text.slice(idx, idx + query.length)}
        </Text>
      );
  
      // move pointer
      start = idx + query.length;
    }
  
    return <Text>{parts}</Text>;
  };

export default function BookmarksModal({ visible, onClose, userId, onSelectPrayer }: Props) {
  const { colors } = useTheme();

  // ---- State ----
  const [bookmarkedPrayers, setBookmarkedPrayers] = useState<Prayer[]>([]);
  const [bookmarked, setBookmarked] = useState<Prayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Prayer[]>([]);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [playbackPosition, setPlaybackPosition] = useState(0); // ms
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null); // ms

  const [expandedPrayerId, setExpandedPrayerId] = useState<string | null>(null);

  const [playThroughSpeaker, setPlayThroughSpeaker] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  // locally mark items that have been unbookmarked this session
  const [locallyUnbookmarkedIds, setLocallyUnbookmarkedIds] = useState<
    string[]
  >([]);

  const soundRef = useRef<Audio.Sound | null>(null);

  // ---- Fetch bookmarked prayers when modal opens ----
  useEffect(() => {
    if (!visible || !userId) return;

    const fetchBookmarks = async () => {
      setLocallyUnbookmarkedIds([]); // reset session state when opening

      const { data, error } = await supabase
        .from("bookmarked_prayers")
        .select(`
          id,
          prayer_id,
          prayers (
            id,
            prayed_at,
            transcript_text,
            duration_seconds,
            audio_path
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Bookmark fetch error:", error.message);
        setBookmarked([]);
        setBookmarkedPrayers([]);
        return;
      }

      const prayersRaw = (data || []).map((row: any) => row.prayers);
      const withUrls: Prayer[] = [];

      for (const p of prayersRaw) {
        if (!p.audio_path) {
          withUrls.push({ ...p, signed_audio_url: null });
          continue;
        }

        const { data: signed } = await supabase.storage
          .from("prayer-audio")
          .createSignedUrl(p.audio_path, 60 * 60 * 24 * 365); // 1 year

        withUrls.push({
          ...p,
          signed_audio_url: signed?.signedUrl ?? null,
        });
      }

      setBookmarked(withUrls);
      setBookmarkedPrayers(withUrls);
    };

    fetchBookmarks();
  }, [visible, userId]);
// ---- Fetch ALL prayers when searching (full search mode) ----
useEffect(() => {
    if (!visible || !userId) return;
    if (!searchQuery.trim()) {
      setSearchResults([]); // reset
      return;
    }
  
    let active = true;
  
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("prayers")
        .select("*")
        .eq("user_id", userId)
        .order("prayed_at", { ascending: false });
  
      if (error) {
        console.warn("Full search fetch error:", error.message);
        return;
      }
  
      const withUrls: Prayer[] = [];
  
      for (const p of data || []) {
        if (!p.audio_path) {
          withUrls.push({ ...p, signed_audio_url: null });
          continue;
        }
  
        const { data: signed } = await supabase.storage
          .from("prayer-audio")
          .createSignedUrl(p.audio_path, 60 * 60 * 24 * 365);
  
        withUrls.push({
          ...p,
          signed_audio_url: signed?.signedUrl ?? null,
        });
      }
  
      if (active) setSearchResults(withUrls);
    };
  
    fetchAll();
    return () => {
      active = false;
    };
  }, [visible, userId, searchQuery]);

  // ---- Audio playback -------------------------------------------------

  const configureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: !playThroughSpeaker,
      });
    } catch (e) {
      console.warn("Audio mode config error:", e);
    }
  };

  const handlePlayPause = async (p: Prayer) => {
    try {
      // If this prayer is currently playing: stop + reset
      if (playingId === p.id && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
        setPlaybackPosition(0);
        setPlaybackDuration(null);
        return;
      }

      // Stop any other prayer
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {
          // ignore
        }
        soundRef.current = null;
      }

      if (!p.signed_audio_url) {
        console.warn("No signed_audio_url for prayer", p.id);
        return;
      }

      setLoadingAudioId(p.id);
      await configureAudioMode();

      const { sound, status } = await Audio.Sound.createAsync({
        uri: p.signed_audio_url,
      });

      soundRef.current = sound;
      setPlayingId(p.id);

      if (status.isLoaded && status.durationMillis != null) {
        setPlaybackDuration(status.durationMillis);
      } else {
        setPlaybackDuration(null);
      }

      sound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) return;

        if (playbackStatus.positionMillis != null) {
          setPlaybackPosition(playbackStatus.positionMillis);
        }
        if (playbackStatus.durationMillis != null) {
          setPlaybackDuration(playbackStatus.durationMillis);
        }

        if (playbackStatus.didJustFinish) {
          setPlayingId(null);
          setPlaybackPosition(0);
        }
      });

      setLoadingAudioId(null);
      await sound.playAsync();
    } catch (err) {
      console.warn("Audio playback error:", err);
      setLoadingAudioId(null);
      setPlayingId(null);
    }
  };

  useEffect(
    () => () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    },
    []
  );

  const toggleTranscript = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPrayerId((prev) => (prev === id ? null : id));
  };

  // ---- Unbookmark from inside modal (heart → outline, card stays) ----

  const handleToggleBookmark = async (prayerId: string) => {
    const alreadyUnbookmarked = locallyUnbookmarkedIds.includes(prayerId);

    // For now, we only support "remove bookmark" in this modal.
    if (!alreadyUnbookmarked) {
      // Optimistically flip icon
      setLocallyUnbookmarkedIds((prev) => [...prev, prayerId]);

      try {
        const { error } = await supabase
          .from("bookmarked_prayers")
          .delete()
          .eq("user_id", userId)
          .eq("prayer_id", prayerId);

        if (error) {
          console.warn("Failed to remove bookmark:", error.message);
          // revert icon if DB fails
          setLocallyUnbookmarkedIds((prev) =>
            prev.filter((id) => id !== prayerId)
          );
        }
      } catch (err) {
        console.warn("Unbookmark error:", err);
        setLocallyUnbookmarkedIds((prev) =>
          prev.filter((id) => id !== prayerId)
        );
      }
    } else {
      // Optional: in future you could allow re-bookmarking from here
      // For now, do nothing.
      return;
    }
  };

// ---- Search filter (works across entire journal) ----
const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
  
    // Normal mode → show ONLY bookmarks
    if (!q) return bookmarked;
  
    // Search mode → filter ALL prayers
    return searchResults.filter((p) => {
      const fields = [
        p.transcript_text || "",
        new Date(p.prayed_at).toLocaleDateString("en-GB"),
        new Date(p.prayed_at).toLocaleTimeString("en-GB"),
        String(p.duration_seconds || ""),
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [searchQuery, bookmarked, searchResults]);

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
if (!visible) return null;
  return (

      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.textSecondary + "20" },
          ]}
        >
          <TouchableOpacity onPress={onClose}>
            <Ionicons
              name="chevron-down-outline"
              size={28}
              color={colors.textPrimary}
            />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Bookmarked Prayers
          </Text>

          <View style={{ width: 28 }} />{/* Spacer */}
        </View>

        {/* Search bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              placeholder="Search all prayers by keywords..."
              placeholderTextColor={colors.textSecondary + "80"}
              style={{
                flex: 1,
                fontFamily: fonts.body,
                color: colors.textPrimary,
              }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, marginTop: spacing.md }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >

          {/* EMPTY STATE: No bookmarks */}
          {!loading &&
            filtered.length === 0 &&
            searchQuery.trim().length === 0 && (
              <View
                style={{ padding: 20, alignItems: "center", opacity: 0.6 }}
              >
                <Ionicons
                  name="heart-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text
                  style={{
                    marginRight: 12,
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  You haven't saved any prayers yet.
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  Tap the heart on any prayer to bookmark it.
                </Text>
              </View>
            )}

          {/* EMPTY STATE: Search yielded nothing */}
          {!loading &&
            filtered.length === 0 &&
            searchQuery.trim().length > 0 && (
              <View
                style={{ padding: 20, alignItems: "center", opacity: 0.6 }}
              >
                <Ionicons
                  name="search-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  No prayers found.
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  Try different keywords.
                </Text>
              </View>
            )}

          {/* LIST OF BOOKMARKED PRAYERS */}
          {filtered.map((p) => {
            const dateObj = new Date(p.prayed_at);

            const dateLabel = dateObj.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
            });

            const timeLabel = dateObj.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
            });

            const isPlaying = playingId === p.id;
            const isUnbookmarked = locallyUnbookmarkedIds.includes(p.id);
            const isExpanded = expandedPrayerId === p.id;
            const progress =
                            isPlaying && playbackDuration
                                ? playbackPosition / playbackDuration
                                : 0;

            return (
                <View
                key={p.id}
                style={[ styles.prayerCard, { backgroundColor: colors.card },]}
                >

{/* ---- CONTENT AREA (TAPPABLE) ---- */}
<TouchableOpacity
  style={{ flex: 1, paddingRight: spacing.sm }}
  activeOpacity={0.8}
  onPress={() => {
    if (onSelectPrayer) {
      onSelectPrayer({
        ...p,
        is_bookmarked: !locallyUnbookmarkedIds.includes(p.id),
      });
    }
  }}
>
  {/* bookmark icon */}
  <View>
    <TouchableOpacity
      onPress={() => handleToggleBookmark(p.id)}
      style={{ marginRight: spacing.sm }}
    >
      <Ionicons
        name={
          locallyUnbookmarkedIds.includes(p.id)
            ? "heart-outline"
            : "heart"
        }
        size={20}
        color={colors.accent}
      />
    </TouchableOpacity>
  </View>

  {/* Transcript preview */}
  {p.transcript_text && (
    <View style={{ marginTop: spacing.sm }}>
      <Text
        style={[styles.prayerText, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {p.transcript_text}
      </Text>

      <Text
        style={[
          styles.prayerMeta,
          { color: colors.textSecondary },
        ]}
      >
        {dateLabel} • {timeLabel} • {formatDuration(p.duration_seconds)}
      </Text>
    </View>
  )}
</TouchableOpacity>
                </View>
            );
            })}
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,

  },
  prayerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  playButton: { marginRight: spacing.md, marginTop: 2 },
  prayerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  prayerTime: { fontFamily: fonts.heading, fontSize: 14 },
  playbackMeta: {
    marginBottom: spacing.xs,
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
  prayerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
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
  progress: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  prayerMeta: { fontFamily: fonts.body, fontSize: 11, lineHeight: 18 },

  bookmarkIcon: {
    fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginRight: spacing.sm,
  },
});