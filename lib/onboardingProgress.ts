export const SURVEY_QUESTION_COUNT = 7;

export const ONBOARDING_FLOW_STEPS = [
  "welcome",
  "survey-1",
  "survey-2",
  "survey-3",
  "survey-4",
  "survey-5",
  "survey-6",
  "survey-7",
  "privacy",
  "apple-health",
  "reminder",
  "preparing",
  "signup",
  "paywall",
  "congratulations",
] as const;

export type OnboardingStep = typeof ONBOARDING_FLOW_STEPS[number];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_FLOW_STEPS.length;
export const ONBOARDING_SURVEY_START_INDEX = ONBOARDING_FLOW_STEPS.indexOf("survey-1");

export const getOnboardingProgress = (step: OnboardingStep) => {
  const index = ONBOARDING_FLOW_STEPS.indexOf(step);
  if (index <= 0) return 0;
  return index / (ONBOARDING_TOTAL_STEPS - 1);
};
