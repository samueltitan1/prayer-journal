import type { MilestoneConfig } from "@/app/constants/milestonesConfig";
import { MILESTONES } from "@/app/constants/milestonesConfig";
import MilestoneModal from "../../../components/MilestoneModal";
// app/(tabs)/pray/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SettingsModal from "../../../components/SettingsModal";
import TranscriptEditor from "../../../components/TranscriptEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { getSupabase } from "../../../lib/supabaseClient";
import { fonts, spacing } from "../../../theme/theme";

type PrayState = "idle" | "recording" | "saved";
const MAX_SECONDS_DEFAULT = 10 * 60;

export default function PrayScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [prayState, setPrayState] = useState<PrayState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS_DEFAULT);

  const [showToast, setShowToast] = useState(false);
  // --- Prayer Saved card auto-dismiss timer ---
  const prayerSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Milestone detection state ---
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [unlockedMilestone, setUnlockedMilestone] = useState<MilestoneConfig | null>(null);
  const milestoneCheckRef = useRef(false);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (prayerSavedTimeoutRef.current) {
        clearTimeout(prayerSavedTimeoutRef.current);
      }
    };
  }, []);
  const [dayCount, setDayCount] = useState<number>(0);

  const [showSettings, setShowSettings] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [draftAudioUri, setDraftAudioUri] = useState<string | null>(null);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [draftDuration, setDraftDuration] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // last reflection Seen
  const [lastReflectionSeen, setLastReflectionSeen] = useState<string | null>(null);
  const [showReflectionToast, setShowReflectionToast] = useState(false);
  const [reflectionToastMessage, setReflectionToastMessage] = useState("");


  // Load user ID
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await getSupabase().auth.getUser();
      setUserId(data?.user?.id ?? null);
    };
    getUserId();
  }, []);

  // Load streak count
