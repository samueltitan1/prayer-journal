import { useEffect } from "react";
import { useRouter } from "expo-router";
import { trackOnboardingStepViewed } from "@/lib/analytics/onboarding";

export default function OnboardingSplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    trackOnboardingStepViewed("splash");
    router.replace("/(auth)/onboarding/welcome");
  }, [router]);

  return null;
}
