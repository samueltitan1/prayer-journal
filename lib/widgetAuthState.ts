import SharedGroupPreferences from "react-native-shared-group-preferences";
import { NativeModules, Platform } from "react-native";

const WIDGET_APP_GROUP = "group.app.prayerjournal.widget";
const WIDGET_AUTH_STATE_KEY = "widget_auth_state";

type WidgetAuthStatePayload = {
  signedIn: boolean;
  updatedAtMs: number;
};

type PossibleWidgetReloadModule = {
  reloadAllTimelines?: () => void;
  reloadTimelines?: () => void;
  reloadWidgetTimelines?: () => void;
};

function tryReloadWidgetTimelines() {
  // There is no single canonical bridge shape in dev/prod builds.
  // Probe known native modules and invoke a compatible reload method when present.
  const candidates: Array<PossibleWidgetReloadModule | undefined> = [
    NativeModules.ReactNativeWidgetExtension,
    NativeModules.ReactNativeWidgetExtensionModule,
    NativeModules.RNReactNativeWidgetExtension,
    NativeModules.PrayerJournalWidgetBridge,
  ];

  for (const module of candidates) {
    if (!module) continue;
    if (typeof module.reloadAllTimelines === "function") {
      module.reloadAllTimelines();
      return;
    }
    if (typeof module.reloadTimelines === "function") {
      module.reloadTimelines();
      return;
    }
    if (typeof module.reloadWidgetTimelines === "function") {
      module.reloadWidgetTimelines();
      return;
    }
  }
}

export async function setWidgetSignedInState(signedIn: boolean) {
  if (Platform.OS !== "ios") return;
  try {
    const payload: WidgetAuthStatePayload = {
      signedIn,
      updatedAtMs: Date.now(),
    };
    await SharedGroupPreferences.setItem(WIDGET_AUTH_STATE_KEY, payload, WIDGET_APP_GROUP);
    tryReloadWidgetTimelines();
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to sync widget auth state", error);
    }
  }
}

