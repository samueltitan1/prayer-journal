import type { MilestoneConfig } from "@/app/constants/milestonesConfig";
import { MILESTONES } from "@/app/constants/milestonesConfig";
import NetInfo from "@react-native-community/netinfo";
import MilestoneModal from "../../../components/MilestoneModal";
import { enqueuePrayer, getQueuedCount, syncQueuedPrayers } from "../../../lib/offlineQueue";
// app/(tabs)/pray/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
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
      if (syncBannerTimeoutRef.current) clearTimeout(syncBannerTimeoutRef.current);
    };
  }, []);
  const [dayCount, setDayCount] = useState<number>(0);

  const [showSettings, setShowSettings] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const isUnlockingRef = useRef(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineQueuedCount, setOfflineQueuedCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const syncBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSyncBanner = (msg: string, ms = 3500) => {
    setSyncBanner(msg);
    if (syncBannerTimeoutRef.current) clearTimeout(syncBannerTimeoutRef.current);
    syncBannerTimeoutRef.current = setTimeout(() => setSyncBanner(null), ms);
  };

  const isSyncingOfflineRef = useRef(false);



  const [draftAudioUri, setDraftAudioUri] = useState<string | null>(null);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [draftDuration, setDraftDuration] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [keepAudio, setKeepAudio] = useState(true);
  const [editorMode, setEditorMode] = useState<"audio" | "text">("audio");


  // Load user ID
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await getSupabase().auth.getUser();
      setUserId(data?.user?.id ?? null);
    };
    getUserId();
  }, []);
  
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(Boolean(hasHardware && enrolled));
      } catch {
        setBiometricSupported(false);
      }
    })();
  }, [userId]);
  
  const refreshOfflineCount = async (uid?: string | null) => {
    if (!uid) {
      setOfflineQueuedCount(0);
      return;
    }

    try {
      const c = await getQueuedCount(uid);
      setOfflineQueuedCount(c);
    } catch {
      setOfflineQueuedCount(0);
    }
  };

  useEffect(() => {
    refreshOfflineCount(userId);
  }, [userId, prayState]);

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
        .select("daily_reminder_enabled, biometric_lock_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      setDailyReminderEnabled(data?.daily_reminder_enabled ?? false);
      setBiometricLockEnabled(data?.biometric_lock_enabled ?? false);
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
      setKeepAudio(true);
      setEditorMode("audio");
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

  const trySyncOfflineQueue = useCallback(async () => {
    if (!userId) return;
    if (isSyncingOfflineRef.current) return;
  
    isSyncingOfflineRef.current = true;
    setIsSyncingOffline(true);
  
    try {
      const count = await getQueuedCount(userId);
      if (!count) {
        setOfflineQueuedCount(0);
        return;
      }
  
      const res = await syncQueuedPrayers({
        userId,
        supabase: getSupabase(),
        uploadAudio: uploadAudioToSupabase,
        onProgress: ({ remaining }) => setOfflineQueuedCount(Math.max(0, remaining)),
      });
      
      await refreshOfflineCount(userId);
      
      if (res.synced > 0) {
        showSyncBanner(`Uploaded ${res.synced} queued prayer${res.synced === 1 ? "" : "s"}.`);
      }
      if (res.failed > 0) {
        showSyncBanner(`Some prayers couldn’t upload yet — we’ll keep retrying.`, 4500);
      }
    } catch {
      // Keep queued items for later
    } finally {
      isSyncingOfflineRef.current = false;
      setIsSyncingOffline(false);
    }
  }, [userId]);
  
  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricLockEnabled) {
      setIsLocked(false);
      return true;
    }
    if (!biometricSupported) {
      // fail-open so you don’t brick users if biometrics gets disabled on device
      setIsLocked(false);
      return true;
    }
    if (isUnlockingRef.current) return false;
  
    isUnlockingRef.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Prayer Journal",
        fallbackLabel: "Use Passcode",
      });
  
      if (res.success) {
        setIsLocked(false);
        return true;
      }
  
      setIsLocked(true);
      return false;
    } catch {
      setIsLocked(true);
      return false;
    } finally {
      isUnlockingRef.current = false;
    }
  }, [biometricLockEnabled, biometricSupported]);

  // Sync any queued prayers as soon as the userId is available (screen mount/app open)
  useEffect(() => {
    if (!userId) return;
  
    if (biometricLockEnabled) {
      setIsLocked(true);
      unlockWithBiometrics();
    }
  
    trySyncOfflineQueue();
  }, [userId, trySyncOfflineQueue, biometricLockEnabled, unlockWithBiometrics]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (biometricLockEnabled) {
          setIsLocked(true);
          unlockWithBiometrics();
        }
        trySyncOfflineQueue();
      }
    });
  
    return () => {
      sub.remove();
    };
  }, [userId, trySyncOfflineQueue, biometricLockEnabled, unlockWithBiometrics]);

  useEffect(() => {
    if (!userId) return;
  
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null; treat "not false" as acceptable.
      if (state.isConnected && state.isInternetReachable !== false) {
        trySyncOfflineQueue();
      }
    });
  
    return () => unsubscribe();
  }, [userId, trySyncOfflineQueue]);

  
  
  const handleSavePrayer = async (opts?: { isBookmarked?: boolean; keepAudio?: boolean }) => {
    if (!userId) {
      return Alert.alert("Error", "Missing user.");
    }
    
    const keepAudioToSave = opts?.keepAudio ?? keepAudio;
    
    // Audio mode: must have a recording
    if (editorMode === "audio" && !draftAudioUri) {
      return Alert.alert("Error", "Missing recording.");
    }
    
    // Text mode: must have some text
    if (editorMode === "text" && !draftTranscript.trim()) {
      return Alert.alert("Nothing to save", "Write something before saving.");
    }

    const bookmarkToSave = opts?.isBookmarked ?? isBookmarked;
    const prayedAtISO = new Date().toISOString();

    try {
      setIsProcessing(true);

      // Try online-first
      try {
        const storagePath =
          editorMode === "audio" && keepAudioToSave && draftAudioUri
            ? await uploadAudioToSupabase(userId, draftAudioUri)
            : null;

        if (editorMode === "audio" && keepAudioToSave && !storagePath) {
          throw new Error("Upload failed");
        }
        const { data: insertedPrayer, error: insertError } = await getSupabase()
          .from("prayers")
          .insert([
            {
              user_id: userId,
              prayed_at: prayedAtISO,
              transcript_text: draftTranscript || null,
              duration_seconds: draftDuration ?? null,
              audio_path: storagePath,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        if (bookmarkToSave && insertedPrayer?.id) {
          const { error: bookmarkError } = await getSupabase()
            .from("bookmarked_prayers")
            .insert({
              user_id: userId,
              prayer_id: insertedPrayer.id,
            });

          if (bookmarkError) throw bookmarkError;
        }

        // If we saved online, opportunistically flush any offline queue
        trySyncOfflineQueue();
      } catch (e: any) {
        // Offline fallback: queue locally, keep same success UX
        await enqueuePrayer({
          userId,
          prayedAtISO,
          transcriptText: draftTranscript || null,
          durationSeconds: draftDuration ?? null,
          isBookmarked: bookmarkToSave,
          audioUri: editorMode === "audio" && keepAudioToSave ? draftAudioUri : null,
        });
        await refreshOfflineCount(userId);
        showSyncBanner("We’ll retry uploading your prayer when you’re online.");
        console.log("Saved offline (queued):", e?.message || e);
      }
      try {
        if (biometricSupported && !biometricLockEnabled) {
          const prompted = await AsyncStorage.getItem("biometric_lock_prompted");
          if (!prompted) {
            await AsyncStorage.setItem("biometric_lock_prompted", "true");
      
            Alert.alert(
              "Lock Prayer Journal?",
              "Want to protect your prayers with Face ID / Touch ID?",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Enable",
                  onPress: async () => {
                    try {
                      const auth = await LocalAuthentication.authenticateAsync({
                        promptMessage: "Enable Face ID / Touch ID",
                        fallbackLabel: "Use Passcode",
                      });
                      if (!auth.success) return;
      
                      setBiometricLockEnabled(true);
                      await getSupabase().from("user_settings").upsert({
                        user_id: userId,
                        biometric_lock_enabled: true,
                      });
                    } catch {
                      // ignore
                    }
                  },
                },
              ]
            );
          }
        }
      } catch {
        // ignore
      }

      // Reset draft state for the next prayer
      setShowEditModal(false);
      setDraftAudioUri(null);
      setDraftTranscript("");
      setDraftDuration(null);
      setIsBookmarked(false);
      setKeepAudio(true);

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
      } catch {
        if (!milestoneModalVisible) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save prayer.");
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
    setKeepAudio(true);
  };
  
  const handleOpenTextEntry = () => {
    setEditorMode("text");
    setShowEditModal(true);
    setDraftAudioUri(null);
    setDraftDuration(null);
    setDraftTranscript("");
    setIsBookmarked(false);
    setKeepAudio(true);
    setPrayState("idle");
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
  if (isLocked) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={28} color={colors.textPrimary} />
        <Text
          style={{
            marginTop: spacing.md,
            fontFamily: fonts.heading,
            fontSize: 18,
            color: colors.textPrimary,
          }}
        >
          Locked
        </Text>
        <Text
          style={{
            marginTop: spacing.xs,
            marginHorizontal: spacing.xl,
            textAlign: "center",
            fontFamily: fonts.body,
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          Unlock with Face ID / Touch ID to continue.
        </Text>
  
        <TouchableOpacity
          style={{
            marginTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            backgroundColor: colors.accent,
          }}
          onPress={unlockWithBiometrics}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: fonts.heading, color: "#000" }}>Unlock</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
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
        {syncBanner && (
          <View style={[styles.syncBanner, { backgroundColor: colors.card, borderColor: colors.textSecondary + "22" }]}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.syncBannerText, { color: colors.textPrimary }]}>{syncBanner}</Text>
          </View>
        )}
        {offlineQueuedCount > 0 && (
          <Text style={[styles.offlineHint, { color: colors.textSecondary }]}>
            {offlineQueuedCount} prayer{offlineQueuedCount === 1 ? "" : "s"} queued — will sync when online
          </Text>
        )}
        <TouchableOpacity
          style={[styles.writeFab, { backgroundColor: colors.card }]}
          onPress={handleOpenTextEntry}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={22} color={colors.accent} 
          style={{ marginBottom: 3, marginLeft: 3 }} // tiny visual nudge
          />
        </TouchableOpacity>
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
        mode={editorMode}
        transcript={draftTranscript}
        onChangeText={setDraftTranscript}
        onSave={handleSavePrayer}
        onDiscard={handleDiscardDraft}
        loading={isProcessing}
        isBookmarked={isBookmarked}
        onToggleBookmark={() => setIsBookmarked((v) => !v)}
        keepAudio={keepAudio}
        onToggleKeepAudio={() => setKeepAudio((v) => !v)}
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
  offlineHint: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    opacity: 0.8,
  },
  writeFab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg * 1,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  syncBanner: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncBannerText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});