import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

export const BIOMETRIC_LOCK_ENABLED_KEY = "@biometric_lock_enabled";
export const BIOMETRIC_ONBOARDING_SEEN_KEY = "@biometric_onboarding_seen";

export type BiometricAvailability = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supported: boolean;
};

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = hasHardware
    ? await LocalAuthentication.isEnrolledAsync()
    : false;
  return {
    hasHardware: Boolean(hasHardware),
    isEnrolled: Boolean(isEnrolled),
    supported: Boolean(hasHardware && isEnrolled),
  };
}

export async function getBiometricLockEnabled() {
  const value = await AsyncStorage.getItem(BIOMETRIC_LOCK_ENABLED_KEY);
  return value === "true";
}

export async function setBiometricLockEnabled(enabled: boolean) {
  await AsyncStorage.setItem(BIOMETRIC_LOCK_ENABLED_KEY, String(enabled));
}

export async function hasSeenBiometricOnboarding() {
  const value = await AsyncStorage.getItem(BIOMETRIC_ONBOARDING_SEEN_KEY);
  return value === "true";
}

export async function markBiometricOnboardingSeen() {
  await AsyncStorage.setItem(BIOMETRIC_ONBOARDING_SEEN_KEY, "true");
}

export async function promptBiometricAuth(promptMessage: string) {
  return LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: "Use Passcode",
  });
}
