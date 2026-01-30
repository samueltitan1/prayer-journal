import type { MilestoneConfig } from "@/app/constants/milestonesConfig";
import { MILESTONES } from "@/app/constants/milestonesConfig";
import NetInfo from "@react-native-community/netinfo";
import MilestoneModal from "../../../components/MilestoneModal";
import { enqueueAttachment, enqueuePrayer, getQueuedAttachmentsCount, getQueuedCount, syncQueuedPrayers } from "../../../lib/offlineQueue";
// app/(tabs)/pray/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as LocalAuthentication from "expo-local-authentication";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

import SecurityNoticeModal, { shouldShowSecurityNotice } from "@/components/SecurityNoticeModal";
import SettingsModal from "../../../components/SettingsModal";
import TranscriptEditor from "../../../components/TranscriptEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { getDailyPrayerReminderStatus } from "../../../lib/notifications";
import { capture } from "../../../lib/posthog";
import { getSupabase } from "../../../lib/supabaseClient";
import { fonts, spacing } from "../../../theme/theme";

type PrayState = "idle" | "recording" | "saved";
const MAX_SECONDS_DEFAULT = 10 * 60;
const MAX_PHOTOS_PER_PRAYER = 4;
const WALK_MAP_WIDTH = 640;
const WALK_MAP_HEIGHT = 400;
const WALK_NOTICE_KEY = "walk_mode_notice_v1";

const makePrayerId = () => uuidv4();