// Load streak (local calculation, instant + matches Journal)
useEffect(() => {
  if (!userId) return;

  const loadStreak = async () => {
    const { data: rows, error } = await getSupabase()
      .from("prayers")
      .select("prayed_at")
      .eq("user_id", userId)
      .order("prayed_at", { ascending: false });

    if (error || !rows) {
      setDayCount(0);
      return;
    }

    // Extract unique YYYY-MM-DD keys
    const allDates = Array.from(
      new Set(rows.map((p) => p.prayed_at.slice(0, 10)))
    );

    // Same logic as Journal
    const formatDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;

    let streak = 0;
    let day = new Date();

    while (true) {
      const key = formatDateKey(day);
      if (allDates.includes(key)) {
        streak++;
        day.setDate(day.getDate() - 1);
      } else {
        break;
      }
    }

    setDayCount(streak);
  };

  loadStreak();
}, [userId, prayState]);

  // 🔥 Load reminder setting whenever userId changes or settings modal closes
  useEffect(() => {
    if (!userId) return;

    const fetchSettings = async () => {
      const { data } = await getSupabase()
        .from("user_settings")
        .select("daily_reminder_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      setDailyReminderEnabled(data?.daily_reminder_enabled ?? false);
    };

    fetchSettings();
  }, [userId, showSettings]);

  // Transcript preview
  const transcriptPreview =
    draftTranscript ||
    "Thank you for this day and for all the blessings you've given me. I pray for strength and guidance as I face the challenges ahead.";

  // Halo animation
  const haloScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const startHalo = () => {
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1.15,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.15,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animationRef.current.start();
  };

  const stopHalo = () => {
    animationRef.current?.stop();
    haloOpacity.setValue(0);
    haloScale.setValue(1);
  };

  useEffect(() => {
    prayState === "recording" ? startHalo() : stopHalo();
  }, [prayState]);

  // Timer countdown
  useEffect(() => {
    if (prayState !== "recording") return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          stopRecordingAndProcess();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [prayState]);

  const formattedTime = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  // Permissions
  const requestMicPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Microphone access needed",
        "Please enable microphone access in Settings to record your prayers."
      );
      return false;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    return true;
  };

  // Start recording
  const startRecording = async () => {
    try {
      const ok = await requestMicPermission();
      if (!ok) return;

      // HARD reset audio session for iOS TestFlight reliability
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();

      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 1,
        },
      });

      await recording.startAsync();

      setRecording(recording);
      setSecondsLeft(MAX_SECONDS_DEFAULT);
      setPrayState("recording");
    } catch (e) {
      Alert.alert("Error", "Could not start recording.");
    }
  };

  // Stop + process
  const stopRecordingAndProcess = async () => {
    if (!recording) return;

    try {
      setIsProcessing(true);
      setPrayState("idle");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error("No recording URI");

      // --- FIXED: Always compute accurate duration by reloading file ---
      let durationSeconds: number | null = null;
      try {
        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );

        if (status.isLoaded && status.durationMillis) {
          durationSeconds = Math.round(status.durationMillis / 1000);
        }

        await sound.unloadAsync();
      } catch (e) {
        console.log("Failed to compute duration:", e);
      }

      if (!durationSeconds || durationSeconds < 1) {
        Alert.alert("Recording failed", "No audio was captured. Please try again.");
        return;
      }

      const transcript = await transcribeAudioWithWhisper(uri);

      setDraftAudioUri(uri);
      setDraftDuration(durationSeconds);
      setDraftTranscript(transcript || "");
      setIsBookmarked(false);
      setShowEditModal(true);
    } catch {
      Alert.alert("Error", "Failed to process prayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicPress = () => {
    if (isProcessing) return;
    prayState === "recording" ? stopRecordingAndProcess() : startRecording();
  };

  const transcribeAudioWithWhisper = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "prayer.m4a",
        type: "audio/m4a",
      } as any);

      const { data, error } = await getSupabase().functions.invoke("transcribe", {
        body: formData,
      });

      if (error || !data) {
        console.error("Transcription failed", error);
        return "";
      }

      return data.text || "";
    } catch (e) {
      console.error("Transcription exception", e);
      return "";
    }
  };

  const uploadAudioToSupabase = async (userId: string, uri: string) => {
    try {
      const fileExt = uri.split(".").pop() || "m4a";
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const binary = globalThis.atob
        ? globalThis.atob(base64)
        : Buffer.from(base64, "base64").toString("binary");

      const fileBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        fileBytes[i] = binary.charCodeAt(i);
      }

      const { data, error } = await getSupabase().storage
        .from("prayer-audio")
        .upload(filePath, fileBytes, {
          contentType: `audio/${fileExt}`,
          upsert: false,
        });

      if (error) return null;
      return data.path;
    } catch {
      return null;
    }
  };

  const handleSavePrayer = async (
    opts?: { isBookmarked?: boolean }
  ) => {
    if (!userId || !draftAudioUri) {
      return Alert.alert("Error", "Missing recording.");
    }

    try {
      setIsProcessing(true);

      const storagePath = await uploadAudioToSupabase(userId, draftAudioUri);
      if (!storagePath) throw new Error("Upload failed");

      const bookmarkToSave = opts?.isBookmarked ?? isBookmarked;

      const { data: insertedPrayer, error: insertError } = await getSupabase()
        .from("prayers")
        .insert([
          {
            user_id: userId,
            prayed_at: new Date().toISOString(),
            transcript_text: draftTranscript || null,
            duration_seconds: draftDuration ?? null,
            audio_path: storagePath,
          },
        ])
        .select()
        .single();

      if (bookmarkToSave && insertedPrayer?.id) {
        const { error: bookmarkError } = await getSupabase()
          .from("bookmarked_prayers")
          .insert({
            user_id: userId,
            prayer_id: insertedPrayer.id,
          });

        if (bookmarkError) throw bookmarkError;
      }

      if (insertError) throw insertError;

      // Reset draft state for the next prayer
      setShowEditModal(false);
      setDraftAudioUri(null);
      setDraftTranscript("");
      setDraftDuration(null);
      setIsBookmarked(false);

      setPrayState("saved");
      // Auto-dismiss Prayer Saved card after 3s
      if (prayerSavedTimeoutRef.current) clearTimeout(prayerSavedTimeoutRef.current);
      prayerSavedTimeoutRef.current = setTimeout(() => {
        setPrayState("idle");
      }, 3000);

      // Show Day X complete toast only once per calendar day, if not showing milestone modal
      try {
        const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const lastToastDate = await AsyncStorage.getItem("last_prayer_toast_date");
        if (lastToastDate !== todayKey && !milestoneModalVisible) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
          await AsyncStorage.setItem("last_prayer_toast_date", todayKey);
        }
      } catch (e) {
        // fallback: show toast as before if AsyncStorage fails
        if (!milestoneModalVisible) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      }
      // NOTE: If you open a PrayerEntryModal or otherwise use the saved prayer,
      // use savedPrayerForUI (which always has signed_audio_url)
      // e.g. router.push({ pathname: ..., params: { ...savedPrayerForUI } });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save prayer.");
    } finally {
      setIsProcessing(false);
    }
  };
  // ---- Milestone detection (component-level, valid hook usage) ----
  useEffect(() => {
    if (!userId) return;
    if (milestoneCheckRef.current) return;
    if (prayState !== "saved") return;

    milestoneCheckRef.current = true;

    const checkMilestones = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lastCheck = await AsyncStorage.getItem("milestone_check_date");
      if (lastCheck === today) return;

      const { data: unlockedRows } = await getSupabase()
        .from("milestones_unlocked")
        .select("milestone_key")
        .eq("user_id", userId);

      const unlockedIds = new Set(unlockedRows?.map((r) => r.milestone_key));

      const newlyUnlocked = MILESTONES.find(
        (m) => dayCount >= m.requiredStreak && !unlockedIds.has(m.key)
      );

      if (!newlyUnlocked) {
        await AsyncStorage.setItem("milestone_check_date", today);
        return;
      }

      await getSupabase()
        .from("milestones_unlocked")
        .insert({
          user_id: userId,
          milestone_key: newlyUnlocked.key,
          streak_at_unlock: dayCount,
        });

      setUnlockedMilestone(newlyUnlocked);
      setMilestoneModalVisible(true);

      await AsyncStorage.setItem("milestone_check_date", today);
    };

    checkMilestones();
  }, [userId, prayState, dayCount]);

  useEffect(() => {
    if (prayState === "idle") {
      milestoneCheckRef.current = false;
    }
  }, [prayState]);

  const handleDiscardDraft = () => {
    setShowEditModal(false);
    setDraftAudioUri(null);
    setDraftTranscript("");
    setDraftDuration(null);
    setPrayState("idle");
    setIsBookmarked(false);
  };

  // Greeting + date
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const today = useMemo(() => {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  }, []);

  // UI ------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.textSecondary + "33" },
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

        {/* Settings */}
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Ionicons
            name="settings-outline"
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.subHeader}>
        {/*<Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {greeting}, Friend
        </Text>*/}
        <Text style={[styles.date, { color: colors.textSecondary }]}>
          {today}
        </Text>
      </View> 

      {/* Main */}
      <View style={styles.main}>
        <View style={styles.micContainer}>
          {/* Halo pulse */}
          <Animated.View
            style={[
              styles.halo,
              {
                backgroundColor: colors.accent,
                transform: [{ scale: haloScale }],
                opacity: haloOpacity,
              },
            ]}
          />

          {/* Mic button */}
          <TouchableOpacity
            style={[styles.micButton, { backgroundColor: colors.accent }]}
            onPress={handleMicPress}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#000" />
            ) : prayState === "recording" ? (
              <View style={[styles.stopSquare, { backgroundColor: "#000" }]} />
            ) : (
              <Ionicons name="mic-outline" size={32} color="#000" />
            )}
          </TouchableOpacity>

          {prayState === "recording" ? (
            <View style={styles.timerWrapper}>
              <View
                style={[styles.timerCircle, { borderColor: colors.accent }]}
              >
                <View style={styles.redDot} />
                <Text
                  style={[styles.timerText, { color: colors.textSecondary }]}
                >
                  {formattedTime}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Tap and begin your prayer.
            </Text>
          )}
        </View>

        {/* Saved UI */}
        {prayState === "saved" && (
          <View style={styles.savedSection}>
            <View
              style={[
                styles.savedCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.accent + "33",
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <View>
                <Text
                  style={[styles.savedTitle, { color: colors.textPrimary }]}
                >
                  Prayer Saved
                </Text>
                <Text
                  style={[
                    styles.savedSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Your words have been preserved in your Journal.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Daily Reminder CTA — hidden once enabled */}
        {!dailyReminderEnabled && (
          <TouchableOpacity
            style={styles.reminderRow}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons
              name="notifications-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
              Set daily reminder
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toast */}
      {showToast && (
        <View style={[styles.toast, { backgroundColor: colors.card }]}>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={[styles.toastText, { color: colors.textPrimary }]}>
            Day {dayCount} complete ⚡️
          </Text>
        </View>
      )}

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        userId={userId}
      />

      {/* Transcript Edit Modal */}
      <TranscriptEditor
        visible={showEditModal}
        transcript={draftTranscript}
        onChangeText={setDraftTranscript}
        onSave={handleSavePrayer}
        onDiscard={handleDiscardDraft}
        loading={isProcessing}
        isBookmarked={isBookmarked}
        onToggleBookmark={() => setIsBookmarked((v) => !v)}
      />

      {/* Milestone Modal */}
      <MilestoneModal
        visible={milestoneModalVisible}
        milestone={unlockedMilestone}
        onClose={() => {
          setMilestoneModalVisible(false);
          setUnlockedMilestone(null);
        }}
        onViewTimeline={async () => {
          setMilestoneModalVisible(false);
          setUnlockedMilestone(null);
          router.replace("/(tabs)/journal");
          await AsyncStorage.setItem("open_milestone_timeline", "true");
        }}
      />
    </SafeAreaView>
  );
}

// Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftHeader: { flexDirection: "row", alignItems: "center" },

  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },

  subHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  date: {
    fontFamily: fonts.body,
    fontSize: 14,
  },

  main: { flex: 1, alignItems: "center", justifyContent: "flex-start" },

  // Lowered Mic button
  micContainer: {
    alignItems: "center",
    marginTop: spacing.xl * 5.5,
  },

  halo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },

  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
  },
  stopSquare: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },

  hint: {
    marginTop: spacing.xl,
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 16,
  },

  timerWrapper: { marginTop: spacing.lg },
  timerCircle: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E45858",
    marginRight: 8,
  },
  timerText: {
    fontFamily: fonts.body,
    fontSize: 16,
  },

  savedSection: {
    width: "100%",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  savedCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  savedTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
  },
  savedSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
  },

  transcriptCard: { borderRadius: 16, padding: spacing.md },
  transcriptLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 4,
  },
  transcriptText: { fontFamily: fonts.body, fontSize: 14 },
  transcriptLink: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: spacing.xs,
  },

  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  reminderText: {
    marginLeft: 8,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: {
    marginLeft: 8,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});