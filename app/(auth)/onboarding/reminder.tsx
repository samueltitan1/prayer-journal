import ReminderConfirmationModal from '@/components/ReminderConfirmationModal';
import { useTheme } from '@/contexts/ThemeContext';
import { requestNotificationPermissions } from "@/lib/notifications";
import { buttons } from '@/theme/theme';
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingReminder() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [modalVisible, setModalVisible] = useState(false);

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
    const ok = await requestNotificationPermissions();
    if (!ok) {
      Alert.alert(
        "Notifications Disabled",
        "Enable notifications to receive daily prayer reminders. You can change this anytime in Settings."
      );
      return;
    }

    // Save pending reminder locally; we'll apply it after login once we have userId.
    const timeHHmm = formatHHmm(selectedTime);
    await AsyncStorage.setItem(
      "pending_prayer_reminder",
      JSON.stringify({ enabled: true, time: timeHHmm })
    );

    setModalVisible(true);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Clock Icon Container */}
        <View style={styles.iconContainerWrapper}>
          <View style={styles.iconContainer}>
           <Image
              source={require('@/assets/clock.png')}
              style={styles.icon}
            />
          </View>
        </View>

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
        <TouchableOpacity
          style={[buttons.primary, styles.buttonFullWidth]}
          onPress={handleSetReminder}
        >
          <Text style={styles.continueButton}>Set Reminder & Continue</Text>
        </TouchableOpacity>
        <ReminderConfirmationModal
          visible={modalVisible}
          time={formatTime(selectedTime)}
          onClose={() => { setModalVisible(false); router.replace('/(auth)/login') }}
        />

        {/* Skip Link */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
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
    paddingBottom: 48,
    width: '100%',
    alignItems: 'center',
    marginBottom: 48,
  },
  buttonFullWidth: {
    width: '100%',
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
    color: '#717182',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  continueButton: {},
  icon: {}
});
