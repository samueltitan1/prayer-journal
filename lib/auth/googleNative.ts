import { getSupabase } from "@/lib/supabaseClient";
import Constants from "expo-constants";
import { Platform } from "react-native";

let configured = false;
let googleModule: typeof import("@react-native-google-signin/google-signin") | null = null;

type GoogleClientIds = {
  webClientId: string;
  iosClientId?: string;
  source: "process.env" | "expo.extra" | "mixed";
};

const getConfigExtra = () => {
  const constantsWithLegacy = Constants as typeof Constants & {
    manifest?: { extra?: Record<string, unknown> };
    manifest2?: { extra?: Record<string, unknown> };
  };
  return (
    Constants.expoConfig?.extra ??
    constantsWithLegacy.manifest2?.extra ??
    constantsWithLegacy.manifest?.extra ??
    {}
  ) as Record<string, unknown>;
};

const getString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const resolveGoogleClientIds = (): GoogleClientIds => {
  const extra = getConfigExtra();
  const googleExtra =
    typeof extra.google === "object" && extra.google
      ? (extra.google as Record<string, unknown>)
      : {};

  const envWebClientId = getString(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const envIosClientId = getString(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const extraWebClientId = getString(googleExtra.webClientId);
  const extraIosClientId = getString(googleExtra.iosClientId);

  const webClientId = envWebClientId || extraWebClientId;
  const iosClientId = envIosClientId || extraIosClientId || undefined;

  const source: GoogleClientIds["source"] =
    envWebClientId && !extraWebClientId
      ? "process.env"
      : !envWebClientId && extraWebClientId
      ? "expo.extra"
      : "mixed";

  return { webClientId, iosClientId, source };
};

const decodeJwtPayload = (token: string) => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = (globalThis as any)?.atob
      ? (globalThis as any).atob(padded)
      : null;
    if (!decoded) return null;
    return JSON.parse(
      decodeURIComponent(
        decoded
          .split("")
          .map((c: string) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join("")
      )
    );
  } catch {
    return null;
  }
};


const loadGoogleModule = async () => {
  if (!googleModule) {
    googleModule = await import("@react-native-google-signin/google-signin");
  }
  return googleModule;
};

export const initGoogleSigninOnce = async () => {
  if (configured) return;
  if (Constants.appOwnership === "expo") return;

  const { webClientId, iosClientId, source } = resolveGoogleClientIds();

  if (__DEV__) {
    console.log("google: runtime client IDs resolved", {
      webClientIdPresent: Boolean(webClientId),
      iosClientIdPresent: Boolean(iosClientId),
      source,
    });
  }

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

    const { GoogleSignin } = await loadGoogleModule();
    const userInfo = await GoogleSignin.signIn();
    const idToken =
    (userInfo as any)?.idToken ??
    (userInfo as any)?.user?.idToken ??
    (userInfo as any)?.data?.idToken;
    if (!idToken) {
      console.warn("Google sign-in returned no token");
      return null;
    }

    const nonceInToken = decodeJwtPayload(idToken)?.nonce;
    if (__DEV__) {
      console.log("Google id_token nonce:", nonceInToken);
    }

    const { error } = await getSupabase().auth.signInWithIdToken(
      nonceInToken
        ? { provider: "google", token: idToken, nonce: nonceInToken }
        : { provider: "google", token: idToken }
    );
    if (error) {
      throw error;
    }

    const { data } = await getSupabase().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch (err: any) {
    const { statusCodes } = (googleModule ?? {}) as any;
    if (statusCodes && err?.code === statusCodes.SIGN_IN_CANCELLED) {
      if (__DEV__) console.log("User cancelled Google sign-in");
      return null;
    }
    if (statusCodes && err?.code === statusCodes.IN_PROGRESS) {
      return null;
    }
    if (statusCodes && err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.warn("Google Play services not available");
      return null;
    }
    throw err;
  }
};
