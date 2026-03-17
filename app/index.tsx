import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from '@/lib/onboardingResponses';
import { getEntitlement } from '@/lib/subscriptions';
import { getSupabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen() {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function resolveAuthAndNavigate() {
      const { data } = await getSupabase().auth.getSession();
      const auth = Boolean(data.session);
      setIsAuthenticated(auth);
      setAuthResolved(true);

      if (!auth) {
        if (__DEV__) console.log("boot: no session -> welcome");
        router.replace('/(auth)/onboarding/welcome');
        return;
      }

      const userId = data.session?.user?.id;
      if (!userId) {
        console.error("boot: session present but missing userId");
        router.replace('/(auth)/onboarding/welcome');
        return;
      }

      // --- Onboarding snapshot ---
      let onboarding: any = null;
      try {
        if (__DEV__) console.log("boot: fetching onboarding snapshot", userId);
        onboarding = await getOnboardingResponsesSnapshot(userId);
        if (__DEV__) console.log("boot: onboarding snapshot OK", {
          hasSnapshot: Boolean(onboarding),
          step: onboarding?.onboarding_step ?? null,
          completedAt: onboarding?.onboarding_completed_at ?? null,
        });
      } catch (e) {
        console.error("boot: onboarding snapshot FAILED", e);
        // If onboarding fetch fails, keep user in onboarding flow (safe fallback)
        router.replace('/(auth)/onboarding/welcome');
        return;
      }

      const completed = Boolean(onboarding?.onboarding_completed_at);
      const step = onboarding?.onboarding_step ?? null;

      if (!completed) {
        const allowed = new Set([
          "welcome",
          "survey",
          "privacy",
          "apple-health",
          "reminder",
          // NOTE: do NOT resume to auth screens once a session exists.
          "preparing",
          "paywall",
          "congratulations",
        ]);
        if (step === "login" || step === "signup") {
          if (__DEV__) console.log("boot: step is auth screen (login/signup) while authed -> entitlement check");
          try {
            const entitlement = await getEntitlement(userId);
            if (__DEV__) console.log("boot: entitlement (auth-step) OK", entitlement);

            if (entitlement.active) {
              // Returning user: go straight to the app.
              if (__DEV__) console.log("boot: entitled (auth-step) -> tabs/journal");
              router.replace('/(tabs)/journal');
              return;
            }

            // Not entitled: send to paywall.
            if (__DEV__) console.log("boot: not entitled (auth-step) -> paywall");
            await upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
            router.replace('/(auth)/onboarding/paywall');
            return;
          } catch (e) {
            console.error("boot: entitlement (auth-step) FAILED", e);
            // Safe fallback.
            router.replace('/(auth)/onboarding/paywall');
            return;
          }
        }
        if (step && allowed.has(step)) {
          if (__DEV__) console.log("boot: resume onboarding ->", step);
          router.replace(`/(auth)/onboarding/${step}`);
          return;
        }
        if (__DEV__) console.log("boot: onboarding incomplete -> welcome");
        router.replace('/(auth)/onboarding/welcome');
        return;
      }

      // --- Entitlement ---
      try {
        if (__DEV__) console.log("boot: checking entitlement", userId);
        const entitlement = await getEntitlement(userId);
        if (__DEV__) console.log("boot: entitlement OK", entitlement);

        if (!entitlement.active) {
          if (__DEV__) console.log("boot: onboarding complete but no entitlement -> paywall");
          await upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
          router.replace('/(auth)/onboarding/paywall');
          return;
        }
      } catch (e) {
        console.error("boot: entitlement FAILED", e);
        // If entitlement check fails, route to paywall (safe default) instead of crashing.
        router.replace('/(auth)/onboarding/paywall');
        return;
      }

      if (__DEV__) console.log("boot: entitled -> tabs/journal");
      router.replace('/(tabs)/journal');
    }

    resolveAuthAndNavigate();
  }, []);

  // Show splash UI while loading auth state
  return (
    <SafeAreaView style={styles.container} data-name="Splash" data-node-id="2:778">
      <View style={styles.contentContainer} data-name="Container" data-node-id="2:780">
        <View style={styles.splashScreen} data-name="SplashScreen" data-node-id="2:781">
          {/* Logo Container */}
          <View style={styles.logoContainer} data-name="Container" data-node-id="2:782">
            <View style={styles.logo} data-name="Logo" data-node-id="2:783">
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logoVector}
                data-name="Vector (Stroke)"
                data-node-id="83:3698"
              />
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoVector1}
                data-name="Vector (Stroke)"
                data-node-id="83:3699"
              />
            </View>
          </View>

          {/* Text Container */}
          <View style={styles.textContainer} data-name="Container" data-node-id="2:809">
            <View style={styles.titleFrame} data-name="SplashScreen" data-node-id="2:810">
              <Text style={styles.title} data-node-id="2:811">
                Prayer Journal
              </Text>
            </View>
            <View style={styles.subtitleFrame} data-name="Paragraph" data-node-id="2:812">
              <Text style={styles.subtitle} data-node-id="2:813">
                Pray. Reflect. Grow.
              </Text>
            </View>
          </View>
        </View>
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
  splashScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoVector: {
    width: 3,
    height: 63,
    resizeMode: 'contain',
    position: 'absolute',
    top: 7,
    left: 54.5,
  },
  logoVector1: {
    width: 112,
    height: 112,
    resizeMode: 'contain',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '90%',
    marginTop: 24,
  },
  titleFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    lineHeight: 36,
    color: '#2F2F2F',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.24,
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  subtitleFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.28,
    fontFamily: 'Inter_400Regular',
  },
});
