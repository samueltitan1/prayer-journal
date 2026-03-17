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
import { Pedometer } from "expo-sensors";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Circle, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTabsChrome } from "../_layout";

import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

import SecurityNoticeModal, { shouldShowSecurityNotice } from "@/components/SecurityNoticeModal";
import TranscriptEditor from "../../../components/TranscriptEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { isHealthKitAvailable, requestHealthPermissions, savePrayerWalkWorkout } from "../../../lib/healthkit";
import { cancelStreakFollowupNotification, getDailyPrayerReminderStatus } from "../../../lib/notifications";
import {
  appendPrayerWalkRoutePoints,
  clearPrayerWalkRoutePoints,
  getPrayerWalkTaskDiagnostics,
  isPrayerWalkTaskManagerAvailable,
  PRAYER_WALK_LOCATION_TASK,
  readPrayerWalkRoutePoints,
  type PrayerWalkRoutePoint,
} from "../../../lib/prayerWalkLocationTask";
import { capture } from "../../../lib/posthog";
import { getSupabase } from "../../../lib/supabaseClient";
import { upsertUserSettingsOnboarding } from "../../../lib/userSettings";
import { fonts, spacing } from "../../../theme/theme";

type PrayState = "idle" | "recording" | "saved";
const MAX_SECONDS_DEFAULT = 10 * 60;
const MAX_PHOTOS_PER_PRAYER = 4;
const WALK_MAP_WIDTH = 640;
const WALK_MAP_HEIGHT = 400;
const WALK_NOTICE_KEY = "walk_mode_notice_v1";
const ACTIVE_WALK_SESSION_KEY = "@prayer_walk_active_session_v1";

type ActiveWalkSession = {
  active: true;
  startedAt: number;
  entrySource: "walk";
  audioStarted: boolean;
  trackingStarted: boolean;
};

const makePrayerId = () => uuidv4();

// expo-image-picker changed `mediaTypes` API across versions.
// Use a runtime-safe value that works on older + newer versions.
const IMAGE_MEDIA_TYPES: any = (ImagePicker as any)?.MediaType?.Images
  ? [(ImagePicker as any).MediaType.Images]
  : ImagePicker.MediaTypeOptions.Images;

