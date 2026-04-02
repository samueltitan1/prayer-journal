import { getSupabase } from "@/lib/supabaseClient";
import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";

const DEFAULT_ENTITLEMENT_ID = "pro";
const DEBUG_LOGS_FLAG = "1";

let configured = false;
let lastSyncedAppUserId: string | null = null;

const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

function getEntitlementId() {
  return process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || DEFAULT_ENTITLEMENT_ID;
}

function getApiKey() {
  if (Platform.OS === "ios") return iosApiKey;
  if (Platform.OS === "android") return androidApiKey;
  return iosApiKey || androidApiKey;
}

export async function ensureRevenueCatConfigured(appUserId?: string | null) {
  if (configured) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing RevenueCat API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS/ANDROID.");
  }
  if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_DEBUG_LOGS === DEBUG_LOGS_FLAG) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
  }
  Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });
  configured = true;
}

export async function syncRevenueCatIdentity(userId: string | null | undefined) {
  await ensureRevenueCatConfigured(userId ?? undefined);
  if (!userId) {
    if (lastSyncedAppUserId === null) {
      return;
    }
    try {
      await Purchases.logOut();
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
  await Purchases.logIn(userId);
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
