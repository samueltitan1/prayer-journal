import { getOnboardingResponsesSnapshot } from "@/lib/onboardingResponses";
import { getSupabase } from "@/lib/supabaseClient";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function OnboardingIndex() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { data } = await getSupabase().auth.getSession();
      const userId = data.session?.user?.id ?? null;
      if (!userId) {
        router.replace("/(auth)/onboarding/welcome");
        return;
      }

      const onboarding = await getOnboardingResponsesSnapshot(userId);
      const step = onboarding?.onboarding_step ?? null;
      const allowed = new Set([
        "welcome",
        "survey",
        "privacy",
        "apple-health",
        "reminder",
        "signup",
        "login",
        "preparing",
        "paywall",
        "congratulations",
      ]);

      if (step && allowed.has(step)) {
        router.replace(`/(auth)/onboarding/${step}`);
        return;
      }

      router.replace("/(auth)/onboarding/welcome");
    };

    void run();
  }, [router]);

  return null;
}