export default function PrayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { openSettings, settingsRefreshNonce, setHeaderVisible } = useTabsChrome();

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
  const [isTranscribing, setIsTranscribing] = useState(false);
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
  const [walkStepCount, setWalkStepCount] = useState<number | null>(null);
  const walkPedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const walkNoCoordsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const walkRecordingRef = useRef<Audio.Recording | null>(null);
  const walkLocationSubRef = useRef<Location.LocationSubscription | null>(null);
  const walkLocationEventCountRef = useRef(0);
  const stopWalkInFlightRef = useRef(false);
  const [walkMapWarning, setWalkMapWarning] = useState(false);
  const [walkMapUri, setWalkMapUri] = useState<string | null>(null);
  const [draftWalkDistanceMeters, setDraftWalkDistanceMeters] = useState<number | null>(null);
  const [mapSnapshotVisible, setMapSnapshotVisible] = useState(false);
  const [mapSnapshotCoords, setMapSnapshotCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const mapSnapshotResolveRef = useRef<null | ((uri: string | null, errorCode?: string) => void)>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const mapSnapshotInFlightRef = useRef(false);
  const healthKitNoticeShownRef = useRef(false);
  const [appleHealthConnected, setAppleHealthConnected] = useState<boolean | null>(null);
  const healthKitOptInRef = useRef(false);
  const lastAppStateRef = useRef(AppState.currentState);

  const logWalk = useCallback((event: string, meta?: Record<string, unknown>) => {
    if (!__DEV__) return;
    if (meta) {
      console.log(`[walk] ${event}`, meta);
      return;
    }
    console.log(`[walk] ${event}`);
  }, []);

  const hasWalkRouteChanged = (
    prev: PrayerWalkRoutePoint[],
    next: PrayerWalkRoutePoint[]
  ) => {
    if (prev.length !== next.length) return true;
    if (prev.length === 0) return false;
    const prevLast = prev[prev.length - 1];
    const nextLast = next[next.length - 1];
    return (
      prevLast.latitude !== nextLast.latitude ||
      prevLast.longitude !== nextLast.longitude ||
      prevLast.timestamp !== nextLast.timestamp
    );
  };

  const hydrateWalkCoordsFromStorage = useCallback(
    async (reason: string) => {
      try {
        const persisted = await readPrayerWalkRoutePoints();
        if (!hasWalkRouteChanged(walkCoordsRef.current, persisted)) return persisted;
        walkCoordsRef.current = persisted;
        setWalkCoords(persisted);
        logWalk("route_hydrated", { reason, point_count: persisted.length });
        return persisted;
      } catch {
        logWalk("route_hydrate_failed", { reason });
        return walkCoordsRef.current;
      }
    },
    [logWalk]
  );

  const readActiveWalkSession = useCallback(async (): Promise<ActiveWalkSession | null> => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_WALK_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ActiveWalkSession>;
      if (
        parsed?.active === true &&
        typeof parsed.startedAt === "number" &&
        parsed.entrySource === "walk"
      ) {
        return {
          active: true,
          startedAt: parsed.startedAt,
          entrySource: "walk",
          audioStarted: parsed.audioStarted === true,
          trackingStarted: parsed.trackingStarted === true,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const writeActiveWalkSession = useCallback(async (session: ActiveWalkSession | null) => {
    try {
      if (!session) {
        await AsyncStorage.removeItem(ACTIVE_WALK_SESSION_KEY);
        return;
      }
      await AsyncStorage.setItem(ACTIVE_WALK_SESSION_KEY, JSON.stringify(session));
    } catch {}
  }, []);

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

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("user_settings")
          .select("apple_health_connected")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) return;
        const connected = data?.apple_health_connected === true;
        setAppleHealthConnected(connected);
        healthKitOptInRef.current = connected;
      } catch {}
    })();
  }, [userId]);

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
  }, [userId, settingsRefreshNonce]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);
  useEffect(() => {
    setHeaderVisible(!isLocked);
    return () => {
      setHeaderVisible(true);
    };
  }, [isLocked, setHeaderVisible]);

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
    animationRef.current = null;
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
      capture("walk_route_unavailable", { reason: "services_disabled" });
      return { ok: false, services_enabled: false, has_location_permission: false };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("walk:permission", status);
    if (status !== "granted") {
      Alert.alert(
        "Location permission required",
        "Prayer Walk needs your location to draw your route. Please enable location services to continue."
      );
      capture("walk_route_unavailable", { reason: "permissions" });
      return { ok: false, services_enabled: true, has_location_permission: false };
    }

    // Best-effort background permission for lock-screen/background Prayer Walk.
    // Don't hard-fail if denied; route tracking can still work while app is foregrounded.
    let hasBackgroundLocationPermission = false;
    if (Platform.OS === "ios" || Platform.OS === "android") {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        hasBackgroundLocationPermission = bg.status === "granted";
      } catch {
        hasBackgroundLocationPermission = false;
      }
    }

    return {
      ok: true,
      services_enabled: true,
      has_location_permission: true,
      has_background_location_permission: hasBackgroundLocationPermission,
    };
  };

  const configureWalkRecordingAudioMode = async () => {
    // Background walk recording needs both runtime audio mode and iOS background capability.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: (Audio as any).InterruptionModeIOS?.DoNotMix ?? 1,
      interruptionModeAndroid: (Audio as any).InterruptionModeAndroid?.DoNotMix ?? 1,
      shouldDuckAndroid: true,
    });
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

  const computeDistanceMeters = (coords: Array<{ latitude: number; longitude: number }>) => {
    if (coords.length < 2) return 0;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // meters
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const dLat = toRad(cur.latitude - prev.latitude);
      const dLon = toRad(cur.longitude - prev.longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(prev.latitude)) *
          Math.cos(toRad(cur.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += R * c;
    }
    return total;
  };

  const startWalkStepTracking = async () => {
    setWalkStepCount(null);
    try {
      walkPedometerSubRef.current?.remove();
    } catch {}
    walkPedometerSubRef.current = null;

    try {
      const anyPedometer = Pedometer as any;
      if (!anyPedometer || typeof anyPedometer.isAvailableAsync !== "function") return;
      const available = await anyPedometer.isAvailableAsync();
      if (!available || typeof anyPedometer.watchStepCount !== "function") return;

      // iOS may require motion/activity permission before pedometer data is readable.
      if (
        typeof anyPedometer.getPermissionsAsync === "function" &&
        typeof anyPedometer.requestPermissionsAsync === "function"
      ) {
        const current = await anyPedometer.getPermissionsAsync();
        const granted = current?.granted === true;
        if (!granted) {
          const requested = await anyPedometer.requestPermissionsAsync();
          if (requested?.granted !== true) {
            setWalkStepCount(null);
            return;
          }
        }
      }

      setWalkStepCount(0);
      walkPedometerSubRef.current = anyPedometer.watchStepCount((result: { steps?: number }) => {
        const next = typeof result?.steps === "number" ? result.steps : 0;
        setWalkStepCount(next);
      });
    } catch {
      setWalkStepCount(null);
    }
  };

  const stopWalkStepTracking = () => {
    try {
      walkPedometerSubRef.current?.remove();
    } catch {}
    walkPedometerSubRef.current = null;
  };

  const getFinalWalkStepCount = async (
    startedAtMs: number | null,
    endedAtMs: number
  ): Promise<number | null> => {
    if (!startedAtMs || endedAtMs <= startedAtMs) return null;
    try {
      const anyPedometer = Pedometer as any;
      if (!anyPedometer || typeof anyPedometer.isAvailableAsync !== "function") return null;
      const available = await anyPedometer.isAvailableAsync();
      if (!available || typeof anyPedometer.getStepCountAsync !== "function") return null;

      if (
        typeof anyPedometer.getPermissionsAsync === "function" &&
        typeof anyPedometer.requestPermissionsAsync === "function"
      ) {
        const current = await anyPedometer.getPermissionsAsync();
        const granted = current?.granted === true;
        if (!granted) {
          const requested = await anyPedometer.requestPermissionsAsync();
          if (requested?.granted !== true) return null;
        }
      }

      const res = await anyPedometer.getStepCountAsync(
        new Date(startedAtMs),
        new Date(endedAtMs)
      );
      const steps = typeof res?.steps === "number" ? Math.max(0, Math.floor(res.steps)) : null;
      return steps;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    return () => {
      stopWalkStepTracking();
      try {
        walkLocationSubRef.current?.remove();
      } catch {}
      walkLocationSubRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const diagnostics = getPrayerWalkTaskDiagnostics();
    if (!diagnostics.taskManagerAvailable) {
      console.warn(
        "Prayer Walk background location task unavailable: ExpoTaskManager native module missing in this build. Falling back to foreground route watcher."
      );
      console.log("[walk-task] diagnostics", diagnostics);
      return;
    }
    console.log("[walk-task] diagnostics", diagnostics);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const recoverInterruptedWalk = async () => {
      const session = await readActiveWalkSession();
      if (!session || cancelled) return;

      const points = await readPrayerWalkRoutePoints();
      if (cancelled) return;

      logWalk("interrupted_session_detected", {
        started_at: session.startedAt,
        audio_started: session.audioStarted,
        tracking_started: session.trackingStarted,
        point_count: points.length,
      });

      Alert.alert(
        "Prayer Walk Interrupted",
        "Your previous Prayer Walk was interrupted when the app restarted. Audio recording cannot be recovered after restart, but route data can be kept.",
        [
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              void clearPrayerWalkRoutePoints();
              void writeActiveWalkSession(null);
            },
          },
          {
            text: "Recover Route",
            onPress: async () => {
              const durationSeconds = Math.max(
                0,
                Math.round((Date.now() - session.startedAt) / 1000)
              );
              const distanceMeters = computeDistanceMeters(
                points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
              );
              let mapUri: string | null = null;
              if (points.length > 0) {
                try {
                  mapUri = await takeRouteMapSnapshot(
                    points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
                  );
                } catch {}
              }

              if (cancelled) return;

              setEditorMode("text");
              setEntrySource("walk");
              setDraftTranscript("");
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
              setDraftWalkDistanceMeters(distanceMeters);
              setVerseDraftRef("");
              setVerseDraftVersion("");
              setShowEditModal(true);
              setPrayState("idle");

              await writeActiveWalkSession(null);
            },
          },
        ]
      );
    };

    void recoverInterruptedWalk();
    return () => {
      cancelled = true;
    };
  }, [logWalk, readActiveWalkSession, writeActiveWalkSession]);
  
  const takeRouteMapSnapshot = async (
    coords: Array<{ latitude: number; longitude: number }>
  ): Promise<string | null> => {
    if (!coords || coords.length < 1) {
      capture("walk_map_snapshot_failed", { ms: 0, error_code: "no_points" });
      return null;
    }
    if (mapSnapshotInFlightRef.current) {
      capture("walk_map_snapshot_failed", { ms: 0, error_code: "in_flight" });
      return null;
    }
  
    mapSnapshotInFlightRef.current = true;
    const startedAt = Date.now();
    capture("walk_map_snapshot_started", { point_count: coords.length });
  
    return new Promise<string | null>((resolve) => {
      mapSnapshotResolveRef.current = async (uri, errorCode) => {
        mapSnapshotInFlightRef.current = false;
        const ms = Date.now() - startedAt;
        if (uri) {
          let bytes: number | undefined = undefined;
          try {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists && typeof info.size === "number") {
              bytes = info.size;
            }
          } catch {}
          capture("walk_map_snapshot_succeeded", bytes ? { ms, bytes } : { ms });
        } else {
          capture("walk_map_snapshot_failed", { ms, error_code: errorCode || "snapshot_failed" });
        }
        resolve(uri);
      };
  
      setMapSnapshotCoords(coords);
      setMapSnapshotVisible(true);
  
      // hard timeout (never hang stopWalk)
      setTimeout(() => {
        if (mapSnapshotResolveRef.current) {
          setMapSnapshotVisible(false);
          mapSnapshotResolveRef.current?.(null, "timeout");
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

    if (appleHealthConnected === false && !healthKitNoticeShownRef.current) {
      healthKitNoticeShownRef.current = true;
      Alert.alert(
        "Apple Health (Optional)",
        "We can save workout details and route data to Apple Health. Your prayer content is never shared.",
        [
          {
            text: "Continue without Apple Health",
            style: "cancel",
            onPress: () => {
              healthKitOptInRef.current = false;
              void startWalk();
            },
          },
          {
            text: "Connect Apple Health",
            onPress: async () => {
              const available = await isHealthKitAvailable();
              if (!available) {
                Alert.alert("Apple Health unavailable", "Apple Health is only available on iOS devices.");
                healthKitOptInRef.current = false;
                void startWalk();
                return;
              }
              const ok = await requestHealthPermissions();
              if (ok) {
                healthKitOptInRef.current = true;
                setAppleHealthConnected(true);
                void upsertUserSettingsOnboarding(userId, {
                  apple_health_connected: true,
                });
              } else {
                healthKitOptInRef.current = false;
              }
              void startWalk();
            },
          },
        ]
      );
      return;
    }
    if (appleHealthConnected === true) {
      healthKitOptInRef.current = true;
    }

    const micOk = await requestMicPermission();
    if (!micOk) return;

    const locResult = await requestLocationPermission();
    if (!locResult.ok) return;

    const walkStartedAt = Date.now();
    setIsProcessing(true);
    setWalkCoords([]);
    setWalkStartAt(walkStartedAt);
    setWalkElapsedSeconds(0);
    setWalkStepCount(null);
    setDraftWalkDistanceMeters(null);
    walkLocationEventCountRef.current = 0;
    logWalk("start_requested", {
      user_id_present: !!userId,
      apple_health_opt_in: healthKitOptInRef.current,
    });
    await writeActiveWalkSession({
      active: true,
      startedAt: walkStartedAt,
      entrySource: "walk",
      audioStarted: false,
      trackingStarted: false,
    });

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
        logWalk("first_fix_acquired", {
          latitude: first.coords.latitude,
          longitude: first.coords.longitude,
          timestamp: first.timestamp ?? Date.now(),
        });
        initialPoint = {
          latitude: first.coords.latitude,
          longitude: first.coords.longitude,
          timestamp: first.timestamp ?? Date.now(),
        };
      } catch {
        logWalk("first_fix_failed");
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

      await configureWalkRecordingAudioMode();

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
      logWalk("audio_recording_started");
      recording.setOnRecordingStatusUpdate((status) => {
        if (!__DEV__) return;
        if (!status.isRecording || (status as any).isDoneRecording) {
          console.log("[walk] recording_status", {
            isRecording: status.isRecording,
            isDoneRecording: (status as any).isDoneRecording ?? false,
            durationMillis: status.durationMillis ?? 0,
          });
        }
      });
      walkRecordingRef.current = recording;
      await writeActiveWalkSession({
        active: true,
        startedAt: walkStartedAt,
        entrySource: "walk",
        audioStarted: true,
        trackingStarted: false,
      });

      await clearPrayerWalkRoutePoints();
      walkCoordsRef.current = [];
      setWalkCoords([]);

      if (initialPoint) {
        await appendPrayerWalkRoutePoints([initialPoint]);
        walkCoordsRef.current = [initialPoint];
        setWalkCoords([initialPoint]);
      }

      if (isPrayerWalkTaskManagerAvailable) {
        try {
          const alreadyTracking = await Location.hasStartedLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
          if (alreadyTracking) {
            await Location.stopLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
          }
          await Location.startLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 3000,
            deferredUpdatesDistance: 3,
            deferredUpdatesInterval: 3000,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.Fitness,
            showsBackgroundLocationIndicator: true,
            ...(Platform.OS === "android"
              ? {
                  foregroundService: {
                    notificationTitle: "Prayer Walk in progress",
                    notificationBody: "Tracking your walk route in the background.",
                  },
                }
              : {}),
          });
        } catch (taskStartError: any) {
          logWalk("location_task_start_failed", {
            message: String(taskStartError?.message || taskStartError || "unknown"),
            has_background_permission: locResult.has_background_location_permission ?? false,
          });
          throw taskStartError;
        }
        logWalk("location_task_started", {
          task: PRAYER_WALK_LOCATION_TASK,
        });
        await writeActiveWalkSession({
          active: true,
          startedAt: walkStartedAt,
          entrySource: "walk",
          audioStarted: true,
          trackingStarted: true,
        });
      } else {
        // Fallback for dev clients that do not yet contain ExpoTaskManager native module.
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
            const prev = walkCoordsRef.current;
            const last = prev[prev.length - 1];
            if (last && last.latitude === next.latitude && last.longitude === next.longitude) return;
            const updated = [...prev, next];
            walkCoordsRef.current = updated;
            setWalkCoords(updated);
            void appendPrayerWalkRoutePoints([next]);
          }
        );
        walkLocationSubRef.current = sub;
        logWalk("location_fallback_watcher_started", {
          reason: "task_manager_unavailable",
        });
        await writeActiveWalkSession({
          active: true,
          startedAt: walkStartedAt,
          entrySource: "walk",
          audioStarted: true,
          trackingStarted: true,
        });
      }

      setIsWalking(true);
      await startWalkStepTracking();
      await hydrateWalkCoordsFromStorage("walk_start");
      logWalk("walk_started");
      capture("walk_started", {
        has_mic_permission: micOk,
        has_location_permission: locResult.has_location_permission,
        has_background_location_permission: locResult.has_background_location_permission ?? false,
        services_enabled: locResult.services_enabled,
      });
      if (walkNoCoordsTimeoutRef.current) clearTimeout(walkNoCoordsTimeoutRef.current);
      walkNoCoordsTimeoutRef.current = setTimeout(() => {
        // GPS can take a while to produce movement-based points (especially if you're stationary or indoors).
        if (walkCoordsRef.current.length < 1) {
          Alert.alert(
            "Route tracking unavailable",
            "We couldn't collect enough route points yet. Keep walking for a bit (preferably outdoors) and make sure Location Services are enabled."
          );
          capture("walk_route_unavailable", { reason: "timeout" });
        }
      }, 30000);
    } catch {
      logWalk("start_failed");
      Alert.alert("Error", "Could not start prayer walk.");
      walkRecordingRef.current = null;
      try {
        if (isPrayerWalkTaskManagerAvailable) {
          const started = await Location.hasStartedLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
          if (started) {
            await Location.stopLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
          }
        } else {
          walkLocationSubRef.current?.remove();
          walkLocationSubRef.current = null;
        }
      } catch {}
      await clearPrayerWalkRoutePoints();
      await writeActiveWalkSession(null);
      stopWalkStepTracking();
      capture("walk_route_unavailable", { reason: "unknown" });
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
    logWalk("stop_requested", {
      point_count: walkCoordsRef.current.length,
    });

    // Capture start time before we clear state
    const startedAt = walkStartAt;
    const walkEndedAt = Date.now();

    // Stop walk UI/timer immediately (don't wait for transcription/map generation)
    setIsWalking(false);
    setWalkStartAt(null);
    setWalkElapsedSeconds(0);

    setIsProcessing(true);
    setIsTranscribing(true);

    // Stop tracking immediately
    try {
      if (isPrayerWalkTaskManagerAvailable) {
        const started = await Location.hasStartedLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
        if (started) {
          await Location.stopLocationUpdatesAsync(PRAYER_WALK_LOCATION_TASK);
        }
      } else {
        walkLocationSubRef.current?.remove();
        walkLocationSubRef.current = null;
      }
    } catch {}
    logWalk(
      isPrayerWalkTaskManagerAvailable ? "location_task_stopped" : "location_fallback_watcher_stopped",
      isPrayerWalkTaskManagerAvailable ? { task: PRAYER_WALK_LOCATION_TASK } : undefined
    );
    if (walkNoCoordsTimeoutRef.current) clearTimeout(walkNoCoordsTimeoutRef.current);
    stopWalkStepTracking();

    try {
      console.log("walk:tracking stopped");

      const recording = walkRecordingRef.current;
      walkRecordingRef.current = null;

      let transcript = "";
      let localAudioUri: string | null = null;
      if (recording) {
        try {
          const status = await recording.getStatusAsync();
          logWalk("recording_status_before_stop", {
            isRecording: status.isRecording,
            durationMillis: status.durationMillis ?? 0,
          });
        } catch {
          logWalk("recording_status_before_stop_failed");
        }
        await recording.stopAndUnloadAsync();
        logWalk("audio_recording_stopped");
        localAudioUri = recording.getURI();
        if (localAudioUri) {
          transcript = await transcribeAudioWithWhisper(localAudioUri);
          try {
            await FileSystem.deleteAsync(localAudioUri, { idempotent: true });
          } catch {}
        }
      }

      let coordsSnapshot = await readPrayerWalkRoutePoints();
      if (!coordsSnapshot.length) {
        coordsSnapshot = walkCoordsRef.current.slice();
      }
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
          await appendPrayerWalkRoutePoints([coordsSnapshot[coordsSnapshot.length - 1]]);
        } catch {}
      }
      if (coordsSnapshot.length < 1) {
        logWalk("no_route_points_captured");
        Alert.alert(
          "Route tracking limited",
          "We couldn’t collect a location point for your walk. Please ensure location services are enabled."
        );
        capture("walk_route_unavailable", { reason: "no_points" });
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
        ? Math.round((walkEndedAt - startedAt) / 1000)
        : null;
      const distanceMeters = computeDistanceMeters(
        coordsSnapshot.map((c) => ({ latitude: c.latitude, longitude: c.longitude }))
      );
      capture("walk_stopped", {
        duration_seconds: durationSeconds ?? 0,
        point_count: coordsSnapshot.length,
      });
      logWalk("walk_stopped", {
        duration_seconds: durationSeconds ?? 0,
        point_count: coordsSnapshot.length,
      });
      const finalSteps = await getFinalWalkStepCount(startedAt, walkEndedAt);

      if (startedAt && healthKitOptInRef.current) {
        try {
          const available = await isHealthKitAvailable();
          if (available) {
            const ok = await requestHealthPermissions();
            if (ok) {
              // NOTE: @kingstinct/react-native-healthkit currently exposes saveWorkoutSample
              // (and startWatchApp), but not a full live HKWorkoutSession lifecycle API
              // (start/observe/end). We keep the stable end-of-walk save flow here.
              await savePrayerWalkWorkout({
                startDate: new Date(startedAt),
                endDate: new Date(),
                distanceMeters: distanceMeters > 0 ? distanceMeters : undefined,
                route: coordsSnapshot,
              });
            }
          }
        } catch {}
      }

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
      setDraftWalkDistanceMeters(distanceMeters);
      setWalkStepCount(finalSteps);
      setVerseDraftRef("");
      setVerseDraftVersion("");
      setIsTranscribing(false);
      setIsProcessing(false);
      setShowEditModal(true);
      await writeActiveWalkSession(null);
      await clearPrayerWalkRoutePoints();
    } catch {
      logWalk("stop_failed");
      setIsTranscribing(false);
      Alert.alert("Error", "Could not finalize prayer walk.");
    } finally {
      stopWalkInFlightRef.current = false;
      try {
        deactivateKeepAwake();
      } catch {}
      setWalkCoords([]);
      stopWalkStepTracking();
      setIsTranscribing(false);
      setIsProcessing(false);
      logWalk("stop_finalized");
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const ok = await requestMicPermission();
      if (!ok) return;
      setWalkMapUri(null);
      setDraftWalkDistanceMeters(null);
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
      setIsTranscribing(true);
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
      setIsTranscribing(false);
      setShowEditModal(true);
      setDraftLocationName(null);
    } catch {
      setIsTranscribing(false);
      Alert.alert("Error", "Failed to process prayer.");
    } finally {
      // Keep the screen awake while recording so the phone doesn't sleep mid-prayer.
      try {
        deactivateKeepAwake();
      } catch {}
      setIsTranscribing(false);
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
      const prevState = lastAppStateRef.current;
      lastAppStateRef.current = state;
      logWalk("app_state_changed", {
        from: prevState,
        to: state,
        is_walking: isWalking,
        location_task: PRAYER_WALK_LOCATION_TASK,
        task_manager_available: isPrayerWalkTaskManagerAvailable,
        has_fallback_watcher: !!walkLocationSubRef.current,
        has_recording_ref: !!walkRecordingRef.current,
      });

      // When app goes background/inactive, lock so it requires auth when returning.
      if (state === "background" || state === "inactive") {
        // Do not stop an active Prayer Walk on app background/lock.
        // Audio/location background behavior is controlled by runtime modes + iOS capabilities.
        if (biometricLockEnabled) setIsLocked(true);
        return;
      }
  
      if (state === "active") {
        if (isWalking) {
          void hydrateWalkCoordsFromStorage("app_active");
        }

        // IMPORTANT: do NOT force-lock on active.
        // iOS can bounce AppState during the Face ID sheet which causes re-prompt loops.
        if (biometricLockEnabled && isLockedRef.current) {
          unlockWithBiometrics();
        }
  
        trySyncOfflineQueue();
      }
    });
  
    return () => sub.remove();
  }, [
    userId,
    trySyncOfflineQueue,
    biometricLockEnabled,
    unlockWithBiometrics,
    isWalking,
    logWalk,
    hydrateWalkCoordsFromStorage,
  ]);

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

  useEffect(() => {
    if (!isWalking) return;

    let cancelled = false;
    const syncFromStorage = async () => {
      const points = await hydrateWalkCoordsFromStorage("walking_poll");
      if (cancelled) return;
      const count = points.length;
      if (count <= walkLocationEventCountRef.current) return;
      walkLocationEventCountRef.current = count;
      if (count <= 3 || count % 20 === 0) {
        const last = points[count - 1];
        if (last) {
          logWalk("location_callback", {
            count,
            latitude: last.latitude,
            longitude: last.longitude,
            timestamp: last.timestamp,
          });
        }
      }
    };

    void syncFromStorage();
    const interval = setInterval(() => {
      void syncFromStorage();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isWalking, hydrateWalkCoordsFromStorage, logWalk]);

  
  
  const uploadWalkMapToSupabase = async (userId: string, prayerId: string, localUri: string) => {
    const path = `${userId}/${prayerId}/map.png`;
  
    const uploadStart = Date.now();
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      if (!base64 || base64.length < 5000) {
        console.log("walk:map_upload_invalid_base64", { len: base64?.length ?? 0 });
        capture("walk_map_upload_failed", { ms: Date.now() - uploadStart, error_code: "invalid_base64" });
        return null;
      }
  
      const bytes = b64ToBytes(base64);
      capture("walk_map_upload_started", { bytes: bytes.length });
  
      const { error } = await getSupabase()
        .storage
        .from("prayer-walk-maps")
        .upload(path, bytes, {
          contentType: "image/png",
          upsert: true,
        });
  
      if (error) {
        console.log("walk:map_upload_error", error);
        capture("walk_map_upload_failed", {
          ms: Date.now() - uploadStart,
          error_code: String((error as any)?.code || (error as any)?.name || "upload_failed"),
        });
        return null;
      }
  
      console.log("walk:map_upload_ok", { path, bytes: bytes.length });
      capture("walk_map_upload_succeeded", { ms: Date.now() - uploadStart });
      return path;
    } catch (e) {
      console.log("walk:map_upload_exception", e);
      capture("walk_map_upload_failed", { ms: Date.now() - uploadStart, error_code: "exception" });
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
      entry_source: entrySource,
      has_audio: editorMode === "audio" && !!draftAudioUri,
      image_count: draftPhotoUris.length,
      has_verse: !!draftBibleRef,
      has_location: !!draftLocationName,
      has_walk_map: entrySource === "walk" && !!walkMapUri,
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

        const walkDistanceMetersForSave =
          entrySource === "walk" && typeof draftWalkDistanceMeters === "number"
            ? Math.max(0, draftWalkDistanceMeters)
            : null;
        const walkStepsForSave =
          entrySource === "walk" && typeof walkStepCount === "number"
            ? Math.max(0, Math.floor(walkStepCount))
            : null;
        const prayerInsertPayload = {
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
          walk_distance_meters: walkDistanceMetersForSave,
          walk_steps: walkStepsForSave,
        };
        if (__DEV__ && entrySource === "walk") {
          console.log("walk:prayer_insert_payload", {
            id: prayerInsertPayload.id,
            entry_source: prayerInsertPayload.entry_source,
            duration_seconds: prayerInsertPayload.duration_seconds,
            walk_distance_meters: prayerInsertPayload.walk_distance_meters,
            walk_steps: prayerInsertPayload.walk_steps,
          });
        }

        const { error: insertError } = await getSupabase()
          .from("prayers")
          .insert([prayerInsertPayload]);

        if (insertError) throw insertError;
        insertSucceeded = true;
        await cancelStreakFollowupNotification();
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
        setDraftWalkDistanceMeters(null);
        setWalkStepCount(null);
        setIsVerseEditorOpen(false);
        setVerseDraftRef("");
        setVerseDraftVersion("");
        void writeActiveWalkSession(null);
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

  const resetDraftEditorToIdle = () => {
    // Explicitly reset halo, since discard can happen while prayState is already "idle"
    // (no state transition => no guaranteed effect re-run).
    stopHalo();
    setShowEditModal(false);
    setDraftAudioUri(null);
    setDraftTranscript("");
    setDraftDuration(null);
    setRecording(null);
    setSecondsLeft(MAX_SECONDS_DEFAULT);
    setPrayState("idle");
    setIsProcessing(false);
    setIsTranscribing(false);
    setIsBookmarked(false);
    setKeepAudio(true);
    setEditorMode("audio");
    setEntrySource("audio");
    setDraftBibleRef(null);
    setDraftBibleVersion(null);
    setDraftBibleProvider("manual");
    setDraftPhotoUris([]);
    setDraftLocationName(null);
    setWalkMapUri(null);
    setDraftWalkDistanceMeters(null);
    setWalkStepCount(null);
    stopWalkStepTracking();
    void clearPrayerWalkRoutePoints();
    void writeActiveWalkSession(null);
    setIsVerseEditorOpen(false);
    setVerseDraftRef("");
    setVerseDraftVersion("");
  };

  const handleDiscardDraft = () => {
    resetDraftEditorToIdle();
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
    setDraftWalkDistanceMeters(null);
    setWalkStepCount(null);
    void clearPrayerWalkRoutePoints();
    void writeActiveWalkSession(null);
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
      edges={["left", "right", "bottom"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
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
              capture("walk_mode_toggled", { enabled: next });
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
              <ActivityIndicator color="#FFFFFF" />
            ) : prayState === "recording" || isWalking ? (
              <View style={[styles.stopSquare, { backgroundColor: "#FFFFFF" }]} />
            ) : (
              <Ionicons name="mic-outline" size={32} color="#FFFFFF" />
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
          ) : isTranscribing ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Transcribing prayer...
            </Text>
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
            onPress={openSettings}
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

      {/* Transcript Edit Modal */}
      <TranscriptEditor
        visible={showEditModal}
        mode={editorMode}
        entrySource={entrySource}
        walkMapUri={walkMapUri}
        walkStats={
          entrySource === "walk"
            ? {
                durationLabel:
                  typeof draftDuration === "number" && draftDuration >= 0
                    ? `${Math.floor(draftDuration / 60)}:${String(draftDuration % 60).padStart(2, "0")}`
                    : "0:00",
                distanceLabel:
                  typeof draftWalkDistanceMeters === "number"
                    ? `${(Math.max(0, draftWalkDistanceMeters) / 1000).toFixed(2)} km`
                    : "0.00 km",
                stepsLabel:
                  typeof walkStepCount === "number" ? String(walkStepCount) : "—",
              }
            : undefined
        }
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
                  mapSnapshotResolveRef.current?.(null, "snapshot_error");
                } finally {
                  mapSnapshotResolveRef.current = null;
                }
              }, 700);
            }}
          >
            {mapSnapshotCoords.length >= 1 ? (
              <>
                <Circle
                  center={mapSnapshotCoords[0]}
                  radius={5}
                  strokeWidth={2}
                  strokeColor="#FFFFFF"
                  fillColor="#2ECC71"
                />

                <Circle
                  center={mapSnapshotCoords[mapSnapshotCoords.length - 1]}
                  radius={5}
                  strokeWidth={2}
                  strokeColor="#FFFFFF"
                  fillColor="#E45858"
                />
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
});
