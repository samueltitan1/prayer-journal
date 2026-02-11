import Constants from "expo-constants";
import { Platform } from "react-native";
import type { QuantitySampleForSaving, QuantityTypeIdentifier } from "@kingstinct/react-native-healthkit";
// Local build commands (manual):
// npx expo prebuild --clean
// npx pod-install
// npx expo run:ios

export async function isHealthKitAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (Constants.appOwnership === "expo") return false;
  try {
    const { isHealthDataAvailable } = await import("@kingstinct/react-native-healthkit");
    return await isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (Constants.appOwnership === "expo") return false;
  try {
    const { requestAuthorization } = await import("@kingstinct/react-native-healthkit");
    await requestAuthorization({
      toRead: [
        "HKQuantityTypeIdentifierStepCount",
        "HKQuantityTypeIdentifierDistanceWalkingRunning",
      ],
      toShare: ["HKWorkoutTypeIdentifier", "HKQuantityTypeIdentifierDistanceWalkingRunning"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function readStepCountSample() {
  if (Platform.OS !== "ios") return null;
  if (Constants.appOwnership === "expo") return null;
  try {
    const { getMostRecentQuantitySample } = await import("@kingstinct/react-native-healthkit");
    return await getMostRecentQuantitySample("HKQuantityTypeIdentifierStepCount");
  } catch {
    return null;
  }
}

export async function savePrayerWalkWorkout(options: {
  startDate: Date;
  endDate: Date;
  distanceMeters?: number;
  route?: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>;
}) {
  if (Platform.OS !== "ios") return null;
  if (Constants.appOwnership === "expo") return null;
  try {
    const { saveWorkoutSample, WorkoutActivityType } = await import("@kingstinct/react-native-healthkit");
    const quantityType: QuantityTypeIdentifier =
      "HKQuantityTypeIdentifierDistanceWalkingRunning" as QuantityTypeIdentifier;
    const quantities: QuantitySampleForSaving[] =
      typeof options.distanceMeters === "number"
        ? [
            {
              startDate: options.startDate,
              endDate: options.endDate,
              quantityType,
              quantity: options.distanceMeters,
              unit: "m",
            },
          ]
        : [];

    const workout = await saveWorkoutSample(
      WorkoutActivityType.walking,
      quantities,
      options.startDate,
      options.endDate,
      typeof options.distanceMeters === "number"
        ? { distance: options.distanceMeters }
        : undefined
    );
    if (options.route && options.route.length > 1) {
      const locations = options.route.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        date: new Date(point.timestamp),
        altitude: 0,
        course: 0,
        horizontalAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
        verticalAccuracy: 0,
      }));
      await workout.saveWorkoutRoute(locations);
    }
    return workout;
  } catch {
    return null;
  }
}
