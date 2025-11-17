// app/(tabs)/journal/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Modal,
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
import Calendar from "@/components/journal/Calendar";
import { useAuth } from "@/contexts/AuthProvider";
import SettingsModal from "../../../components/SettingsModal";
import { useTheme } from "../../../contexts/ThemeContext";
import { supabase } from "../../../lib/supabaseClient";
import { fonts, spacing } from "../../../theme/theme";

// ---- Types -----------------------------------------------------------

type Prayer = {
  id: string;
  user_id: string;
  prayed_at: string;
  transcript_text: string | null;
  duration_seconds: number | null;
  audio_path: string | null; // stored path in bucket
  signed_audio_url: string | null; // 1-year signed URL
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

// ---- Screen ----------------------------------------------------------

export default function JournalScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const user = (auth?.user ?? null) as any; // temporary TS fix
  const { colors } = useTheme();
  const userId = user?.id ?? null;

  const [refreshKey] = useState(0); // kept but unused externally (safe)
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [allPrayers, setAllPrayers] = useState<Prayer[]>([]);
  const [loadingAllPrayers, setLoadingAllPrayers] = useState(true);
  const [loadingPrayers, setLoadingPrayers] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [weeklyReflection, setWeeklyReflection] = useState<Reflection | null>(
    null
  );
  const [monthlyReflection, setMonthlyReflection] = useState<Reflection | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);

  // Selected date for modal
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  // Playback state (shared for recent list + modal)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0); // ms
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null); // ms

  // Transcript expand / collapse
  const [expandedPrayerId, setExpandedPrayerId] = useState<string | null>(null);

  // Speaker route toggle
  const [playThroughSpeaker, setPlayThroughSpeaker] = useState(true);

  const soundRef = useRef<Audio.Sound | null>(null);

  // ---- Fetch ALL prayers (for streak + recents) -------------------------

  useEffect(() => {
    if (!userId) return;

    const fetchAllPrayers = async () => {
      setLoadingAllPrayers(true);

      const { data, error } = await supabase
        .from("prayers")
        .select("*")
        .eq("user_id", userId)
        .order("prayed_at", { ascending: false });

      if (error) {
        console.warn("Failed to load ALL prayers:", error.message);
        setAllPrayers([]);
      } else {
        const prayersWithUrls: Prayer[] = [];

        for (const p of data || []) {
          if (!p.audio_path) {
            prayersWithUrls.push({ ...(p as Prayer), signed_audio_url: null });
            continue;
          }

          const { data: signed } = await supabase.storage
            .from("prayer-audio")
            .createSignedUrl(p.audio_path, 60 * 60 * 24 * 365);

          prayersWithUrls.push({
            ...(p as Prayer),
            signed_audio_url: signed?.signedUrl ?? null,
          });
        }

        // Prevent fetch from overwriting realtime inserts
        setAllPrayers((prev) => {
          if (!prayersWithUrls) return prev;

          const map = new Map<string, Prayer>();

          // fetched = base
          for (const p of prayersWithUrls) {
            map.set(p.id, p);
          }

          // keep any locally-added (realtime) items not yet in fetch
          for (const p of prev) {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            }
          }

          return Array.from(map.values()).sort(
            (a, b) =>
              new Date(b.prayed_at).getTime() - new Date(a.prayed_at).getTime()
          );
        });
      }

      setLoadingAllPrayers(false);
    };

    fetchAllPrayers();
  }, [userId]);

  // ---- Fetch prayers (visible month / calendar) ------------------------

  useEffect(() => {
    if (!userId) return;

    const fetchMonthPrayers = async () => {
      setLoadingPrayers(true);

      try {
        const { data: rows, error } = await supabase
          .from("prayers")
          .select("*")
          .eq("user_id", userId)
          .order("prayed_at", { ascending: false });

        if (error) {
          console.warn("Failed to load prayers:", error.message);
          setPrayers([]);
          return;
        }

        const withUrls: Prayer[] = [];

        for (const p of rows || []) {
          if (!p.audio_path) {
            withUrls.push({ ...(p as Prayer), signed_audio_url: null });
            continue;
          }

          const { data: signed } = await supabase.storage
            .from("prayer-audio")
            .createSignedUrl(p.audio_path, 60 * 60 * 24 * 365);

          withUrls.push({
            ...(p as Prayer),
            signed_audio_url: signed?.signedUrl ?? null,
          });
        }

        // Authoritative month data
        setPrayers((prev) => {
          const map = new Map<string, Prayer>();

          // fetched base
          for (const p of withUrls) map.set(p.id, p);

          // keep any realtime-only records
          for (const p of prev) {
            if (!map.has(p.id)) map.set(p.id, p);
          }

          return Array.from(map.values()).sort(
            (a, b) =>
              new Date(b.prayed_at).getTime() - new Date(a.prayed_at).getTime()
          );
        });
      } catch (err) {
        console.warn("Unexpected month fetch error:", err);
        setPrayers([]);
      } finally {
        setLoadingPrayers(false);
      }
    };

    fetchMonthPrayers();
  }, [userId, refreshKey]);

  // ---- Supabase realtime: instant INSERT / UPDATE / DELETE -------------

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("prayers-journal-sync")
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "prayers",
          filter: `user_id=eq.${userId}`,
          event: "*",
        },
        async (payload) => {
          const newRow = payload.new as Prayer | null;
          const oldRow = payload.old as Prayer | null;

          // Helper: insert at top if not exists
          const prependUnique = (list: Prayer[], item: Prayer) => {
            if (list.some((p) => p.id === item.id)) return list;
            return [item, ...list].sort(
              (a, b) =>
                new Date(b.prayed_at).getTime() -
                new Date(a.prayed_at).getTime()
            );
          };

          // Helper: update by id
          const updateById = (list: Prayer[], updated: Prayer) =>
            list
              .map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
              .sort(
                (a, b) =>
                  new Date(b.prayed_at).getTime() -
                  new Date(a.prayed_at).getTime()
              );

          // Helper: delete by id
          const deleteById = (list: Prayer[], id: string) =>
            list.filter((p) => p.id !== id);

          // INSERT — show instantly in both Recent Prayers + Calendar
          if (payload.eventType === "INSERT" && newRow) {
            const newPrayer: Prayer = {
              ...newRow,
              signed_audio_url: null, // will be filled when fetchers run
            };

            setPrayers((prev) => prependUnique(prev, newPrayer));
            setAllPrayers((prev) => prependUnique(prev, newPrayer));
            return;
          }

          // UPDATE — keep both lists in sync
          if (payload.eventType === "UPDATE" && newRow) {
            const updated: Prayer = {
              ...newRow,
              signed_audio_url: null, // keep type, signed URL will be refreshed on next fetch
            };

            setPrayers((prev) => updateById(prev, updated));
            setAllPrayers((prev) => updateById(prev, updated));
            return;
          }

          // DELETE — remove from both lists
          if (payload.eventType === "DELETE" && oldRow) {
            setPrayers((prev) => deleteById(prev, oldRow.id));
            setAllPrayers((prev) => deleteById(prev, oldRow.id));
            return;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ---- Reflections ----------------------------------------------------

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

  // ---- Derived data ---------------------------------------------------

  const daysWithPrayer = useMemo(() => {
    const set = new Set<string>();
    prayers.forEach((p) => {
      if (p.prayed_at) set.add(p.prayed_at.slice(0, 10));
    });
    return set;
  }, [prayers]);

  const daysPrayedThisMonth = daysWithPrayer.size;

  const currentStreak = useMemo(() => {
    if (!userId || allPrayers.length === 0) return 0;

    // Use ALL dates ever prayed
    const allDates = Array.from(
      new Set(allPrayers.map((p) => p.prayed_at.slice(0, 10)))
    );

    const today = new Date();
    const todayKey = formatDateKey(today);

    let streak = 0;

    // Check yesterday backwards
    for (let i = 1; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);

      if (allDates.includes(key)) streak++;
      else break;
    }

    // If today was prayed, add 1
    if (allDates.includes(todayKey)) streak += 1;

    return streak;
  }, [allPrayers, userId]);

  const prayersForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return prayers.filter((p) => p.prayed_at.startsWith(selectedDateKey));
  }, [selectedDateKey, prayers]);

  const recentPrayers = useMemo(() => {
    return [...allPrayers]
      .sort(
        (a, b) =>
          new Date(b.prayed_at).getTime() - new Date(a.prayed_at).getTime()
      )
      .slice(0, 3);
  }, [allPrayers]);

  // ---- Playback -------------------------------------------------------

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

  // ---- Delete prayer (row + storage audio) ---------------------------

  const handleDeletePrayer = (p: Prayer) => {
    Alert.alert(
      "Delete prayer?",
      "This will remove the recording and transcript for this entry.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("prayers")
                .delete()
                .eq("id", p.id);

              if (error) {
                console.warn("Delete prayer error:", error.message);
                return;
              }

              if (p.audio_path) {
                const { error: storageErr } = await supabase.storage
                  .from("prayer-audio")
                  .remove([p.audio_path]);

                if (storageErr) {
                  console.warn(
                    "Delete storage object error:",
                    storageErr.message
                  );
                }
              }

              setPrayers((prev) => prev.filter((row) => row.id !== p.id));
              setAllPrayers((prev) => prev.filter((row) => row.id !== p.id));

              if (playingId === p.id && soundRef.current) {
                try {
                  await soundRef.current.stopAsync();
                  await soundRef.current.unloadAsync();
                } catch {}
                soundRef.current = null;
                setPlayingId(null);
                setPlaybackPosition(0);
                setPlaybackDuration(null);
              }
            } catch (e) {
              console.warn("Unexpected delete error:", e);
            }
          },
        },
      ]
    );
  };

  // ---- Handlers for calendar & modal ---------------------------------

  const handleMonthChange = (nextMonth: Date) => {
    setCurrentMonth(nextMonth);
  };

  const openDayModal = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setDayModalVisible(true);
  };

  const closeDayModal = () => {
    setDayModalVisible(false);
    setSelectedDateKey(null);
    setExpandedPrayerId(null);
  };

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------

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
        <View style={styles.leftHeader}>
          <Image
            source={require("../../../assets/Logo2.png")}
            style={{ width: 44, height: 44, marginRight: 8 }}
            resizeMode="contain"
          />
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
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                You’ve prayed {daysPrayedThisMonth} days this month
              </Text>
            </View>
            <View
              style={[
                styles.streakChip,
                { backgroundColor: colors.accent + "20" },
              ]}
            >
              <Ionicons name="flash" size={16} color={colors.accent} />
              <View style={{ marginLeft: 8 }}>
                <Text
                  style={[styles.streakLabel, { color: colors.textPrimary }]}
                >
                  {currentStreak}
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

        {/* Calendar */}
        <View style={styles.section}>
          <Calendar
            month={currentMonth}
            onMonthChange={handleMonthChange}
            selectedDateKey={selectedDateKey}
            onSelectDate={openDayModal}
            daysWithPrayer={daysWithPrayer}
          />
        </View>

        {/* Weekly reflection card (short) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Weekly reflection
          </Text>
          {weeklyReflection ? (
            <View
              style={[
                styles.reflectionCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[styles.reflectionTitle, { color: colors.textPrimary }]}
              >
                {weeklyReflection.title}
              </Text>
              {!!weeklyReflection.subtitle && (
                <Text
                  style={[
                    styles.reflectionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {weeklyReflection.subtitle}
                </Text>
              )}
              <Text
                style={[styles.reflectionBody, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {weeklyReflection.body}
              </Text>
              {!!weeklyReflection.verse_reference && (
                <Text
                  style={[
                    styles.reflectionVerse,
                    { color: colors.textSecondary },
                  ]}
                >
                  {weeklyReflection.verse_reference} —{" "}
                  {weeklyReflection.verse_text}
                </Text>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                No reflections yet — your weekly summary will appear here once
                you generate one.
              </Text>
            </View>
          )}
        </View>

        {/* Recent prayers (last 3) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent prayers
          </Text>

          {recentPrayers.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="mic-outline"
                size={20}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                No prayers recorded yet — tap the mic on the Pray tab to make
                your first entry.
              </Text>
            </View>
          ) : (
            recentPrayers.map((p) => {
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

              return (
                <View
                  key={p.id}
                  style={[
                    styles.recentPrayerRow,
                    { backgroundColor: colors.card },
                  ]}
                >
                  {/* Tap left side to open modal for that day */}
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      const key = p.prayed_at.slice(0, 10);
                      openDayModal(key);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.recentPrayerTitle,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {dateLabel} • {timeLabel}
                    </Text>
                    {!!p.transcript_text && (
                      <Text
                        style={[
                          styles.recentPrayerSnippet,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {p.transcript_text}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Inline play button */}
                  <TouchableOpacity
                    onPress={() => handlePlayPause(p)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {loadingAudioId === p.id ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Ionicons
                        name={isPlaying ? "pause-circle" : "play-circle"}
                        size={28}
                        color={colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Monthly reflection / score-card style */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Monthly reflection
          </Text>
          {monthlyReflection ? (
            <View
              style={[
                styles.reflectionCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[styles.reflectionTitle, { color: colors.textPrimary }]}
              >
                {monthlyReflection.title}
              </Text>
              {!!monthlyReflection.subtitle && (
                <Text
                  style={[
                    styles.reflectionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {monthlyReflection.subtitle}
                </Text>
              )}
              <Text
                style={[styles.reflectionBody, { color: colors.textSecondary }]}
                numberOfLines={4}
              >
                {monthlyReflection.body}
              </Text>
              {!!monthlyReflection.verse_reference && (
                <Text
                  style={[
                    styles.reflectionVerse,
                    { color: colors.textSecondary },
                  ]}
                >
                  {monthlyReflection.verse_reference} —{" "}
                  {monthlyReflection.verse_text}
                </Text>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                No monthly reflection yet — keep showing up in prayer and you’ll
                unlock a monthly summary here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Day modal: full-page, all prayers for selected date */}
      <Modal
        visible={dayModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDayModal}
      >
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Modal header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.textSecondary + "20" },
            ]}
          >
            <TouchableOpacity onPress={closeDayModal}>
              <Ionicons
                name="chevron-back-outline"
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text
                style={[styles.modalTitle, { color: colors.textPrimary }]}
              >
                {selectedDateKey
                  ? new Date(selectedDateKey).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "Selected day"}
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                {prayersForSelectedDate.length}{" "}
                {prayersForSelectedDate.length === 1 ? "prayer" : "prayers"}
              </Text>
            </View>

            {/* Speaker toggle icon */}
            <TouchableOpacity
              onPress={() => setPlayThroughSpeaker((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={
                  playThroughSpeaker
                    ? "volume-high-outline"
                    : "headset-outline"
                }
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.modalScrollContent,
              { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {loadingPrayers ? (
              <ActivityIndicator color={colors.accent} />
            ) : prayersForSelectedDate.length === 0 ? (
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                No prayers recorded this day.
              </Text>
            ) : (
              prayersForSelectedDate.map((p) => {
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
                      <View style={styles.prayerHeaderRow}>
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

                        {/* Delete icon */}
                        <TouchableOpacity
                          onPress={() => handleDeletePrayer(p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>

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
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        userId={userId}
      />
    </SafeAreaView>
  );
}

// ---- Styles ----------------------------------------------------------

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
  leftHeader: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
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

  // Reflections cards
  reflectionCard: {
    borderRadius: 16,
    padding: spacing.md,
  },
  reflectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    marginBottom: 4,
  },
  reflectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  reflectionBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  reflectionVerse: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.xs,
  },

  // Empty / gamification cards
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: spacing.md,
  },

  // Recent prayers
  recentPrayerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  recentPrayerTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  recentPrayerSnippet: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  // Prayer cards (used in modal)
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

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  modalScrollContent: {
    paddingBottom: spacing.xl,
  },
});