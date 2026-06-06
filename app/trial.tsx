import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { getSupabase } from "@/lib/supabaseClient";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function TrialRedirect() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        const sessionUserId = data.session?.user?.id;
        if (!sessionUserId) {
          router.replace("/(auth)/onboarding/welcome");
          return;
        }
        await upsertOnboardingResponses(sessionUserId, {
          onboarding_step: "paywall",
          onboarding_last_seen_at: new Date().toISOString(),
        });
        router.replace("/(auth)/onboarding/paywall");
      } catch {
        router.replace("/(auth)/onboarding/welcome");
      }
    })();
  }, [router]);

  return null;
}
