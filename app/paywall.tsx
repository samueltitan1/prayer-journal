import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function PaywallScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Prayers,</Text>
        <Text style={styles.subtitle}>Preserved in Peace</Text>
        <Text style={styles.description}>
          Choose the plan that nurtures your spiritual journey
        </Text>
      </View>

      <View style={styles.plans}>
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Core Plan</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>£2.99</Text>
              <Text style={styles.priceUnit}>/month</Text>
            </View>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>Voice prayer recording</Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>AI transcription & insights</Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>Weekly & monthly reflections</Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>60-day prayer archive</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => router.back()}
          >
            <Text style={styles.selectButtonText}>Select Core Plan</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.planCard, styles.planCardFeatured]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Most Sacred</Text>
          </View>
          <View style={styles.planHeader}>
            <View style={styles.planTitleRow}>
              <Text style={styles.planTitle}>Core + Forever</Text>
              {/* Icon */}
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>£4.99</Text>
              <Text style={styles.priceUnit}>/month</Text>
            </View>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>
                Everything in Core, plus:
              </Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>Keep your prayers forever</Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>Unlimited archive access</Text>
            </View>
            <View style={styles.featureItem}>
              {/* Check icon */}
              <Text style={styles.featureText}>Priority support</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.selectButton, styles.selectButtonFeatured]}
            onPress={() => router.back()}
          >
            <Text style={styles.selectButtonText}>Upgrade to Forever</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footerText}>
        Replaces the Core plan – cancel anytime. Your privacy is always
        protected.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  plans: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  planCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  planCardFeatured: {
    borderWidth: 2,
    borderColor: '#000',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    marginBottom: 24,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  priceUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  features: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
  },
  selectButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonFeatured: {
    backgroundColor: '#000',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    paddingHorizontal: 32,
    paddingBottom: 48,
    lineHeight: 16,
  },
});

