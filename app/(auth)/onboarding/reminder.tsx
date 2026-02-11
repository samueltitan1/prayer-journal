import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import ReminderConfirmationModal from '@/components/ReminderConfirmationModal';
import { useAuth } from '@/contexts/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import {
  trackOnboardingAction,
  trackOnboardingStepViewed,
} from "@/lib/analytics/onboarding";
import { requestNotificationPermissions } from "@/lib/notifications";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { upsertUserSettingsOnboarding } from '@/lib/userSettings';
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingReminder() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [modalVisible, setModalVisible] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    trackOnboardingStepViewed("reminder");
    void upsertUserSettingsOnboarding(user?.id, {
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
    trackOnboardingAction("reminder", "continue");
    const ok = await requestNotificationPermissions();
    if (!ok) {
      setPermissionError("You can enable reminders later in Settings.");
      return;
    }
    setPermissionError(null);

    // Save pending reminder locally; we'll apply it after login once we have userId.
    const timeHHmm = formatHHmm(selectedTime);
    await AsyncStorage.setItem(
      "pending_prayer_reminder",
      JSON.stringify({ enabled: true, time: timeHHmm })
    );
    if (user?.id) {
      void upsertUserSettingsOnboarding(user.id, {
        reminder_enabled: true,
        reminder_time: timeHHmm,
      });
    } else {
      console.warn("Missing userId for reminder save");
    }

    setModalVisible(true);
  };
  
  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.heading}>
            When would you like to pray each day?
          </Text>
        </View>

        {/* Description */}
        <View style={styles.paragraphFrame}>
          <Text style={styles.description}>
            We'll send you a gentle reminder to pray. You can change it anytime in Settings.
          </Text>
        </View>

        {/* Time Picker Container */}
        <View style={styles.timePickerContainer}>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => {
              if (Platform.OS === 'android') {
                setShowPicker(true);
              }
            }}
          >
            <Text style={styles.timeDisplay}>{formatTime(selectedTime)}</Text>
          </TouchableOpacity>
          
          {showPicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              style={Platform.OS === 'ios' ? styles.dateTimePicker : undefined}
            />
          )}
        </View>
      </View>

      {/* Footer Container */}
      <View style={styles.footerContainer}>
        {/* Set Reminder Button */}
        <PrimaryButton title="Continue" onPress={handleSetReminder} />
        {permissionError ? (
          <Text style={styles.permissionError}>{permissionError}</Text>
        ) : null}
        <ReminderConfirmationModal
          visible={modalVisible}
          time={formatTime(selectedTime)}
          onClose={() => {
            setModalVisible(false);
            router.replace('/(auth)/onboarding/signup');
          }}
        />

        {/* Skip Link */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            trackOnboardingAction("reminder", "skip");
            if (user?.id) {
              void upsertUserSettingsOnboarding(user.id, {
                reminder_enabled: false,
              });
            }
            router.replace('/(auth)/onboarding/signup');
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
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
    fontSize: 16,
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
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    width: '100%',
  },
  skipText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2F2F2F',
    fontWeight: '600',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  permissionError: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#717182',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  icon: {}
});