// expo-image-picker changed `mediaTypes` API across versions.
// Use a runtime-safe value that works on older + newer versions.
const IMAGE_MEDIA_TYPES: any = (ImagePicker as any)?.MediaType?.Images
  ? [(ImagePicker as any).MediaType.Images]
  : ImagePicker.MediaTypeOptions.Images;

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

  // --- Security Notice modal state ---
  const [securityNoticeVisible, setSecurityNoticeVisible] = useState(false);
  const pendingStartAfterNotice = useRef<null | (() => void)>(null);

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
  const isLockedRef = useRef(false);
  const didInitialBiometricCheckForUserRef = useRef<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineQueuedCount, setOfflineQueuedCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const syncBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [offlineQueuedAttachmentsCount, setOfflineQueuedAttachmentsCount] = useState(0);
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
  // --- NEW: Bible enrichment draft state ---
  const [entrySource, setEntrySource] = useState<"audio" | "text" | "ocr" | "walk">("audio");
  const [draftBibleRef, setDraftBibleRef] = useState<string | null>(null);
  const [draftBibleVersion, setDraftBibleVersion] = useState<string | null>(null);
  const [draftBibleProvider, setDraftBibleProvider] = useState<string | null>("manual");
  // Verse editor state
  const [isVerseEditorOpen, setIsVerseEditorOpen] = useState(false);
  const [verseDraftRef, setVerseDraftRef] = useState("");
  const [verseDraftVersion, setVerseDraftVersion] = useState("");
  const [draftPhotoUris, setDraftPhotoUris] = useState<string[]>([]);
  const [draftLocationName, setDraftLocationName] = useState<string | null>(null);
  const [walkNoticeVisible, setWalkNoticeVisible] = useState(false);
  const [walkDontShowAgain, setWalkDontShowAgain] = useState(false);
  const [walkElapsedSeconds, setWalkElapsedSeconds] = useState(0);

  // ---- Prayer Walk state ----
  const [isWalking, setIsWalking] = useState(false);
  const [walkStartAt, setWalkStartAt] = useState<number | null>(null);
  const [walkCoords, setWalkCoords] = useState<Array<{ latitude: number; longitude: number; timestamp: number }>>([]);
  const walkCoordsRef = useRef<Array<{ latitude: number; longitude: number; timestamp: number }>>([]);
  const walkNoCoordsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const walkRecordingRef = useRef<Audio.Recording | null>(null);
  const walkLocationSubRef = useRef<Location.LocationSubscription | null>(null);
  const stopWalkInFlightRef = useRef(false);
  const [walkMapWarning, setWalkMapWarning] = useState(false);
  const [walkMapUri, setWalkMapUri] = useState<string | null>(null);
  const [mapSnapshotVisible, setMapSnapshotVisible] = useState(false);
  const [mapSnapshotCoords, setMapSnapshotCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const mapSnapshotResolveRef = useRef<null | ((uri: string | null) => void)>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const mapSnapshotInFlightRef = useRef(false);

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
      setOfflineQueuedAttachmentsCount(0);
      return;
    }
  
    try {
      setOfflineQueuedCount(await getQueuedCount(uid));
    } catch {
      setOfflineQueuedCount(0);
    }
  
    try {
      setOfflineQueuedAttachmentsCount(await getQueuedAttachmentsCount(uid));
    } catch {
      setOfflineQueuedAttachmentsCount(0);
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
      const { data, error } = await getSupabase()
        .from("user_settings")
        .select("daily_reminder_enabled, reminder_time, biometric_lock_enabled")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If DB read fails, fall back to on-device schedule status
      if (error) {
        const status = await getDailyPrayerReminderStatus();
        setDailyReminderEnabled(Boolean(status.enabled));
        return;
      }

      const dbDailyEnabled = data?.daily_reminder_enabled ?? false;
      const dbReminderTime = (data as any)?.reminder_time ?? null;

      setBiometricLockEnabled(data?.biometric_lock_enabled ?? false);

      // If DB says OFF but a reminder is actually scheduled on-device,
      // treat it as enabled and backfill the DB so the CTA doesn't show.
      if (!dbDailyEnabled) {
        const status = await getDailyPrayerReminderStatus();
        if (status.enabled) {
          setDailyReminderEnabled(true);

          // Best-effort backfill so future loads/devices are consistent
          try {
            const payload: any = {
              user_id: userId,
              daily_reminder_enabled: true,
            };

            // Only write reminder_time if we actually know it.
            // Never overwrite an existing DB value with null.
            if (status.time) {
              payload.reminder_time = status.time;
            }

            try {
              await getSupabase().from("user_settings").upsert(payload, { onConflict: "user_id" });
            } catch {
              // ignore
            }
          } catch {
            // ignore
          }

          return;
        }
      }

      setDailyReminderEnabled(dbDailyEnabled);
    };

    fetchSettings();
  }, [userId, showSettings]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    if (!isWalking) return;
    const interval = setInterval(() => {
      if (!walkStartAt) return;
      setWalkElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - walkStartAt) / 1000))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [isWalking, walkStartAt]);

  const b64ToBytes = (b64: string) => {
    // atob exists in RN; this fallback prevents edge cases.
    const binary =
      (globalThis as any).atob ? (globalThis as any).atob(b64) : Buffer.from(b64, "base64").toString("binary");
  
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };


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

  const formattedWalkTime = useMemo(() => {
    const m = Math.floor(walkElapsedSeconds / 60);
    const s = (walkElapsedSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [walkElapsedSeconds]);

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
      staysActiveInBackground: true,
      interruptionModeIOS: (Audio as any).InterruptionModeIOS?.DoNotMix ?? 1,
      interruptionModeAndroid: (Audio as any).InterruptionModeAndroid?.DoNotMix ?? 1,
      shouldDuckAndroid: true,
    });

    return true;
  };

  const shouldShowWalkNotice = async () => {
    const v = await AsyncStorage.getItem(WALK_NOTICE_KEY);
    return v !== "true";
  };

  const requestLocationPermission = async () => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    console.log("walk:servicesEnabled", servicesEnabled);
    if (!servicesEnabled) {
      Alert.alert(
        "Turn on Location Services",
        "Location Services are off. Please enable them in iOS Settings to use Prayer Walk."
      );
      return false;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("walk:permission", status);
    if (status !== "granted") {
      Alert.alert(
        "Location permission required",
        "Prayer Walk needs your location to draw your route. Please enable location services to continue."
      );
      return false;
    }
    return true;
  };

  const computeZoomForSpan = (span: number) => {
    if (span < 0.005) return 16;
    if (span < 0.01) return 15;
    if (span < 0.02) return 14;
    if (span < 0.05) return 13;
    if (span < 0.1) return 12;
    if (span < 0.2) return 11;
    return 10;
  };

  const computeRegionForCoords = (coords: Array<{ latitude: number; longitude: number }>) => {
    const lats = coords.map((c) => c.latitude);
    const lons = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
  
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
  
    // padding
    const latDelta = Math.max(0.003, (maxLat - minLat) * 1.6);
    const lonDelta = Math.max(0.003, (maxLon - minLon) * 1.6);
  
    return { latitude: centerLat, longitude: centerLon, latitudeDelta: latDelta, longitudeDelta: lonDelta };
  };
  
  const takeRouteMapSnapshot = async (
    coords: Array<{ latitude: number; longitude: number }>
  ): Promise<string | null> => {
    if (!coords || coords.length < 1) return null;
    if (mapSnapshotInFlightRef.current) return null;
  
    mapSnapshotInFlightRef.current = true;
  
    return new Promise<string | null>((resolve) => {
      mapSnapshotResolveRef.current = (uri) => {
        mapSnapshotInFlightRef.current = false;
        resolve(uri);
      };
  
      setMapSnapshotCoords(coords);
      setMapSnapshotVisible(true);
  
      // hard timeout (never hang stopWalk)
      setTimeout(() => {
        if (mapSnapshotResolveRef.current) {
          setMapSnapshotVisible(false);
          mapSnapshotResolveRef.current?.(null);
          mapSnapshotResolveRef.current = null;
        }
      }, 10000);
    });
  };

  const isExpoGo = Constants.appOwnership === "expo"; // (info only) map generation works in Expo Go too
  

  const startWalk = async () => {
    if (isWalking || isProcessing || prayState === "recording") return;
    if (!userId) {
      Alert.alert("Error", "Missing user.");
      return;
    }

    const micOk = await requestMicPermission();
    if (!micOk) return;

    const locOk = await requestLocationPermission();
    if (!locOk) return;

    setIsProcessing(true);
    setWalkCoords([]);
    setWalkStartAt(Date.now());
    setWalkElapsedSeconds(0);

    try {
      let initialPoint: { latitude: number; longitude: number; timestamp: number } | null = null;
      try {
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        console.log(
          "walk:firstFix",
          first.coords.latitude,
          first.coords.longitude,
          first.timestamp
        );
        initialPoint = {
          latitude: first.coords.latitude,
          longitude: first.coords.longitude,
          timestamp: first.timestamp ?? Date.now(),
        };
      } catch {
        Alert.alert(
          "Couldn’t get your location",
          "We couldn't get a GPS fix. Please check Location Services and try again."
        );
        setIsWalking(false);
        try {
          deactivateKeepAwake();
        } catch {}
        return;
      }

      try {
        await activateKeepAwakeAsync();
      } catch {}

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
      walkRecordingRef.current = recording;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
        },
        (pos) => {
          const next = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: pos.timestamp ?? Date.now(),
          };
        
          console.log("walk:coord", next.latitude, next.longitude, next.timestamp);
        
          // Update ref FIRST so any timers read the latest points immediately
          const prev = walkCoordsRef.current;
          const last = prev[prev.length - 1];
        
          if (last && last.latitude === next.latitude && last.longitude === next.longitude) {
            return;
          }
        
          const updated = [...prev, next];
          walkCoordsRef.current = updated;
          setWalkCoords(updated);
        }
      );
      walkLocationSubRef.current = sub;
      console.log("walk:watcherStarted");

      if (initialPoint) {
        const prev = walkCoordsRef.current;
        const last = prev[prev.length - 1];

        // If watcher already emitted a point, don't overwrite it.
        // Also, if the watcher point is identical to initialPoint, keep just one.
        const isSameAsLast =
          !!last && last.latitude === initialPoint.latitude && last.longitude === initialPoint.longitude;

        const next = prev.length === 0 ? [initialPoint] : isSameAsLast ? prev : [initialPoint, ...prev];
        walkCoordsRef.current = next;
        setWalkCoords(next);
      }

      setIsWalking(true);
      if (walkNoCoordsTimeoutRef.current) clearTimeout(walkNoCoordsTimeoutRef.current);
      walkNoCoordsTimeoutRef.current = setTimeout(() => {
        // GPS can take a while to produce movement-based points (especially if you're stationary or indoors).
        if (walkCoordsRef.current.length < 1) {
          Alert.alert(
            "Route tracking unavailable",
            "We couldn't collect enough route points yet. Keep walking for a bit (preferably outdoors) and make sure Location Services are enabled."
          );
        }
      }, 30000);
    } catch {
      Alert.alert("Error", "Could not start prayer walk.");
      walkRecordingRef.current = null;
      try {
        deactivateKeepAwake();
      } catch {}
    } finally {
      setIsProcessing(false);
    }
  };

  const startWalkWithNotice = async () => {
    const shouldShow = await shouldShowWalkNotice();
    if (shouldShow) {
      setWalkNoticeVisible(true);
      return;
    }
    await startWalk();
  };

  const stopWalk = async () => {
    if (!isWalking) return;
    if (stopWalkInFlightRef.current) return;
    stopWalkInFlightRef.current = true;

    // Capture start time before we clear state
    const startedAt = walkStartAt;

    // Stop walk UI/timer immediately (don't wait for transcription/map generation)
    setIsWalking(false);
    setWalkStartAt(null);
    setWalkElapsedSeconds(0);

    setIsProcessing(true);

    // Stop tracking immediately
    try {
      walkLocationSubRef.current?.remove();
    } catch {}
    walkLocationSubRef.current = null;
    if (walkNoCoordsTimeoutRef.current) clearTimeout(walkNoCoordsTimeoutRef.current);

    try {
      console.log("walk:tracking stopped");

      const recording = walkRecordingRef.current;
      walkRecordingRef.current = null;

      let transcript = "";
      let localAudioUri: string | null = null;
      if (recording) {
        await recording.stopAndUnloadAsync();
        localAudioUri = recording.getURI();
        if (localAudioUri) {
          transcript = await transcribeAudioWithWhisper(localAudioUri);
          try {
            await FileSystem.deleteAsync(localAudioUri, { idempotent: true });
          } catch {}
        }
      }

      let coordsSnapshot = walkCoordsRef.current.slice();
      if (coordsSnapshot.length < 2) {
        try {
          const extra = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          coordsSnapshot = [
            ...coordsSnapshot,
            {
              latitude: extra.coords.latitude,
              longitude: extra.coords.longitude,
              timestamp: extra.timestamp ?? Date.now(),
            },
          ];
        } catch {}
      }
      if (coordsSnapshot.length < 1) {
        Alert.alert(
          "Route tracking limited",
          "We couldn’t collect a location point for your walk. Please ensure location services are enabled."
        );
      }
      let mapUri: string | null = null;
      try {
        mapUri = await takeRouteMapSnapshot(
          coordsSnapshot.map((c) => ({ latitude: c.latitude, longitude: c.longitude }))
        );
      } catch {
        mapUri = null;
      }
      if (mapUri) {
        console.log("walk:mapUri", mapUri);
      }
      if (!mapUri) {
        console.log("walk:mapUri is null (map download failed or no writable directory)");
      }
      const durationSeconds = startedAt
        ? Math.round((Date.now() - startedAt) / 1000)
        : null;

      if (!mapUri) {
        showSyncBanner("Route map couldn’t be generated — you can still save your prayer.", 4500);
      }

      setEditorMode("text");
      setEntrySource("walk");
      setDraftTranscript(transcript || "");
      setDraftAudioUri(null);
      setDraftDuration(durationSeconds);
      setKeepAudio(false);
      setIsBookmarked(false);
      setDraftBibleRef(null);
      setDraftBibleVersion(null);
      setDraftBibleProvider("manual");
      setDraftLocationName(null);
      setDraftPhotoUris([]);
      setIsVerseEditorOpen(false);
      setWalkMapUri(mapUri);
      setVerseDraftRef("");
      setVerseDraftVersion("");
      setIsProcessing(false);
      setShowEditModal(true);
    } catch {
      Alert.alert("Error", "Could not finalize prayer walk.");
    } finally {
      stopWalkInFlightRef.current = false;
      try {
        deactivateKeepAwake();
      } catch {}
      setWalkCoords([]);
      setIsProcessing(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const ok = await requestMicPermission();
      if (!ok) return;
      setWalkMapUri(null);
      // HARD reset audio session for iOS TestFlight reliability
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      // Keep the screen awake while recording so the phone doesn't sleep mid-prayer.
      try {
        await activateKeepAwakeAsync();
      } catch {}
      
      const recording = new Audio.Recording();

      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 64000,
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
      setEntrySource("audio");
      setDraftBibleRef(null);
      setDraftBibleVersion(null);
      setDraftBibleProvider("manual");
      setDraftPhotoUris([]);
      setShowEditModal(true);
      setDraftLocationName(null);
    } catch {
      Alert.alert("Error", "Failed to process prayer.");
    } finally {
      // Keep the screen awake while recording so the phone doesn't sleep mid-prayer.
      try {
        deactivateKeepAwake();
      } catch {}
      setIsProcessing(false);
    }
  };

  const startRecordingWithSecurityNotice = async () => {
    // If we are already recording, behave like the stop button
    if (prayState === "recording") {
      stopRecordingAndProcess();
      return;
    }
  
    // If processing, do nothing
    if (isProcessing) return;
  
    // Show security notice only when needed
    const shouldShow = await shouldShowSecurityNotice();
    if (shouldShow) {
      pendingStartAfterNotice.current = () => {
        // fire-and-forget so modal close isn't blocked
        void startRecording();
      };
      setSecurityNoticeVisible(true);
      return;
    }
  
    // Otherwise record immediately
    await startRecording();
  };
  
  const handleMicPress = () => {
    if (isWalking) {
      void stopWalk();
      return;
    }
    void startRecordingWithSecurityNotice();
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

      const res = await fetch(uri);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);

      const { data, error } = await getSupabase().storage
        .from("prayer-audio")
        .upload(filePath, bytes, {
          contentType: `audio/${fileExt}`,
          upsert: false,
        });

      if (error) return null;
      return data.path;
    } catch {
      return null;
    }
  };

  const uploadImageToSupabase = async (userId: string, prayerId: string, uri: string) => {
    try {
      const extFromUri = uri.split("?")[0].split("#")[0].split(".").pop();
      const fileExt = (extFromUri || "jpg").toLowerCase();
      const contentType = fileExt === "png" ? "image/png" : "image/jpeg";

      const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${
        fileExt === "png" ? "png" : "jpg"
      }`;
      const filePath = `${userId}/${prayerId}/${fileName}`;

      const res = await fetch(uri);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);

      const { data, error } = await getSupabase().storage
        .from("prayer-attachments")
        .upload(filePath, bytes, { contentType, upsert: false });

      if (error) return null;
      return data.path;
    } catch {
      return null;
    }
  };

  const uploadImagesInBackground = async (userId: string, prayerId: string, uris: string[]) => {
    for (const uri of uris) {
      try {
        const storagePath = await uploadImageToSupabase(userId, prayerId, uri);
        if (!storagePath) throw new Error("upload_failed");

        await getSupabase().from("prayer_attachments").insert({
          user_id: userId,
          prayer_id: prayerId,
          storage_path: storagePath,
          storage_bucket: "prayer-attachments",
        });
      } catch {
        // Enqueue failed image for retry (does NOT block prayer save)
        try {
          await enqueueAttachment({ userId, prayerId, imageUri: uri });
          await refreshOfflineCount(userId);
          showSyncBanner("Some photos couldn’t upload — we’ll retry when you’re online.", 4500);
        } catch {
          // last resort: swallow
        }
      }
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
  
      if (!res.success) {
        // If user cancelled, don't immediately re-prompt via app-state bounces.
        // Keep locked, but avoid auto re-trigger loops feeling aggressive.
        if (res.error === "user_cancel" || res.error === "system_cancel") {
          setIsLocked(true);
          return false;
        }
      
        setIsLocked(true);
        return false;
      }
  
      setIsLocked(false);
      return true;
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
  
    // Run the biometric gate once per signed-in user per app run.
    // Prevents repeated prompts caused by dependency changes (e.g. biometricSupported resolving).
    if (biometricLockEnabled && didInitialBiometricCheckForUserRef.current !== userId) {
      didInitialBiometricCheckForUserRef.current = userId;
      setIsLocked(true);
      unlockWithBiometrics();
    }
  
    trySyncOfflineQueue();
  }, [userId, trySyncOfflineQueue, biometricLockEnabled, unlockWithBiometrics]);

  useEffect(() => {
    if (!userId) return;
  
    const sub = AppState.addEventListener("change", (state) => {
      // When app goes background/inactive, lock so it requires auth when returning.
      if (state === "background" || state === "inactive") {
        if (isWalking) {
          void stopWalk();
        }
        if (biometricLockEnabled) setIsLocked(true);
        return;
      }
  
      if (state === "active") {
        // IMPORTANT: do NOT force-lock on active.
        // iOS can bounce AppState during the Face ID sheet which causes re-prompt loops.
        if (biometricLockEnabled && isLockedRef.current) {
          unlockWithBiometrics();
        }
  
        trySyncOfflineQueue();
      }
    });
  
    return () => sub.remove();
  }, [userId, trySyncOfflineQueue, biometricLockEnabled, unlockWithBiometrics, isWalking, stopWalk]);

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

  useEffect(() => {
    walkCoordsRef.current = walkCoords;
  }, [walkCoords]);

  
  
  const uploadWalkMapToSupabase = async (userId: string, prayerId: string, localUri: string) => {
    const path = `${userId}/${prayerId}/map.png`;
  
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      if (!base64 || base64.length < 5000) {
        console.log("walk:map_upload_invalid_base64", { len: base64?.length ?? 0 });
        return null;
      }
  
      const bytes = b64ToBytes(base64);
  
      const { error } = await getSupabase()
        .storage
        .from("prayer-walk-maps")
        .upload(path, bytes, {
          contentType: "image/png",
          upsert: true,
        });
  
      if (error) {
        console.log("walk:map_upload_error", error);
        return null;
      }
  
      console.log("walk:map_upload_ok", { path, bytes: bytes.length });
      return path;
    } catch (e) {
      console.log("walk:map_upload_exception", e);
      return null;
    }
  };

  const handleSavePrayer = async (opts?: { isBookmarked?: boolean; keepAudio?: boolean }) => {
    if (!userId) {
      return Alert.alert("Error", "Missing user.");
    }
    
    const keepAudioToSave = opts?.keepAudio ?? keepAudio;
    
    // Audio mode: must have a recording
    if (editorMode === "audio" && !draftAudioUri) {
      return Alert.alert("Error", "Missing recording.");
    }
    
    // Text mode: must have some text (except walk mode)
    if (editorMode === "text" && entrySource !== "walk" && !draftTranscript.trim()) {
      return Alert.alert("Nothing to save", "Write something before saving.");
    }

    const bookmarkToSave = opts?.isBookmarked ?? isBookmarked;
    const prayedAtISO = new Date().toISOString();
    const saveMode = entrySource === "ocr" ? "ocr" : editorMode;
    const baseSaveProps = {
      mode: saveMode as "audio" | "text" | "ocr",
      has_audio: editorMode === "audio" && !!draftAudioUri,
      image_count: draftPhotoUris.length,
      has_verse: !!draftBibleRef,
      has_location: !!draftLocationName,
      duration_seconds: draftDuration ?? undefined,
    };
    let saveStart = 0;
    let insertSucceeded = false;

    try {
      setIsProcessing(true);

      // Try online-first
      try {
        // 1) Create prayer row FIRST (fast) so the UI can complete instantly.
        const prayerId = makePrayerId();
        saveStart = Date.now();
        capture("prayer_save_started", { ...baseSaveProps, save_ms: 0 });

        const { error: insertError } = await getSupabase()
          .from("prayers")
          .insert([
            {
              id: prayerId,
              user_id: userId,
              prayed_at: prayedAtISO,
              transcript_text: draftTranscript || null,
              duration_seconds: draftDuration ?? null,
              // Optimistic: upload audio after saving so the Save UI is instant.
              audio_path: null,
              entry_source: entrySource,
              bible_reference: draftBibleRef,
              bible_version: draftBibleVersion,
              bible_provider: draftBibleProvider,
              bible_added_at: draftBibleRef ? new Date().toISOString() : null,
              location_name: draftLocationName,
              walk_map_path: null,
            },
          ]);

        if (insertError) throw insertError;
        insertSucceeded = true;
        capture("prayer_save_succeeded", {
          ...baseSaveProps,
          save_ms: Date.now() - saveStart,
        });

        if (bookmarkToSave) {
          const { error: bookmarkError } = await getSupabase()
            .from("bookmarked_prayers")
            .insert({
              user_id: userId,
              prayer_id: prayerId,
            });

          if (bookmarkError) throw bookmarkError;
        }

        const walkMapUriToUpload = entrySource === "walk" ? walkMapUri : null;
        // 2) Immediately complete the UI (no waiting for uploads)
        setShowEditModal(false);
        setDraftAudioUri(null);
        setDraftTranscript("");
        setDraftDuration(null);
        setIsBookmarked(false);
        setKeepAudio(true);
        setEntrySource("audio");
        setDraftBibleRef(null);
        setDraftBibleVersion(null);
        setDraftBibleProvider("manual");
        setDraftPhotoUris([]);
        setDraftLocationName(null);
        setWalkMapUri(null);
        setIsVerseEditorOpen(false);
        setVerseDraftRef("");
        setVerseDraftVersion("");
        setPrayState("saved");

        // Auto-dismiss Prayer Saved card after 3s
        if (prayerSavedTimeoutRef.current) clearTimeout(prayerSavedTimeoutRef.current);
        prayerSavedTimeoutRef.current = setTimeout(() => {
          setPrayState("idle");
        }, 3000);

        // 3) Fire-and-forget uploads in background
        // Audio upload (if applicable): upload then update prayer row
        if (editorMode === "audio" && keepAudioToSave && draftAudioUri) {
          (async () => {
            try {
              const storagePath = await uploadAudioToSupabase(userId, draftAudioUri);
              if (!storagePath) throw new Error("audio_upload_failed");

              const { error: updErr } = await getSupabase()
                .from("prayers")
                .update({ audio_path: storagePath })
                .eq("id", prayerId)
                .eq("user_id", userId);

              if (updErr) throw updErr;
            } catch {
              // Do NOT fail the prayer. Just inform user.
              showSyncBanner(
                "Prayer saved, but audio is still uploading (or failed). We’ll retry when possible.",
                4500
              );
            }
          })();
        }

        // Walk map upload (if applicable): upload snapshot then update prayer row
        if (entrySource === "walk" && walkMapUriToUpload) {
          (async () => {
            try {
              console.log("walk:map_upload_start", { prayerId, uri: walkMapUriToUpload });
              const mapPath = await uploadWalkMapToSupabase(userId, prayerId, walkMapUriToUpload);
              if (!mapPath) throw new Error("walk_map_upload_failed");

              const { error: updErr } = await getSupabase()
                .from("prayers")
                .update({ walk_map_path: mapPath })
                .eq("id", prayerId)
                .eq("user_id", userId);

              if (updErr) throw updErr;
            } catch {
              showSyncBanner(
                "Prayer saved, but the walk map is still uploading (or failed). We’ll retry when possible.",
                4500
              );
            }
          })();
        }

        // Photos upload (if any)
        if (draftPhotoUris.length > 0) {
          uploadImagesInBackground(userId, prayerId, draftPhotoUris);
        }

        // Opportunistically flush any offline queue
        trySyncOfflineQueue();
      } catch (e: any) {
        if (!insertSucceeded) {
          const code = String(e?.code || e?.name || "insert_failed");
          capture("prayer_save_failed", {
            ...baseSaveProps,
            save_ms: saveStart ? Date.now() - saveStart : 0,
            error_code: code,
          });
        }
        // Offline fallback: queue locally, keep same success UX
        // Photos are not supported offline yet, so warn and clear them.
        if (draftPhotoUris.length > 0) {
          Alert.alert(
            "Internet connection is required",
            "Photo attachments will be supported offline in a later update. Please save photos when you’re online."
          );
          setDraftPhotoUris([]);
        }
        if (entrySource === "walk" && walkMapUri) {
          Alert.alert(
            "Internet connection is required",
            "Your prayer will be queued, and walk map will be attached when you're online."
          );
          setWalkMapUri(null);
        }

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
    setEntrySource("audio");
    setDraftBibleRef(null);
    setDraftBibleVersion(null);
    setDraftBibleProvider("manual");
    setDraftPhotoUris([]);
    setDraftLocationName(null);
    setWalkMapUri(null);
    setIsVerseEditorOpen(false);
    setVerseDraftRef("");
    setVerseDraftVersion("");
    try {
      deactivateKeepAwake();
    } catch {}
  };
  
  const handleOpenTextEntry = () => {
    setEditorMode("text");
    setEntrySource("text");
    setDraftBibleRef(null);
    setDraftBibleVersion(null);
    setDraftBibleProvider("manual");
    setShowEditModal(true);
    setDraftAudioUri(null);
    setDraftDuration(null);
    setDraftTranscript("");
    setIsBookmarked(false);
    setKeepAudio(true);
    setDraftPhotoUris([]);
    setPrayState("idle");
    setDraftLocationName(null);
    setWalkMapUri(null);
    setIsVerseEditorOpen(false);
    setVerseDraftRef("");
    setVerseDraftVersion("");
  };

  const handlePressVerse = () => {
    // Toggle editor
    setIsVerseEditorOpen((open) => {
      const next = !open;
      if (next) {
        // Pre-fill with existing values if present
        setVerseDraftRef(draftBibleRef ?? "");
        setVerseDraftVersion(draftBibleVersion ?? "");
      }
      return next;
    });
  };

  const handleAttachVerse = () => {
    const ref = verseDraftRef.trim();
    const ver = verseDraftVersion.trim();

    if (!ref) {
      Alert.alert("Add a verse reference", "Please enter something like John 3:16.");
      return;
    }

    setDraftBibleRef(ref);
    setDraftBibleVersion(ver || null);
    setDraftBibleProvider("manual");
    setIsVerseEditorOpen(false);
  };

  const handleRemoveVerse = () => {
    setDraftBibleRef(null);
    setDraftBibleVersion(null);
    setDraftBibleProvider("manual");
    setVerseDraftRef("");
    setVerseDraftVersion("");
    setIsVerseEditorOpen(false);
  };
  
  const addDraftPhotos = (uris: string[], source?: "camera" | "library") => {
    if (!uris.length) return;

    setDraftPhotoUris((prev) => {
      const remaining = Math.max(0, MAX_PHOTOS_PER_PRAYER - prev.length);
      if (remaining <= 0) {
        Alert.alert(
          "Max photos reached",
          `You can attach up to ${MAX_PHOTOS_PER_PRAYER} photos to a prayer.`
        );
        return prev;
      }
      const toAdd = uris.slice(0, remaining);
      const next = [...prev, ...toAdd];
      if (source && toAdd.length > 0) {
        capture("attachment_added", {
          source,
          image_count_after: next.length,
        });
      }
      return next;
    });
  };

  const pickPhotos = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access to attach photos.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_MEDIA_TYPES,
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (res.canceled) return;

      const uris = (res.assets ?? [])
        .map((a: ImagePicker.ImagePickerAsset) => a.uri)
        .filter(Boolean) as string[];
      if (!uris.length) return;

      addDraftPhotos(uris, "library");
    } catch {
      Alert.alert("Error", "Could not pick photos.");
    }
  };

  const takePhotoAttachment = async () => {
    try {
      capture("attachment_add_clicked", { source: "camera" });
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to take a photo.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: IMAGE_MEDIA_TYPES,
        allowsMultipleSelection: false,
        allowsEditing: true, // crop helps readability and keeps content focused
        quality: 0.9,
      });

      if (res.canceled) return;

      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      addDraftPhotos([uri], "camera");
    } catch {
      Alert.alert("Error", "Could not take a photo.");
    }
  };

  const scanHandwritingToText = async () => {
    try {
      // Offer camera (scan) or library
      const choice = await new Promise<"camera" | "library" | null>((resolve) => {
        Alert.alert(
          "Scan handwriting",
          "How would you like to add your handwritten prayer?",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
            { text: "Scan with camera", onPress: () => resolve("camera") },
            { text: "Choose from library", onPress: () => resolve("library") },
          ]
        );
      });

      if (!choice) return;

      let res: ImagePicker.ImagePickerResult;

      if (choice === "camera") {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (camPerm.status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow camera access to scan handwriting."
          );
          return;
        }

        res = await ImagePicker.launchCameraAsync({
          mediaTypes: IMAGE_MEDIA_TYPES,
          allowsMultipleSelection: false,
          allowsEditing: true, // lets the user crop tightly to the page
          quality: 0.9,
          base64: true,
        });
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libPerm.status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow photo library access to scan handwriting."
          );
          return;
        }

        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: IMAGE_MEDIA_TYPES,
          allowsMultipleSelection: false,
          allowsEditing: true, // cropping improves OCR
          quality: 0.9,
          base64: true,
        });
      }

      if (res.canceled) return;

      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setIsProcessing(true);

      // Use base64 directly from the picker result
      const image_base64 = res.assets?.[0]?.base64;
      if (!image_base64) {
        Alert.alert("Scan failed", "We couldn’t read the image. Please try again.");
        return;
      }

      const ocrStart = Date.now();
      capture("ocr_started", { provider: "azure", ms: 0 });

      const { data, error } = await getSupabase().functions.invoke("ocr", {
        body: { image_base64 },
      });

      if (error || !data) {
        const errCode = String(error?.name || error?.code || "ocr_failed");
        capture("ocr_failed", { provider: "azure", ms: Date.now() - ocrStart, error_code: errCode });
        let details: any = null;
        try {
          const ctx = (error as any)?.context;
          // supabase-js provides a Response in error.context for FunctionsHttpError
          if (ctx && typeof ctx.json === "function") {
            details = await ctx.json();
          } else if (ctx && typeof ctx.text === "function") {
            details = await ctx.text();
          }
        } catch {
          // ignore
        }

        console.error("OCR failed", { error, details });

        Alert.alert(
          "OCR failed",
          "We couldn’t read that handwriting. Try better lighting and a tighter crop."
        );
        return;
      }

      const text = (data as any).text || "";
      console.log("OCR response:", data);
      if (!text.trim()) {
        capture("ocr_failed", { provider: "azure", ms: Date.now() - ocrStart, error_code: "no_text" });
        Alert.alert(
          "No text found",
          "We couldn’t detect readable text. Try better lighting and a tighter crop."
        );
        return;
      }

      capture("ocr_succeeded", { provider: "azure", ms: Date.now() - ocrStart });

      // Populate editor
      setEditorMode("text");
      setEntrySource("ocr");
      setDraftTranscript(text);
      setDraftAudioUri(null);
      setDraftDuration(null);
      setShowEditModal(true);
    } catch (e: any) {
      capture("ocr_failed", { provider: "azure", ms: 0, error_code: String(e?.name || "ocr_failed") });
      Alert.alert("Error", e?.message || "Could not scan handwriting.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePressPhoto = () => {
    capture("attachment_add_clicked", { source: "library" });
    pickPhotos();
  };

  const handlePressScan = () => {
    scanHandwritingToText();
  };

  const handleRemoveDraftPhoto = (index: number) => {
    setDraftPhotoUris((prev) => {
      const next = prev.filter((_, i) => i !== index);
      capture("attachment_removed", { image_count_after: next.length });
      return next;
    });
  };

  const handlePressLocation = async () => {
    try {
      // If already set, allow quick remove
      if (draftLocationName) {
        Alert.alert("Remove location?", draftLocationName, [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => setDraftLocationName(null) },
        ]);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access to tag where this prayer happened."
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const stripLeadingNumber = (s?: string | null) => {
        if (!s) return "";
        // Remove a leading house/door number (e.g. "50 Scholefield Road" -> "Scholefield Road")
        return s.replace(/^\s*\d+[\w-]*\s*/g, "").trim();
      };

      // Prefer `street` if available; fall back to `name` only if needed.
      const rawStreet = (place as any).street ?? (place as any).name ?? "";
      const street = stripLeadingNumber(String(rawStreet));
      const city = (place as any).city ?? (place as any).subregion ?? "";

      const label = [street, city]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => v.length > 0)
        .join(", ");

      setDraftLocationName(label || "Current location");
    } catch {
      Alert.alert("Location unavailable", "Could not determine your location.");
    }
  };

  // Date
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
        <View
          style={[
            styles.walkToggle,
            {
              borderColor: colors.textSecondary + "33",
              backgroundColor: isWalking ? colors.accent + "22" : "transparent",
            },
          ]}
        >
          <Ionicons
            name="walk-outline"
            size={16}
            color={isWalking ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.walkToggleText,
              { color: isWalking ? colors.accent : colors.textSecondary },
            ]}
          >
            Walk Mode
          </Text>
          <Switch
            value={isWalking}
            onValueChange={(next) => {
              if (next) {
                void startWalkWithNotice();
              } else {
                void stopWalk();
              }
            }}
            disabled={isProcessing || prayState === "recording"}
          />
        </View>
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
            ) : prayState === "recording" || isWalking ? (
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
          ) : isWalking ? (
            <View style={styles.timerWrapper}>
              <View
                style={[styles.timerCircle, { borderColor: colors.accent }]}
              >
                <Ionicons name="walk-outline" size={16} color={colors.accent} />
                <Text
                  style={[styles.timerText, { color: colors.textSecondary }]}
                >
                  {formattedWalkTime}
                </Text>
              </View>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {isProcessing ? "Finalizing prayer walk…" : "Prayer walk in progress… tap to finish."}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Tap and begin your prayer
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
          disabled={isWalking || isProcessing}
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

      {/* Prayer Walk Notice (first time) */}
      <Modal
        visible={walkNoticeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalkNoticeVisible(false)}
      >
        <View style={styles.walkNoticeBackdrop}>
          <View style={[styles.walkNoticeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.walkNoticeTitle, { color: colors.textPrimary }]}>
              Walk Mode
            </Text>
            <Text style={[styles.walkNoticeBody, { color: colors.textSecondary }]}>
              Prayer "Walk Mode" converts speech to text. Audio is not recorded or saved.{"\n\n"}
              
              Please enable Location Services to use Walk Mode.
            </Text>
            <TouchableOpacity
              style={styles.walkNoticeCheckboxRow}
              onPress={() => setWalkDontShowAgain((v) => !v)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.walkNoticeCheckbox,
                  walkDontShowAgain && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              />
              <Text style={[styles.walkNoticeCheckboxText, { color: colors.textSecondary }]}>
                Don’t show again
              </Text>
            </TouchableOpacity>

            <View style={styles.walkNoticeActions}>
              <TouchableOpacity
                onPress={() => {
                  setWalkNoticeVisible(false);
                  setWalkDontShowAgain(false);
                }}
                style={styles.walkNoticeBtnGhost}
              >
                <Text style={[styles.walkNoticeBtnGhostText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (walkDontShowAgain) {
                    await AsyncStorage.setItem(WALK_NOTICE_KEY, "true");
                  }
                  setWalkNoticeVisible(false);
                  setWalkDontShowAgain(false);
                  await startWalk();
                }}
                style={[styles.walkNoticeBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.walkNoticeBtnGhostText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Security Notice Modal (shows before first recording) */}
      <SecurityNoticeModal
        visible={securityNoticeVisible}
        onClose={() => {
          setSecurityNoticeVisible(false);
          pendingStartAfterNotice.current = null;
        }}
        onContinue={() => {
          setSecurityNoticeVisible(false);
          const fn = pendingStartAfterNotice.current;
          pendingStartAfterNotice.current = null;
          if (fn) fn();
        }}
      />

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
        entrySource={entrySource}
        walkMapUri={walkMapUri}
        transcript={draftTranscript}
        onChangeText={setDraftTranscript}
        onSave={handleSavePrayer}
        onDiscard={handleDiscardDraft}
        loading={isProcessing}
        isBookmarked={isBookmarked}
        onToggleBookmark={() =>
          setIsBookmarked((v) => {
            const next = !v;
            capture("bookmark_toggled", { state: next, surface: "save_flow" });
            return next;
          })
        }
        keepAudio={keepAudio}
        onToggleKeepAudio={() => setKeepAudio((v) => !v)}
        onPressVerse={handlePressVerse}
        onPressPhoto={handlePressPhoto}
        onPressCamera={takePhotoAttachment}
        onPressScan={handlePressScan}
        verseLabel={
          draftBibleRef
            ? `${draftBibleRef}${draftBibleVersion ? ` (${draftBibleVersion})` : ""}`
            : null
        }
        onPressLocation={handlePressLocation}
        locationLabel={draftLocationName}
        onRemoveLocation={() => setDraftLocationName(null)}
        photoUris={draftPhotoUris}
        onRemovePhotoAt={handleRemoveDraftPhoto}
        showScanHint={entrySource === "ocr"}
        verseEditorOpen={isVerseEditorOpen}
        verseDraftRef={verseDraftRef}
        verseDraftVersion={verseDraftVersion}
        onChangeVerseRef={setVerseDraftRef}
        onChangeVerseVersion={setVerseDraftVersion}
        onAttachVerse={handleAttachVerse}
        onRemoveVerse={handleRemoveVerse}
      />
      <Modal visible={mapSnapshotVisible} transparent animationType="none">
        <View style={{ position: "absolute", left: -9999, top: -9999, width: WALK_MAP_WIDTH, height: WALK_MAP_HEIGHT }}>
          <MapView
            ref={(r) => { mapViewRef.current = r; }}
            style={{ width: WALK_MAP_WIDTH, height: WALK_MAP_HEIGHT }}
            initialRegion={
              mapSnapshotCoords.length
                ? computeRegionForCoords(mapSnapshotCoords)
                : { latitude: 51.5, longitude: -0.12, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            }
            onMapReady={() => {
              setTimeout(async () => {
                try {
                  const res = await (mapViewRef.current as any)?.takeSnapshot?.({
                    width: WALK_MAP_WIDTH,
                    height: WALK_MAP_HEIGHT,
                    format: "png",
                    quality: 1,
                    result: "file",
                  });

                  const uri =
                    typeof res === "string"
                      ? res
                      : (res?.uri ?? null);

                  setMapSnapshotVisible(false);
                  mapSnapshotResolveRef.current?.(uri);
                } catch {
                  setMapSnapshotVisible(false);
                  mapSnapshotResolveRef.current?.(null);
                } finally {
                  mapSnapshotResolveRef.current = null;
                }
              }, 700);
            }}
          >
            {mapSnapshotCoords.length >= 1 ? (
              <>
                <Marker coordinate={mapSnapshotCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.startPin} />
                </Marker>

                <Marker
                  coordinate={mapSnapshotCoords[mapSnapshotCoords.length - 1]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.endPin} />
                </Marker>
                {mapSnapshotCoords.length >= 2 ? (
                  <Polyline coordinates={mapSnapshotCoords} strokeWidth={4} strokeColor={colors.accent}/>
                ) : null}
              </>
            ) : null}
          </MapView>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  date: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  walkToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  walkToggleText: {
    fontFamily: fonts.body,
    fontSize: 12,
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
    width: 36,
    height: 36,
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
  walkNoticeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  walkNoticeCard: {
    borderRadius: 18,
    padding: spacing.lg,
  },
  walkNoticeTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  walkNoticeBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  walkNoticeCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  walkNoticeCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#777",
    marginRight: 10,
  },
  walkNoticeCheckboxText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  walkNoticeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  walkNoticeBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  walkNoticeBtnGhostText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  walkNoticeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  walkNoticeBtnText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: "#000",
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
  startPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E", // green
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  
  endPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444", // red
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
