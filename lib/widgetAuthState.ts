import SharedGroupPreferences from "react-native-shared-group-preferences";
import { Platform } from "react-native";

const WIDGET_APP_GROUP = "group.app.prayerjournal.widget";
const WIDGET_AUTH_KEY = "widget_signed_in";

export async function setWidgetSignedInState(signedIn: boolean) {
  if (Platform.OS !== "ios") return;
  try {
    await SharedGroupPreferences.setItem(
      WIDGET_AUTH_KEY,
      { signedIn },
      WIDGET_APP_GROUP
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to sync widget auth state", error);
    }
  }
}

