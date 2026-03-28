import { getSupabase } from "@/lib/supabaseClient";
import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";

const DEFAULT_ENTITLEMENT_ID = "pro";

let configured = false;

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
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
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
    await Purchases.logOut();
    return;
  }
  await Purchases.logIn(userId);
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
