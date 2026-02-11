import { getSupabase } from "@/lib/supabaseClient";
import Constants from "expo-constants";
import { Platform } from "react-native";

let configured = false;
let googleModule: typeof import("@react-native-google-signin/google-signin") | null = null;

const loadGoogleModule = async () => {
  if (!googleModule) {
    googleModule = await import("@react-native-google-signin/google-signin");
  }
  return googleModule;
};

export const initGoogleSigninOnce = async () => {
  if (configured) return;
  if (Constants.appOwnership === "expo") return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
  }

  const { GoogleSignin } = await loadGoogleModule();
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    offlineAccess: false,
  });

  configured = true;
};

export const signInWithGoogleToSupabase = async (): Promise<string | null> => {
  try {
    if (Constants.appOwnership === "expo") {
      throw new Error("Google Sign-In requires a Development Build.");
    }

    await initGoogleSigninOnce();

    if (Platform.OS === "android") {
      const { GoogleSignin } = await loadGoogleModule();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const { GoogleSignin, statusCodes } = await loadGoogleModule();
    const userInfo = await GoogleSignin.signIn();
    const idToken =
    (userInfo as any)?.idToken ??
    (userInfo as any)?.user?.idToken ??
    (userInfo as any)?.data?.idToken;
    if (!idToken) {
      throw new Error("Google Sign-In did not return an ID token.");
    }

    const { error } = await getSupabase().auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) {
      throw error;
    }

    const { data } = await getSupabase().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch (err: any) {
    const { statusCodes } = (googleModule ?? {}) as any;
    if (statusCodes && err?.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw err;
  }
};
