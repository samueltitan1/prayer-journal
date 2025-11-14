// app/(tabs)/journal/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

import ReminderBanner from "@/components/ReminderBanner";
import { useAuth } from "@/contexts/AuthProvider";
import SettingsModal from "../../../components/SettingsModal";
import { useTheme } from "../../../contexts/ThemeContext";
import { supabase } from "../../../lib/supabaseClient";
import { fonts, spacing } from "../../../theme/theme";

type Prayer = {
  id: string;
  user_id: string;
  prayed_at: string;
  transcript_text: string | null;
  duration_seconds: number | null;
  audio_path: string | null;
  signed_audio_url: string | null;
};

type Reflection = {
  id: string;
  type: "weekly" | "monthly";
  title: string;
  subtitle: string | null;
  body: string;
  verse_text: string | null;
  verse_reference: string | null;
  created_at: string;
};

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function JournalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loadingPrayers, setLoadingPrayers] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [weeklyReflection, setWeeklyReflection] = useState<Reflection | null>(
    null
  );
  const [monthlyReflection, setMonthlyReflection] = useState<Reflection | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0); // ms
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null); // ms

  // Transcript expand / collapse
  const [expandedPrayerId, setExpandedPrayerId] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const userId = user?.id ?? null;

  // --- Helpers --------------------------------------------------------
  const formatDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(currentMonth);
  }, [currentMonth]);

  const goMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const m = new Date(prev);
      m.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return m;
    });
  };

 // --- Fetch prayers for the visible month (with 1-year signed URLs) ---
