import { capture } from "@/lib/posthog";

// SQL migration (run once):
// ALTER TABLE public.onboarding_responses
//   ADD COLUMN IF NOT EXISTS onboarding_step text,
//   ADD COLUMN IF NOT EXISTS onboarding_last_seen_at timestamptz;

export const trackOnboardingStart = () => {
  capture("onboarding_started");
};

export const trackOnboardingStepViewed = (step: string) => {
  capture("onboarding_step_viewed", { onboarding_step: step });
};

export const trackOnboardingAction = (
  step: string,
  action: "continue" | "back" | "skip"
) => {
  capture("onboarding_action", { onboarding_step: step, action });
};

export const trackSurveyQuestionAnswered = (
  qIndex: number,
  questionKey: string,
  selectionCount: number
) => {
  capture("survey_question_answered", {
    q_index: qIndex,
    question_key: questionKey,
    selection_count: selectionCount,
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
