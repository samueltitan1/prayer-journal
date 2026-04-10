import { getSupabase } from "@/lib/supabaseClient";
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOfferings } from "react-native-purchases";

const DEFAULT_ENTITLEMENT_ID = "pro";
const DEBUG_LOGS_FLAG = "1";

let configured = false;
let configureInFlight: Promise<void> | null = null;
let lastSyncedAppUserId: string | null = null;

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

type RevenueCatKeys = {
  iosApiKey: string;
  androidApiKey: string;
  source: "process.env" | "expo.extra" | "mixed" | "missing";
  envIosDefined: boolean;
  envAndroidDefined: boolean;
  extraIosDefined: boolean;
  extraAndroidDefined: boolean;
};

const resolveRevenueCatKeys = () => {
  const extra = getConfigExtra();
  const revenuecatExtra =
    typeof extra.revenuecat === "object" && extra.revenuecat
      ? (extra.revenuecat as Record<string, unknown>)
      : {};

  const envIosApiKey = getString(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS);
  const envAndroidApiKey = getString(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID);
  const extraIosApiKey =
    getString(revenuecatExtra.iosApiKey) || getString(extra.revenuecatIosApiKey);
  const extraAndroidApiKey =
    getString(revenuecatExtra.androidApiKey) || getString(extra.revenuecatAndroidApiKey);

  const iosApiKey = envIosApiKey || extraIosApiKey;
  const androidApiKey = envAndroidApiKey || extraAndroidApiKey;
  const envDefined = Boolean(envIosApiKey || envAndroidApiKey);
  const extraDefined = Boolean(extraIosApiKey || extraAndroidApiKey);
  const source: RevenueCatKeys["source"] = !envDefined && !extraDefined
    ? "missing"
    : envDefined && !extraDefined
    ? "process.env"
    : !envDefined && extraDefined
    ? "expo.extra"
    : "mixed";

  return {
    iosApiKey,
    androidApiKey,
    source,
    envIosDefined: Object.prototype.hasOwnProperty.call(
      process.env,
      "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS"
    ),
    envAndroidDefined: Object.prototype.hasOwnProperty.call(
      process.env,
      "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID"
    ),
    extraIosDefined:
      typeof revenuecatExtra.iosApiKey !== "undefined" ||
      typeof extra.revenuecatIosApiKey !== "undefined",
    extraAndroidDefined:
      typeof revenuecatExtra.androidApiKey !== "undefined" ||
      typeof extra.revenuecatAndroidApiKey !== "undefined",
  } satisfies RevenueCatKeys;
};

function getEntitlementId() {
  return process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || DEFAULT_ENTITLEMENT_ID;
}

function getApiKeyForPlatform(keys: RevenueCatKeys) {
  if (Platform.OS === "ios") return keys.iosApiKey;
  if (Platform.OS === "android") return keys.androidApiKey;
  return keys.iosApiKey || keys.androidApiKey;
}

function getMissingApiKeyError() {
  if (Platform.OS === "ios") {
    return new Error(
      "Missing RevenueCat iOS API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS or extra.revenuecat.iosApiKey in app config."
    );
  }
  if (Platform.OS === "android") {
    return new Error(
      "Missing RevenueCat Android API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID or extra.revenuecat.androidApiKey in app config."
    );
  }
  return new Error(
    "Missing RevenueCat API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS/ANDROID or app config extra keys."
  );
}

export async function ensureRevenueCatConfigured(appUserId?: string | null) {
  if (configured) return;
  if (configureInFlight) {
    await configureInFlight;
    return;
  }

  configureInFlight = (async () => {
    const keys = resolveRevenueCatKeys();
    const apiKey = getApiKeyForPlatform(keys);
    if (__DEV__) {
      console.log("revenuecat: configure attempt", {
        platform: Platform.OS,
        appUserIdPresent: Boolean(appUserId),
        apiKeyPresent: Boolean(apiKey),
        source: keys.source,
        envIosDefined: keys.envIosDefined,
        envAndroidDefined: keys.envAndroidDefined,
        extraIosDefined: keys.extraIosDefined,
        extraAndroidDefined: keys.extraAndroidDefined,
      });
    }
    if (!apiKey) {
      throw getMissingApiKeyError();
    }
    if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_DEBUG_LOGS === DEBUG_LOGS_FLAG) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    } else {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }
    try {
      Purchases.configure({
        apiKey,
        appUserID: appUserId ?? undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (!message.includes("already configured")) {
        throw error;
      }
      if (__DEV__) {
        console.warn("RevenueCat configure called after native configure; reusing existing instance.");
      }
    }
    configured = true;
  })();

  try {
    await configureInFlight;
  } finally {
    configureInFlight = null;
  }
}

export async function syncRevenueCatIdentity(userId: string | null | undefined) {
  await ensureRevenueCatConfigured(userId ?? undefined);
  if (!userId) {
    if (lastSyncedAppUserId === null) {
      return;
    }
    try {
      await Purchases.logOut();
      if (__DEV__) {
        console.log("revenuecat: logged out to anonymous user");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      // No-op if RevenueCat is already anonymous.
      if (message.includes("current user is anonymous")) {
        lastSyncedAppUserId = null;
        return;
      }
      throw error;
    }
    lastSyncedAppUserId = null;
    return;
  }
  if (lastSyncedAppUserId === userId) {
    return;
  }
  const loginResult = await Purchases.logIn(userId);
  if (__DEV__) {
    console.log("revenuecat: logIn success", {
      appUserId: userId,
      created: loginResult.created,
    });
  }
  lastSyncedAppUserId = userId;
}

export async function restoreRevenueCatPurchases() {
  await ensureRevenueCatConfigured();
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo() {
  await ensureRevenueCatConfigured();
  return Purchases.getCustomerInfo();
}

export async function getRevenueCatOfferings() {
  await ensureRevenueCatConfigured();
  return Purchases.getOfferings();
}

export async function ensureRevenueCatPaywallReady(userId: string): Promise<PurchasesOfferings> {
  await syncRevenueCatIdentity(userId);
  const offerings = await getRevenueCatOfferings();
  const hasCurrent = Boolean(offerings.current);
  const hasAny = Object.keys(offerings.all ?? {}).length > 0;
  if (__DEV__) {
    console.log("revenuecat: offerings result", {
      hasCurrent,
      hasAny,
      offeringKeys: Object.keys(offerings.all ?? {}),
    });
  }
  if (!hasCurrent && !hasAny) {
    throw new Error("No RevenueCat offerings are configured for this app environment.");
  }
  return offerings;
}

export function hasActiveRevenueCatEntitlement(
  customerInfo: CustomerInfo,
  entitlementId = getEntitlementId()
) {
  return Boolean(customerInfo.entitlements.active?.[entitlementId]);
}

export function getRevenueCatEntitlementId() {
  return getEntitlementId();
}

export async function syncRevenueCatSubscription(appUserId: string) {
  const { error } = await getSupabase().functions.invoke("sync-revenuecat-subscription", {
    body: { appUserId },
  });
  if (error) {
    throw new Error(error.message || "Could not sync RevenueCat subscription.");
  }
}
