import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function OnboardingSplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/onboarding/welcome");
  }, [router]);

  return null;
}
