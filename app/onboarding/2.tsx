import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
export default function Onboarding2() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.container} data-name="Onboarding/2" data-node-id="1:27">
      <View style={styles.contentContainer} data-name="Container" data-node-id="1:30">
        {/* Icon Container */}
        <View style={styles.iconContainerWrapper} data-name="Container" data-node-id="1:31">
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/plant.png')}
              style={styles.icon}
              data-name="Icon"
              data-node-id="1:32"
            />
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headingFrame} data-name="Heading 1" data-node-id="1:36">
          <Text style={styles.heading} data-node-id="1:37">
            See How You Grow
          </Text>
        </View>

        {/* Description */}
        <View style={styles.paragraphFrame} data-name="Paragraph" data-node-id="1:38">
          <Text style={styles.description} data-node-id="1:39">
            Playback and read through your prayer journey with weekly and monthly reflections and summaries.
          </Text>
        </View>
      </View>

      {/* Footer Container */}
      <View style={styles.footerContainer} data-name="Container" data-node-id="1:40">
        {/* Pagination Dots */}
        <View style={styles.paginationContainer} data-name="Container" data-node-id="1:41">
          <View style={styles.dot} data-name="Button" data-node-id="1:42" />
          <View style={[styles.dot, styles.dotActive, { marginLeft: 8 }]} data-name="Button" data-node-id="1:43" />
          <View style={[styles.dot, { marginLeft: 8 }]} data-name="Button" data-node-id="1:44" />
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/onboarding/3')}
          data-name="Button"
          data-node-id="1:45"
        >
          <Text style={styles.continueButtonText} data-node-id="1:46">
            Continue
          </Text>
          <Image
            source={require('../../assets/placeholder.png')}
            style={styles.continueIcon}
            data-name="Icon"
            data-node-id="1:47"
          />
        </TouchableOpacity>

        {/* Skip Button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push('/auth/login')}
          data-name="Button"
          data-node-id="1:49"
        >
          <Text style={styles.skipText} data-node-id="1:50">
            Skip
          </Text>
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
  icon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
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
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    width: '100%',
    alignItems: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(113,113,130,0.3)',
  },
  dotActive: {
    width: 32,
    backgroundColor: '#E3C67B',
  },
  continueButton: {
    width: '100%',
    height: 48,
    borderRadius: 9999,
    backgroundColor: '#E3C67B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  continueButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2F2F2F',
    fontWeight: '500',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  continueIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    marginLeft: 8,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
});

