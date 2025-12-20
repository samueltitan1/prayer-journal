// app/(tabs)/journal/index.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";

import BookmarksModal from "@/components/journal/BookmarksOverlay";
import Calendar from "@/components/journal/Calendar";
import MilestoneTimelineModal from "@/components/journal/MilestoneTimelineModal";
import PrayerDayModal from "@/components/journal/PrayerDayOverlay";
import PrayerEntryModal from "@/components/journal/PrayerEntryModal";
import ReflectionModal from "@/components/journal/ReflectionModal";
import ReminderBanner from "@/components/ReminderBanner";
import ShimmerCard from "@/components/ShimmerCard";
import { useAuth } from "@/contexts/AuthProvider";
import { Prayer } from "@/types/Prayer";
import { Portal, PortalProvider } from "@gorhom/portal";
import SettingsModal from "../../../components/SettingsModal";
import { useTheme } from "../../../contexts/ThemeContext";
import { getSupabase } from "../../../lib/supabaseClient";
import { fonts, spacing } from "../../../theme/theme";
// ---- Types -----------------------------------------------------------

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

// ---- Reflection generator ----
const triggerReflection = async (
  userId: string,
  type: "weekly" | "monthly"
) => {
  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    const accessToken = session?.access_token;
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate_reflection`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userId, type }),
      }
    );

    const json = await res.json();
    console.log(`Reflection result (${type}):`, json);
  } catch (err) {
    console.warn(`Error calling ${type} reflection:`, err);
  }
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
  // ---- Single-prayer entry modal state ----
  const [selectedPrayer, setSelectedPrayer] = useState<Prayer | null>(null);
  const [prayerEntryVisible, setPrayerEntryVisible] = useState(false);
  // Playback state (shared for recent list + modal)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0); // ms
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null); // ms

  // Transcript expand / collapse
  const [expandedPrayerId, setExpandedPrayerId] = useState<string | null>(null);

  // Speaker route toggle
  const [playThroughSpeaker, setPlayThroughSpeaker] = useState(true);
  const [useSpeaker, setUseSpeaker] = useState(true);
  const onToggleSpeaker = () => setUseSpeaker((prev) => !prev);
  const soundRef = useRef<Audio.Sound | null>(null);
  const ignorePlaybackUntil = useRef(0); // prevent snapback glitch after dragging

  const todayKey = () => new Date().toISOString().slice(0, 10);

  
  const [showReflectionBadge, setShowReflectionBadge] = useState<"weekly" | "monthly" | null>(null);
  // last reflection Seen
  const [lastReflectionSeen, setLastReflectionSeen] = useState<string | null>(null);
  const [showReflectionToast, setShowReflectionToast] = useState(false);
  const [reflectionToastMessage, setReflectionToastMessage] = useState("");
  const [loadingReflections, setLoadingReflections] = useState(true);

// Milestone state
const [milestoneTimelineVisible, setMilestoneTimelineVisible] = useState(false);

// Milestone unlock state and helpers
const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([]);

const UNLOCKED_MILESTONES_KEY = "unlocked_milestones_v1";

const loadUnlockedMilestones = async () => {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_MILESTONES_KEY);
    if (raw) setUnlockedMilestones(JSON.parse(raw));
  } catch {}
};

const persistUnlockedMilestones = async (next: number[]) => {
  setUnlockedMilestones(next);
  try {
    await AsyncStorage.setItem(
      UNLOCKED_MILESTONES_KEY,
      JSON.stringify(next)
    );
  } catch {}
};
// Load unlocked milestones when userId changes
useEffect(() => {
  if (!userId) return;
  loadUnlockedMilestones();
}, [userId]);
// ---- Full reflection modal (weekly/monthly) ----
const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
const [activeReflection, setActiveReflection] = useState<Reflection | null>(null);

// ---- Bookmarked prayers state ----
const [bookmarksModalVisible, setBookmarksModalVisible] = useState(false);
const [searchQuery, setSearchQuery] = useState("");

// Derive bookmarks from `allPrayers` so the Journal preview updates instantly
const bookmarkedPrayers = useMemo(() => {
  return [...allPrayers]
    .filter((p) => !!p.is_bookmarked)
    .sort(
      (a, b) =>
        new Date(b.prayed_at).getTime() - new Date(a.prayed_at).getTime()
    );
}, [allPrayers]);

  // ---- Fetch ALL prayers (for streak + recents) -------------------------

  useEffect(() => {
    if (!userId) return;

    const fetchAllPrayers = async () => {
      setLoadingAllPrayers(true);

      const { data, error } = await getSupabase()
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
        // Determine bookmark status
        const { data: bm } = await getSupabase()
        .from("bookmarked_prayers")
        .select("id")
        .eq("user_id", userId)
        .eq("prayer_id", p.id)
        .maybeSingle();

        const isBookmarked = !!bm;
        //if no audio, still include bookmark state
        
          if (!p.audio_path) {
            prayersWithUrls.push({ ...(p as Prayer), signed_audio_url: null });
            continue;
          }
          // Add signed URL
          const { data: signed } = await getSupabase().storage
            .from("prayer-audio")
            .createSignedUrl(p.audio_path, 60 * 60 * 24 * 365);

          prayersWithUrls.push({
            ...(p as Prayer),
            signed_audio_url: signed?.signedUrl ?? null,
            is_bookmarked: isBookmarked,
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
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data: rows, error } = await getSupabase()
          .from("prayers")
          .select("*")
          .eq("user_id", userId)
          .gte("prayed_at", monthStart)
          .lte("prayed_at", monthEnd)
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

          const { data: signed } = await getSupabase().storage
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
  }, [userId, refreshKey, currentMonth]);

  // ---- Supabase realtime: instant INSERT / UPDATE / DELETE -------------

  useEffect(() => {
    if (!userId) return;

    const channel = getSupabase()
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
      getSupabase().removeChannel(channel);
    };
  }, [userId]);

  // ---- Realtime bookmark sync ----
  useEffect(() => {
    if (!userId) return;

    const channel = getSupabase()
      .channel("bookmarks-sync")
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "bookmarked_prayers",
          filter: `user_id=eq.${userId}`,
          event: "*",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const prayerId = payload.new.prayer_id;
            setAllPrayers((prev) =>
              prev.map((p) =>
                p.id === prayerId ? { ...p, is_bookmarked: true } : p
              )
            );
            setPrayers((prev) =>
              prev.map((p) =>
                p.id === prayerId ? { ...p, is_bookmarked: true } : p
              )
            );
          }

          if (payload.eventType === "DELETE") {
            const prayerId = payload.old.prayer_id;
            setAllPrayers((prev) =>
              prev.map((p) =>
                p.id === prayerId ? { ...p, is_bookmarked: false } : p
              )
            );
            setPrayers((prev) =>
              prev.map((p) =>
                p.id === prayerId ? { ...p, is_bookmarked: false } : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => { getSupabase().removeChannel(channel); };
  }, [userId]);

  // ---- Reflections ----------------------------------------------------
  // ---- Reflection generation (separate effect to avoid loops) ----
  useEffect(() => {
    if (!userId) return;
    checkReflectionGeneration(); // run generation logic separately
  }, [userId, allPrayers]);

  // ---- Check if weekly + monthly reflections should be generated ----
  const checkReflectionGeneration = async () => {
    if (!userId || allPrayers.length === 0) return;

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const day = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    // Create date keys
    const todayKey = today.toISOString().slice(0, 10);

    // ------- WEEKLY LOGIC -------
    if (dayOfWeek === 0) {
      const prayersThisWeek = allPrayers.filter((p) => {
        const d = new Date(p.prayed_at);
        return d >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      });

      if (prayersThisWeek.length >= 2) {
        await triggerReflection(userId, "weekly");
      }
    }

    // ------- MONTHLY LOGIC -------
    if (day === 1) {
      // Calculate previous month and year (handle year rollover for January)
      const previousMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
      const previousYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

      const prayersThisMonth = allPrayers.filter((p) => {
        const d = new Date(p.prayed_at);
        return d.getMonth() === previousMonth && d.getFullYear() === previousYear;
      });

      if (prayersThisMonth.length >= 4) {
        await triggerReflection(userId, "monthly");
      }
    }
  };

  // ---- Fetch reflections ----
  useEffect(() => {
    if (!userId) return;
  
    const fetchReflections = async () => {
      setLoadingReflections(true);
      
      try {
        // fetch weekly reflections
        const { data: weekly } = await getSupabase()
          .from("reflections")
          .select("*")
          .eq("user_id", userId)
          .eq("type", "weekly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
  
        if (weekly) {setWeeklyReflection(weekly as Reflection);
          
          // NEW: trigger toast if this weekly reflection is new
          if (weekly.id !== lastReflectionSeen) {
            setReflectionToastMessage("New weekly reflection ready 🙏");
            setShowReflectionToast(true);
            setLastReflectionSeen(weekly.id);

            setTimeout(() => setShowReflectionToast(false), 3500);
          }
        }    

        // fetch monthly reflection
        const { data: monthly } = await getSupabase()
          .from("reflections")
          .select("*")
          .eq("user_id", userId)
          .eq("type", "monthly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
  
        if (monthly) {setMonthlyReflection(monthly as Reflection);
    
          // NEW: trigger toast if this monthly reflection is new
          if (monthly.id !== lastReflectionSeen) {
            setReflectionToastMessage("New monthly reflection ready 🙏");
            setShowReflectionToast(true);
            setLastReflectionSeen(monthly.id);

            setTimeout(() => setShowReflectionToast(false), 3500);
          }
        }

      } catch (err) {
        console.warn("Reflections fetch error:", err);
      } finally {
        setLoadingReflections(false);
      }
    };
  
    fetchReflections();
  }, [userId, allPrayers]); // 🔥 listen for new prayers


  // ---- Derived data ---------------------------------------------------

  const daysWithPrayer = useMemo(() => {
    const set = new Set<string>();
    prayers.forEach((p) => {
      if (p.prayed_at) set.add(p.prayed_at.slice(0, 10));
    });
    return set;
  }, [prayers]);

  const daysPrayedThisMonth = useMemo(() => {
    const set = new Set<string>();
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    prayers.forEach((p) => {
      const d = new Date(p.prayed_at);
      if (d.getMonth() === month && d.getFullYear() === year) {
        set.add(p.prayed_at.slice(0, 10));
      }
    });

    return set.size;
  }, [prayers, currentMonth]);

  const currentStreak = useMemo(() => {
    if (!userId) return 0;
    if (allPrayers.length === 0) return 0;

    // Build unique sorted date list
    const uniqueDates = Array.from(
      new Set(allPrayers.map((p) => p.prayed_at.slice(0, 10)))
    ).sort().reverse(); // newest → oldest

    const today = new Date();
    const todayStr = formatDateKey(today);

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterday);

    const lastDate = uniqueDates[0];

    // Helper to count consecutive days backwards starting from a date
    const countConsecutive = (startDate: Date) => {
      let count = 0;
      let d = new Date(startDate);

      while (true) {
        const key = formatDateKey(d);
        if (uniqueDates.includes(key)) {
          count++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      return count;
    };

    // Case 1 — streak includes today
    if (lastDate === todayStr) {
      return countConsecutive(today);
    }

    // Case 2 — today not prayed yet, but yesterday continues the streak
    if (lastDate === yesterdayStr) {
      return countConsecutive(yesterday);
    }

    // Else — no streak
    return 0;
  }, [allPrayers, userId]);

  const longestStreak = useMemo(() => {
    if (!userId) return 0;
    if (allPrayers.length === 0) return 0;

    const uniqueDates = Array.from(
      new Set(allPrayers.map((p) => p.prayed_at.slice(0, 10)))
    ).sort(); // oldest → newest

    let longest = 0;
    let current = 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        current = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diff =
          (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

        if (diff === 1) {
          current++;
        } else {
          current = 1;
        }
      }
      longest = Math.max(longest, current);
    }

    return longest;
  }, [allPrayers, userId]);
  
  // Milestone unlock logic (only adds, never removes)
  useEffect(() => {
    if (!longestStreak) return;

    const milestoneDays = [1, 7, 21, 40, 90, 180, 365];

    const newlyUnlocked = milestoneDays.filter(
      (d) => longestStreak >= d && !unlockedMilestones.includes(d)
    );

    if (newlyUnlocked.length === 0) return;

    persistUnlockedMilestones([...unlockedMilestones, ...newlyUnlocked]);
  }, [longestStreak, unlockedMilestones]);

  const prayersForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return prayers
      .filter((p) => p.prayed_at.startsWith(selectedDateKey))
      .map((p) => {
        const full = allPrayers.find((ap) => ap.id === p.id);
        return full ? full : p;
      });
  }, [selectedDateKey, prayers, allPrayers]);

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

  // ---- Play/pause prayer audio ---------------------------------------

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

        // Prevent snapback: ignore old playback events after a manual seek
        if (Date.now() < ignorePlaybackUntil.current) {
          return;
        }

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

  // ---- Seek audio manually (used by PrayerEntryModal) ----
  const handleSeek = async (prayer: Prayer, positionMs: number) => {
    try {
      if (!soundRef.current) {
        console.log("Seek attempted but no sound loaded");
        return;
      }
      // Block AVFoundation stale callbacks for 250ms
      ignorePlaybackUntil.current = Date.now() + 250;
      await soundRef.current.setPositionAsync(positionMs);
      setPlaybackPosition(positionMs);
    } catch (err) {
      console.log("Seek error:", err);
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
              const { error } = await getSupabase()
                .from("prayers")
                .delete()
                .eq("id", p.id);

              if (error) {
                console.warn("Delete prayer error:", error.message);
                return;
              }

              if (p.audio_path) {
                const { error: storageErr } = await getSupabase().storage
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

  // ---- Bookmark toggle ----
  const toggleBookmark = async (prayerId: string) => {
    if (!userId) return;

    try {
      // Check if bookmark exists
      const { data: existing } = await getSupabase()
        .from("bookmarked_prayers")
        .select("id")
        .eq("user_id", userId)
        .eq("prayer_id", prayerId)
        .maybeSingle();

      if (existing) {
        // Remove bookmark
        await getSupabase()
          .from("bookmarked_prayers")
          .delete()
          .eq("id", existing.id);

        // Optimistic UI update
        setAllPrayers((prev) =>
          prev.map((p) =>
            p.id === prayerId ? { ...p, is_bookmarked: false } : p
          )
        );
        setPrayers((prev) =>
          prev.map((p) =>
            p.id === prayerId ? { ...p, is_bookmarked: false } : p
          )
        );
        // Keep the Journal "Bookmarked prayers" preview in sync instantly
        // (preview is derived from allPrayers, so no extra state update needed)
      } else {
        // Add bookmark
        await getSupabase()
          .from("bookmarked_prayers")
          .insert({
            user_id: userId,
            prayer_id: prayerId,
          });

        // Optimistic UI update
        setAllPrayers((prev) =>
          prev.map((p) =>
            p.id === prayerId ? { ...p, is_bookmarked: true } : p
          )
        );
        setPrayers((prev) =>
          prev.map((p) =>
            p.id === prayerId ? { ...p, is_bookmarked: true } : p
          )
        );
        // Keep the Journal "Bookmarked prayers" preview in sync instantly
        // (preview is derived from allPrayers, so no extra state update needed)
      }
    } catch (err) {
      console.warn("Bookmark toggle error:", err);
    }
  };
// ---- Open the single-prayer "Prayer Entry" modal ----
const openPrayerEntry = (p: Prayer) => {
  console.log("openPrayerEntry called with", p.id); 
  setSelectedPrayer(p);
  setPrayerEntryVisible(true);
};
// NEW: open modal from anywhere
const handleSelectPrayer = (p: Prayer) => {
  console.log("handleSelectPrayer called with", p.id);
  setSelectedPrayer(p);
  setPrayerEntryVisible(true);

};

// Open full reflection modal
const openReflection = (reflection: Reflection) => {
  setActiveReflection(reflection);
  setReflectionModalVisible(true);
};

// Close full reflection modal
const closeReflection = () => {
  setReflectionModalVisible(false);
  setActiveReflection(null);
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
    <PortalProvider>
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
                  You’ve journaled {daysPrayedThisMonth} days this month
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMilestoneTimelineVisible(true)}
                style={[
                  styles.streakChip,
                  { backgroundColor: colors.accent + "20" },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons name="flash" size={16} color={colors.accent} />
                <View style={{ marginLeft: 8 }}>
                  <Text
                    style={[styles.streakLabel, { color: colors.textPrimary }]}
                  >
                    {currentStreak}
                  </Text>
                </View>
              </TouchableOpacity>
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
            {loadingReflections ? (
              <ShimmerCard height={110} />
            ) : weeklyReflection ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openReflection(weeklyReflection)}
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
              </TouchableOpacity>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={colors.accent}
                  style={{ marginRight: spacing.sm }}
                />
                <Text
                  style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
                >
                  Weekly relfections are created on Sundays. 
                  Add journal entries thoughout the week and your reflection will appear here automatically.
                </Text>
              </View>
            )}
          </View>

            {/* Recent prayers (last 3) 
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
                    */}
                    {/* Tap left side to open modal for that prayer 
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        openPrayerEntry(p);
                      }}
                      activeOpacity={0.8}
                    >

                      {!!p.transcript_text && (
                        <Text
                          style={[
                            styles.recentPrayerSnippet,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={2}
                        >
                          {p.transcript_text}
                        </Text>
                      )}
                                            <Text
                        style={[
                          styles.prayerMeta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {dateLabel} • {timeLabel}
                      </Text>
                    </TouchableOpacity>
*/}
                    {/* Bookmark icon 
                    <TouchableOpacity
                      onPress={() => toggleBookmark(p.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginRight: spacing.sm }}
                    >
                      <Ionicons
                        name={p.is_bookmarked ? "heart" : "heart-outline"}
                        size={22}
                        color={colors.accent}
                        
                      />
                    </TouchableOpacity>

                  </View>
                );
              })
            )}
          </View> 
*/}

          {/* Bookmarked Prayers */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Bookmarked prayers
            </Text>

            {bookmarkedPrayers.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <Ionicons
                  name="heart-outline"
                  size={18}
                  color={colors.accent}
                  style={{ marginRight: spacing.sm }}
                />
                <Text
                  style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
                >
                  Bookmark prayers you want to revisit later.
                </Text>
              </View>
            ) : (
              <>
                {/* Preview first 3 bookmarks */}
                {bookmarkedPrayers.slice(0, 3).map((p) => {
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

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.recentPrayerRow,
                        { backgroundColor: colors.card },
                      ]}
                      onPress={() => {
                        const full =
                          allPrayers.find((ap) => ap.id === p.id) ?? p;
                        openPrayerEntry(full);
                        setSearchQuery("");
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        {/* LEFT SIDE: transcript text snippet */}
                        {!!p.transcript_text && (
                          <Text
                            style={[
                              styles.recentPrayerSnippet,
                              { color: colors.textPrimary },
                            ]}
                            numberOfLines={2}
                          >
                            {p.transcript_text}
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.prayerMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {/* LEFT SIDE: date • time + snippet */}
                          {dateLabel} • {timeLabel}
                        </Text>
                      </View>

                      {/* Bookmark icon toggle */}
                      <Ionicons
                        name={p.is_bookmarked ? "heart" : "heart-outline"}
                        size={22}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
                  );
                })}

                {/* View all button */}
                {bookmarkedPrayers.length > 3 && (
                  <TouchableOpacity
                    onPress={() => setBookmarksModalVisible(true)}
                    style={{ marginTop: spacing.sm }}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontFamily: fonts.body,
                        fontSize: 14,
                      }}
                    >
                      View all bookmarked prayers →
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Monthly reflection / score-card style */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Monthly reflection
            </Text>
            {loadingReflections ? (
              <ShimmerCard height={130} />
            ) : monthlyReflection ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openReflection(monthlyReflection)}
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
              </TouchableOpacity>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={colors.accent}
                  style={{ marginRight: spacing.sm }}
                />
                <Text
                  style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
                >
                  Monthly reflections are created on the first day of each month.
                  Keep praying - your reflection will appear here.
                
                </Text>
              </View>
            )}
          </View>


        </ScrollView>

        {/* Reflection Toast stays inside normal layout */}
        {showReflectionToast && (
          <View
            style={{
              position: "absolute",
              left: spacing.lg,
              right: spacing.lg,
              bottom: spacing.lg,
              backgroundColor: colors.card,
              padding: spacing.md,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}
          >
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.accent}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.body }}>
              {reflectionToastMessage}
            </Text>
          </View>
        )}
      </SafeAreaView>
      {/* Modals */}
      <PrayerDayModal
        visible={dayModalVisible}
        dateKey={selectedDateKey}
        prayersForSelectedDate={prayersForSelectedDate}
        selectedDateKey={selectedDateKey}
        expandedPrayerId={expandedPrayerId}
        closeDayModal={closeDayModal}
        loadingPrayers={loadingPrayers}
        toggleBookmark={toggleBookmark}
        handleDeletePrayer={handleDeletePrayer}
        onSelectPrayer={handleSelectPrayer}
        isEntryOpen={prayerEntryVisible}
      />
      {bookmarksModalVisible && (
  <View style={styles.bookmarksOverlayRoot}>
    {/* Sheet */}
    <View style={styles.bookmarksSheet}></View>
      <BookmarksModal
        visible={bookmarksModalVisible}
        onClose={() => setBookmarksModalVisible(false)}
        userId={userId}
        onSelectPrayer={openPrayerEntry}
      />
          </View>
)}
      <PrayerEntryModal
        visible={prayerEntryVisible}
        prayer={selectedPrayer}
        onClose={() => {
          setPrayerEntryVisible(false);
          setSelectedPrayer(null);
        }}
        isPlaying={!!selectedPrayer && playingId === selectedPrayer.id}
        isLoadingAudio={!!selectedPrayer && loadingAudioId === selectedPrayer.id}
        playbackPositionMs={playbackPosition}
        playbackDurationMs={playbackDuration}
        onPlayPause={(p) => handlePlayPause(p as any)}
        onToggleBookmark={(id) => toggleBookmark(id)}
        onDeletePrayer={(p) => handleDeletePrayer(p as any)}
        onToggleTranscript={toggleTranscript}
        onSeek={handleSeek}
        onSeekCompleteCooldown={() => {
          ignorePlaybackUntil.current = Date.now() + 250;
        }}
      />
      <Portal>
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          userId={userId}
        />
      </Portal>
      <Portal>
        <MilestoneTimelineModal
          visible={milestoneTimelineVisible}
          currentStreak={currentStreak}
          unlockedMilestones={unlockedMilestones}
          onClose={() => setMilestoneTimelineVisible(false)}
        />
      </Portal>
      <ReflectionModal
        visible={reflectionModalVisible}
        reflection={activeReflection}
        onClose={closeReflection}
      />
    </PortalProvider>
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
  
  // Bookmarked prayers
  bookmarkPrayerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    flexWrap: "wrap",
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
  prayerMeta: { fontFamily: fonts.body, fontSize: 10, lineHeight: 18 },

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
  speakerToggle: {
    marginLeft: spacing.sm,
  },

  bookmarksOverlayRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end", // sheet rises from bottom
    // optional dim:
    // backgroundColor: "rgba(0,0,0,0.35)",
  },
  
  bookmarksSheet: {
    height: "10%",          // 👈 this is the “come up higher” bit
    // borderTopLeftRadius: 24,   // you said ignore radius for now
    // borderTopRightRadius: 24,
    overflow: "hidden",
  },
});