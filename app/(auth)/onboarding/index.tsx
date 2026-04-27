import { getOnboardingResponsesSnapshot, upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { markOnboardingSessionCompleted } from "@/lib/analytics/onboarding";
import { getEntitlement } from "@/lib/subscriptions";
import { getSupabase } from "@/lib/supabaseClient";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function OnboardingIndex() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        const userId = data.session?.user?.id ?? null;
        if (!userId) {
          router.replace("/(auth)/onboarding/welcome");
          return;
        }

        const onboarding = await getOnboardingResponsesSnapshot(userId);
        const completed = Boolean(onboarding?.onboarding_completed_at);
        const step = onboarding?.onboarding_step ?? null;

        if (completed) {
          const entitlement = await getEntitlement(userId);
          if (!entitlement.active) {
            await upsertOnboardingResponses(userId, { onboarding_step: "paywall" });
            router.replace("/(auth)/onboarding/paywall");
            return;
          }
          markOnboardingSessionCompleted();
          router.replace("/(tabs)/journal");
          return;
        }

        const allowed = new Set([
          "welcome",
          "survey",
          "privacy",
          "biometric-setup",
          "apple-health",
          "reminder",
          "preparing",
          "paywall",
          "congratulations",
        ]);

        if (step === "login" || step === "signup") {
          const entitlement = await getEntitlement(userId);
          if (entitlement.active) {
            markOnboardingSessionCompleted();
            router.replace("/(tabs)/journal");
            return;
          }
          await upsertOnboardingResponses(userId, { onboarding_step: "preparing" });
          router.replace("/(auth)/onboarding/preparing");
          return;
        }

        if (step && allowed.has(step)) {
          router.replace(`/(auth)/onboarding/${step}`);
          return;
        }

        router.replace("/(auth)/onboarding/welcome");
      } catch {
        router.replace("/(auth)/onboarding/welcome");
      }
    };

    void run();
  }, [router]);

  return null;
}