useEffect(() => {
  if (!userId) return;

  const fetchPrayers = async () => {
    setLoadingPrayers(true);

    try {
      const start = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      );
      const end = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // 1️⃣ Fetch raw prayers
      const { data: rows, error } = await supabase
        .from("prayers")
        .select("*")
        .eq("user_id", userId)
        .gte("prayed_at", start.toISOString())
        .lte("prayed_at", end.toISOString())
        .order("prayed_at", { ascending: false });

      if (error) {
        console.warn("Failed to load prayers:", error.message);
        setPrayers([]);
        setLoadingPrayers(false);
        return;
      }

      const prayersWithUrls: Prayer[] = [];

      // 2️⃣ Generate signed URLs for each prayer
      for (const p of rows || []) {
        if (!p.audio_path) {
          prayersWithUrls.push({
            ...p,
            signed_audio_url: null,
          });
          continue;
        }

        // 1-year expiry
        const expiresIn = 60 * 60 * 24 * 365;

        const { data: signed, error: signErr } = await supabase.storage
          .from("prayer-audio")
          .createSignedUrl(p.audio_path, expiresIn);

        if (signErr) {
          console.warn("Failed to sign URL:", signErr.message);
          prayersWithUrls.push({
            ...p,
            signed_audio_url: null,
          });
        } else {
          prayersWithUrls.push({
            ...p,
            signed_audio_url: signed.signedUrl,
          });
        }
      }

      // 3️⃣ Save final results
      setPrayers(prayersWithUrls);

      // Auto-select today's date on first load
      if (!selectedDate) {
        const todayKey = formatDateKey(new Date());
        setSelectedDate(todayKey);
      }
    } catch (e) {
      console.log("Unexpected fetch error:", e);
      setPrayers([]);
    } finally {
      setLoadingPrayers(false);
    }
  };

  fetchPrayers();
}, [userId, currentMonth]);

  // --- Reflections ----------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const fetchReflections = async () => {
      try {
        const { data: weekly } = await supabase
          .from("reflections")
          .select("*")
          .eq("user_id", userId)
          .eq("type", "weekly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (weekly) setWeeklyReflection(weekly as Reflection);

        const { data: monthly } = await supabase
          .from("reflections")
          .select("*")
          .eq("user_id", userId)
          .eq("type", "monthly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (monthly) setMonthlyReflection(monthly as Reflection);
      } catch (err) {
        console.warn("Reflections fetch error:", err);
      }
    };

    fetchReflections();
  }, [userId]);

  // --- Derived data ---------------------------------------------------
  const daysWithPrayer = useMemo(() => {
    const set = new Set<string>();
    prayers.forEach((p) => {
      if (p.prayed_at) set.add(p.prayed_at.slice(0, 10));
    });
    return set;
  }, [prayers]);

  const daysPrayedThisMonth = daysWithPrayer.size;

  const currentStreak = useMemo(() => {
    if (!userId || prayers.length === 0) return 0;
    const allDates = Array.from(
      new Set(prayers.map((p) => p.prayed_at.slice(0, 10)))
    );
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);
      if (allDates.includes(key)) streak++;
      else break;
    }
    return streak;
  }, [prayers, userId]);

  const calendarRows = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const firstWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = lastOfMonth.getDate();

    const cells: Array<{ key: string; label: string; dateKey: string | null }> =
      [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ key: `blank-${i}`, label: "", dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateKey = formatDateKey(date);
      cells.push({ key: dateKey, label: String(d), dateKey });
    }
    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [currentMonth]);

  const prayersForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return prayers.filter((p) => p.prayed_at.startsWith(selectedDate));
  }, [selectedDate, prayers]);

  const formatDuration = (s: number | null) =>
    !s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const formatMsToClock = (ms?: number | null) => {
    if (ms == null) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  // --- Playback -------------------------------------------------------
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

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Expand / collapse transcript with subtle animation
  const toggleTranscript = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPrayerId((prev) => (prev === id ? null : id));
  };

  // --- UI -------------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.textSecondary + "20" },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="book-outline" size={22} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Prayer Journal
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Ionicons
            name="settings-outline"
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Journey Summary */}
        <View style={styles.section}>
          <View style={styles.journeyHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                Your Prayer Journey
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
              >
                You’ve prayed {daysPrayedThisMonth} days this month
              </Text>
            </View>
            <View
              style={[styles.streakChip, { backgroundColor: colors.card }]}
            >
              <Ionicons name="flame-outline" size={16} color={colors.accent} />
              <View style={{ marginLeft: 8 }}>
                <Text
                  style={[styles.streakNumber, { color: colors.textPrimary }]}
                >
                  {currentStreak}
                </Text>
                <Text
                  style={[styles.streakLabel, { color: colors.textSecondary }]}
                >
                  days
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reminder */}
        {userId && (
          <View style={styles.section}>
            <ReminderBanner userId={userId} />
          </View>
        )}

        {/* Reflections placeholder (for now) */}
        <View style={styles.section}>
          {weeklyReflection || monthlyReflection ? (
            <>
              {/* You can render real reflection cards here later */}
            </>
          ) : (
            <Text
              style={[
                styles.sectionSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              No reflections yet — generate your first one soon ✨
            </Text>
          )}
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity onPress={() => goMonth("prev")}>
              <Ionicons
                name="chevron-back-outline"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.calendarMonthLabel,
                { color: colors.textPrimary },
              ]}
            >
              {monthLabel.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => goMonth("next")}>
              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekdayRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekdayLabel}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          {calendarRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.calendarRow}>
              {row.map((cell) => {
                if (!cell.dateKey)
                  return <View key={cell.key} style={styles.calendarCell} />;

                const hasPrayer = daysWithPrayer.has(cell.dateKey);
                const isSelected = selectedDate === cell.dateKey;
                const scaleAnim = new Animated.Value(1);

                const handlePress = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Animated.sequence([
                    Animated.timing(scaleAnim, {
                      toValue: 0.9,
                      duration: 80,
                      easing: Easing.out(Easing.quad),
                      useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                      toValue: 1,
                      friction: 3,
                      tension: 120,
                      useNativeDriver: true,
                    }),
                  ]).start();
                  setSelectedDate(cell.dateKey);
                };

                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={styles.calendarCell}
                    onPress={handlePress}
                  >
                    <Animated.View
                      style={[
                        styles.dayCircle,
                        {
                          transform: [{ scale: scaleAnim }],
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: isSelected
                            ? colors.accent
                            : "transparent",
                          backgroundColor: hasPrayer
                            ? colors.accent + (isSelected ? "55" : "33")
                            : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          {
                            color: colors.textPrimary,
                            fontFamily: hasPrayer ? fonts.heading : fonts.body,
                          },
                        ]}
                      >
                        {cell.label}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Prayer list for selected day */}
        {selectedDate && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.textPrimary }]}
            >
              {new Date(selectedDate).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>

            {loadingPrayers ? (
              <ActivityIndicator color={colors.accent} />
            ) : prayersForSelectedDay.length === 0 ? (
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                No prayers recorded this day.
              </Text>
            ) : (
              prayersForSelectedDay.map((p) => {
                const isPlaying = playingId === p.id;
                const isExpanded = expandedPrayerId === p.id;
                const progress =
                  isPlaying && playbackDuration
                    ? playbackPosition / playbackDuration
                    : 0;

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.prayerCard,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    {/* Play button */}
                    <TouchableOpacity
                      onPress={() => handlePlayPause(p)}
                      style={styles.playButton}
                    >
                      {loadingAudioId === p.id ? (
                        <ActivityIndicator color={colors.accent} />
                      ) : (
                        <Ionicons
                          name={isPlaying ? "pause-circle" : "play-circle"}
                          size={36}
                          color={colors.accent}
                        />
                      )}
                    </TouchableOpacity>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.prayerTime,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {new Date(p.prayed_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        • {formatDuration(p.duration_seconds)}
                      </Text>

                      {/* Progress bar + times */}
                      {p.signed_audio_url && (
                        <View style={styles.playbackMeta}>
                          <View
                            style={[
                              styles.playbackTrack,
                              { backgroundColor: colors.textSecondary + "22" },
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

                      {/* Transcript (collapsible) */}
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
                            onPress={() => toggleTranscript(p.id)}
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
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Settings */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        userId={userId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    marginLeft: spacing.sm,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: { fontFamily: fonts.body, fontSize: 14 },
  journeyHeaderRow: { flexDirection: "row", alignItems: "center" },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  streakNumber: { fontFamily: fonts.heading, fontSize: 16 },
  streakLabel: { fontFamily: fonts.body, fontSize: 12 },

  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  calendarMonthLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 1,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 11,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  calendarCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: { fontSize: 14 },

  prayerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  playButton: { marginRight: spacing.md, marginTop: 2 },
  prayerTime: { fontFamily: fonts.heading, fontSize: 14, marginBottom: 4 },

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
});