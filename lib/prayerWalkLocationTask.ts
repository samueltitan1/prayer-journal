import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
type TaskManagerModule = {
  isTaskDefined: (taskName: string) => boolean;
  defineTask: (
    taskName: string,
    task: (taskBody: { data?: unknown; error?: { message?: string } | null }) => void | Promise<void>
  ) => void;
};
let TaskManager: TaskManagerModule | null = null;
let taskManagerLoadError: string | null = null;
let taskRegistrationError: string | null = null;

try {
  // Keep this defensive so app startup doesn't crash when native module isn't in the current dev client.
  TaskManager = require("expo-task-manager") as TaskManagerModule;
} catch {
  TaskManager = null;
  taskManagerLoadError = "native_module_missing";
}

export const PRAYER_WALK_LOCATION_TASK = "prayer_walk_location_task_v1";
export const isPrayerWalkTaskManagerAvailable = !!TaskManager;
export const getPrayerWalkTaskDiagnostics = () => ({
  taskManagerAvailable: isPrayerWalkTaskManagerAvailable,
  taskManagerLoadError,
  taskRegistrationError,
  taskName: PRAYER_WALK_LOCATION_TASK,
});
const PRAYER_WALK_ROUTE_STORAGE_KEY = "@prayer_walk_route_points_v1";
const PRAYER_WALK_ACTIVE_SESSION_STORAGE_KEY = "@prayer_walk_active_session_v1";

export type PrayerWalkRoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

const isValidPoint = (point: PrayerWalkRoutePoint) =>
  Number.isFinite(point.latitude) &&
  Number.isFinite(point.longitude) &&
  Number.isFinite(point.timestamp);

const parseStoredPoints = (value: string | null): PrayerWalkRoutePoint[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is PrayerWalkRoutePoint => {
      return (
        point &&
        typeof point === "object" &&
        isValidPoint({
          latitude: Number((point as any).latitude),
          longitude: Number((point as any).longitude),
          timestamp: Number((point as any).timestamp),
        })
      );
    });
  } catch {
    return [];
  }
};

export const readPrayerWalkRoutePoints = async (): Promise<PrayerWalkRoutePoint[]> => {
  const raw = await AsyncStorage.getItem(PRAYER_WALK_ROUTE_STORAGE_KEY);
  return parseStoredPoints(raw);
};

export const clearPrayerWalkRoutePoints = async () => {
  await AsyncStorage.removeItem(PRAYER_WALK_ROUTE_STORAGE_KEY);
};

export const clearPrayerWalkLocalState = async () => {
  await AsyncStorage.multiRemove([
    PRAYER_WALK_ROUTE_STORAGE_KEY,
    PRAYER_WALK_ACTIVE_SESSION_STORAGE_KEY,
  ]);
};

export const appendPrayerWalkRoutePoints = async (incoming: PrayerWalkRoutePoint[]) => {
  if (!incoming.length) return;
  const validIncoming = incoming.filter(isValidPoint);
  if (!validIncoming.length) return;

  const existing = await readPrayerWalkRoutePoints();
  const merged = [...existing];

  for (const point of validIncoming) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.latitude === point.latitude &&
      last.longitude === point.longitude &&
      last.timestamp === point.timestamp
    ) {
      continue;
    }
    merged.push(point);
  }

  await AsyncStorage.setItem(PRAYER_WALK_ROUTE_STORAGE_KEY, JSON.stringify(merged));
};

if (TaskManager && !TaskManager.isTaskDefined(PRAYER_WALK_LOCATION_TASK)) {
  try {
    TaskManager.defineTask(
      PRAYER_WALK_LOCATION_TASK,
      async (taskBody: { data?: unknown; error?: { message?: string } | null }) => {
        const { data, error } = taskBody;
        if (error) {
          if (__DEV__) {
            console.log("[walk-task] error", error.message);
          }
          return;
        }

        const payload = data as { locations?: Location.LocationObject[] } | undefined;
        const locations = payload?.locations;
        if (!Array.isArray(locations) || !locations.length) return;

        const points: PrayerWalkRoutePoint[] = locations
          .map((location) => ({
            latitude: Number(location?.coords?.latitude),
            longitude: Number(location?.coords?.longitude),
            timestamp: Number(location?.timestamp ?? Date.now()),
          }))
          .filter(isValidPoint);

        if (!points.length) return;

        try {
          await appendPrayerWalkRoutePoints(points);
          if (__DEV__) {
            const last = points[points.length - 1];
            console.log("[walk-task] points_appended", {
              added: points.length,
              latitude: last.latitude,
              longitude: last.longitude,
              timestamp: last.timestamp,
            });
          }
        } catch (taskError) {
          if (__DEV__) {
            console.log("[walk-task] append_failed", taskError);
          }
        }
      }
    );
  } catch (error: any) {
    taskRegistrationError = String(error?.message || error || "registration_failed");
    if (__DEV__) {
      console.log("[walk-task] registration_failed", taskRegistrationError);
    }
  }
}
