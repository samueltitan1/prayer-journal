import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import ReminderConfirmationModal from '@/components/ReminderConfirmationModal';
import { useAuth } from '@/contexts/AuthProvider';
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import {
  requestNotificationPermissionsDetailed,
  scheduleDailyPrayerNotification,
  wasStartupNotificationDenied,
} from "@/lib/notifications";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { upsertUserSettingsOnboarding } from "@/lib/userSettings";
import { colors } from "@/theme/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from "expo-haptics";
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PENDING_PRAYER_REMINDER_KEY_PREFIX = "pending_prayer_reminder";
const LEGACY_PENDING_PRAYER_REMINDER_KEY = "pending_prayer_reminder";

export default function OnboardingReminder() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [hasPickedTime, setHasPickedTime] = useState(false);
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showOpenSettings, setShowOpenSettings] = useState(false);
  const getPendingReminderKey = (uid: string) => `${PENDING_PRAYER_REMINDER_KEY_PREFIX}:${uid}`;

  useEffect(() => {
    trackOnboardingStepViewed("reminder");
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: "reminder",
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (date) {
      setSelectedTime(date);
      setHasPickedTime(true);
      setPermissionError(null);
      setShowOpenSettings(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  const formatHHmm = (date: Date) => {
    const hrs = `${date.getHours()}`.padStart(2, "0");
    const mins = `${date.getMinutes()}`.padStart(2, "0");
    return `${hrs}:${mins}`;
  };

  const handleSetReminder = async () => {
    if (!hasPickedTime || isSaving) return;
    setIsSaving(true);
    trackOnboardingAction("reminder", "continue");
    const startupDenied = await wasStartupNotificationDenied();
    const permission = await requestNotificationPermissionsDetailed({
      context: "reminder_setup",
      forceRequest: startupDenied,
    });

    if (!permission.granted) {
      const needsSettings = !permission.canAskAgain || (Platform.OS === "ios" && permission.denialCount >= 2);
      setShowOpenSettings(needsSettings);
      setPermissionError(
        needsSettings
          ? "Notifications are currently disabled. Open Settings to enable reminders."
          : "Please allow notifications so we can remind you at your chosen time."
      );
      setIsSaving(false);
      return;
    }
    setPermissionError(null);
    setShowOpenSettings(false);

    const timeHHmm = formatHHmm(selectedTime);
    await scheduleDailyPrayerNotification(timeHHmm);

    if (user?.id) {
      await AsyncStorage.setItem(
        getPendingReminderKey(user.id),
        JSON.stringify({ enabled: true, time: timeHHmm, userId: user.id })
      );
      await AsyncStorage.removeItem(LEGACY_PENDING_PRAYER_REMINDER_KEY);
      void upsertUserSettingsOnboarding(user.id, {
        daily_reminder_enabled: true,
        reminder_enabled: true,
        reminder_time: timeHHmm,
      });
    } else {
      await AsyncStorage.setItem(
        LEGACY_PENDING_PRAYER_REMINDER_KEY,
        JSON.stringify({ enabled: true, time: timeHHmm })
      );
    }

    setModalVisible(true);
    setIsSaving(false);
  };
  
  return (
    <OnboardingShell showBack={false}>
      <View style={styles.container}>
        <OnboardingHeader
          progress={getOnboardingProgress("reminder")}
          onBack={() => {
            trackOnboardingAction("reminder", "back");
            router.replace("/(auth)/onboarding/apple-health");
          }}
        />
        <View style={styles.contentContainer}>
          
          {/* Heading */}
          <View style={styles.headingFrame}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              When would you like to pray each day?
            </Text>
          </View>

          {/* Description */}
          <View style={styles.paragraphFrame}>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Choose a moment to dedicate to God each day. You can always adjust this later.
            </Text>
          </View>

          {/* Time Picker Container */}
          <View style={styles.timePickerContainer}>
            <TouchableOpacity
              style={styles.timePickerButton}
              onPress={() => {
                void Haptics.selectionAsync();
                setShowPicker(true);
              }}
            >
              <Text style={[styles.timeDisplay, { color: colors.textPrimary }]}>{formatTime(selectedTime)}</Text>
            </TouchableOpacity>
            
            {showPicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant={Platform.OS === "ios" ? "light" : undefined}
                onChange={handleTimeChange}
                style={Platform.OS === 'ios' ? styles.dateTimePicker : undefined}
              />
            )}
          </View>
        </View>

        {/* Footer Container */}
        <View style={styles.footerContainer}>
          <PrimaryButton
            title={isSaving ? "Saving..." : "Continue"}
            onPress={handleSetReminder}
            disabled={!hasPickedTime || isSaving}
          />
          {permissionError ? (
            <Text style={[styles.permissionError, { color: colors.textSecondary }]}>{permissionError}</Text>
          ) : null}
          {showOpenSettings ? (
            <TouchableOpacity
              style={[styles.settingsButton, { borderColor: `${colors.textSecondary}55` }]}
              onPress={() => {
                void Haptics.selectionAsync();
                Linking.openSettings();
              }}
            >
              <Text style={[styles.settingsText, { color: colors.textPrimary }]}>Open Settings</Text>
            </TouchableOpacity>
          ) : null}
          <ReminderConfirmationModal
            visible={modalVisible}
            time={formatTime(selectedTime)}
            onClose={() => {
              setModalVisible(false);
              router.replace('/(auth)/onboarding/signup');
            }}
          />
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  iconContainerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(227,198,123,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    maxWidth: '90%',
  },
  heading: {
    fontSize: 19,
    lineHeight: 24,
    color: '#2F2F2F',
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  paragraphFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    maxWidth: '90%',
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: '#717182',
    textAlign: 'center',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  timePickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  timePickerButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  timeDisplay: {
    fontSize: 32,
    lineHeight: 40,
    color: '#2F2F2F',
    fontWeight: '600',
    fontFamily: 'Inter_400Regular',
  },
  dateTimePicker: {
    width: '100%',
    height: 200,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: "auto",
    marginBottom: 0,
  },
  permissionError: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#717182',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  settingsButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5D3CD",
  },
  settingsText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#2F2F2F",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  icon: {}
});
