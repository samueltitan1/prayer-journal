import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { buttons } from '../../theme/theme';

export default function Onboarding3() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Icon Container */}
        <View style={styles.iconContainerWrapper}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/padlock.png')}
              style={styles.icon}
            />
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headingFrame}>
          <Text style={styles.heading}>Keep Them Safe</Text>
        </View>

        {/* Description */}
        <View style={styles.paragraphFrame}>
          <Text style={styles.description}>
            Your prayers are private and sacred. Encrypted, secure, and yours alone.
          </Text>
        </View>
      </View>

      {/* Footer Container */}
      <View style={styles.footerContainer}>
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          <View style={styles.dot} />
          <View style={[styles.dot, { marginLeft: 8 }]} />
          <View style={[styles.dot, styles.dotActive, { marginLeft: 8 }]} />
        </View>

        {/* Begin Journey Button */}
        <TouchableOpacity
          style={[buttons.primary, styles.buttonFullWidth]}
          onPress={() => router.push('/onboarding/reminder')}
        >
          <Text style={styles.continueButton}>Begin My Journey</Text>
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
    marginBottom: 48,
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
  buttonFullWidth: {
    width: '100%',
  },
});

