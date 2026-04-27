import { capture } from "@/lib/posthog";

// SQL migration (run once):
// ALTER TABLE public.onboarding_responses
//   ADD COLUMN IF NOT EXISTS onboarding_step text,
//   ADD COLUMN IF NOT EXISTS onboarding_last_seen_at timestamptz;

type OnboardingAction = "continue" | "back" | "skip";

type CanonicalSurveyAnswer = string | string[];

type ScreenMapping = {
  primary: string;
  aliases?: string[];
};

const STEP_SCREEN_MAP: Record<string, ScreenMapping> = {
  splash: { primary: "splash" },
  welcome: { primary: "affirmation", aliases: ["benefits_1"] },
  login: { primary: "auth" },
  signup: { primary: "auth" },
  "survey-1": { primary: "survey_q1" },
  "survey-2": { primary: "survey_q2" },
  "survey-3": { primary: "survey_q3" },
  "survey-4": { primary: "survey_q4" },
  "survey-5": { primary: "survey_q5" },
  "survey-6": { primary: "survey_q6" },
  "survey-7": { primary: "survey_q7" },
  "survey-8": { primary: "survey_q8" },
  "survey-9": { primary: "survey_q9" },
  "survey-sp1": { primary: "benefits_1", aliases: ["features_1"] },
  "survey-sp2": { primary: "benefits_2", aliases: ["features_2"] },
  "survey-sp3": { primary: "benefits_3", aliases: ["features_3"] },
  "survey-sp4": { primary: "social_proof", aliases: ["expectations"] },
  privacy: { primary: "privacy" },
  "biometric-setup": { primary: "theme_setup" },
  "apple-health": { primary: "theme_setup" },
  reminder: { primary: "reminder_setup" },
  preparing: { primary: "preparing" },
  paywall: { primary: "paywall" },
  congratulations: { primary: "social_proof", aliases: ["expectations"] },
};

let lastScreenName: string | null = null;
let lastCompletedStep: string | null = null;
let abandonmentTracked = false;
let onboardingSessionCompleted = false;

const normalizeStepName = (step: string) => step.toLowerCase().replace(/-/g, "_");

const getCanonicalScreenNames = (step: string): string[] => {
  const mapping = STEP_SCREEN_MAP[step];
  if (!mapping) return [normalizeStepName(step)];
  return [mapping.primary, ...(mapping.aliases ?? [])];
};

const getCanonicalStep = (step: string): string => getCanonicalScreenNames(step)[0] ?? normalizeStepName(step);

export const trackOnboardingScreenViewed = (screenName: string, sourceStep?: string) => {
  capture("onboarding_screen_viewed", {
    screen_name: screenName,
    source_step: sourceStep,
  });
  lastScreenName = screenName;
};

export const trackOnboardingStart = () => {
  capture("onboarding_started");
  onboardingSessionCompleted = false;
  abandonmentTracked = false;
};

export const trackOnboardingStepViewed = (step: string) => {
  capture("onboarding_step_viewed", { onboarding_step: step });
  const canonicalScreens = getCanonicalScreenNames(step);
  for (const screenName of canonicalScreens) {
    trackOnboardingScreenViewed(screenName, step);
  }
};

export const trackOnboardingAction = (
  step: string,
  action: OnboardingAction
) => {
  capture("onboarding_action", { onboarding_step: step, action });
  if (action === "continue") {
    trackOnboardingStepCompleted(getCanonicalStep(step), step);
  }
};

export const trackOnboardingStepCompleted = (step: string, sourceStep?: string) => {
  capture("onboarding_step_completed", {
    step,
    source_step: sourceStep,
  });
  lastCompletedStep = step;
};

export const trackSurveyQuestionAnswered = (
  qIndex: number,
  questionKey: string,
  answer: CanonicalSurveyAnswer
) => {
  capture("survey_question_answered", {
    q_index: qIndex,
    question_key: questionKey,
    selection_count: Array.isArray(answer) ? answer.length : 1,
    question_number: qIndex,
    question_id: questionKey,
    answer,
  });
};

export const trackSignupMethodSelected = (method: "email" | "apple" | "google") => {
  capture("signup_method_selected", { method });
};

export const trackAuthResult = (
  method: "email" | "apple" | "google",
  result: "success" | "error",
  errorCode?: string
) => {
  capture("auth_result", {
    method,
    result,
    error_code: errorCode,
  });
};

export const trackPaywallViewed = () => {
  capture("paywall_viewed");
};

export const trackPurchaseResult = (
  result: "success" | "error" | "cancel",
  productId?: string
) => {
  capture("purchase_result", { result, product_id: productId });
};

export const trackOnboardingCompleted = () => {
  capture("onboarding_completed");
};

export const trackOnboardingAbandoned = (reason: "app_background" | "screen_unmount") => {
  if (abandonmentTracked || onboardingSessionCompleted) return;
  abandonmentTracked = true;
  capture("onboarding_abandoned", {
    reason,
    last_screen: lastScreenName,
    step: lastCompletedStep,
  });
};

export const markOnboardingSessionCompleted = () => {
  onboardingSessionCompleted = true;
  abandonmentTracked = false;
};
