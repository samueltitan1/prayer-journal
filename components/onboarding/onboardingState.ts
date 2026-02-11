export type SurveyAnswerValue = string | string[];

export type SurveyAnswer = {
  value: SurveyAnswerValue;
  otherText?: string;
};

const surveyAnswers: Record<number, SurveyAnswer> = {};

export function setSurveyAnswer(questionId: number, answer: SurveyAnswer) {
  surveyAnswers[questionId] = answer;
}

export function getSurveyAnswer(questionId: number): SurveyAnswer | undefined {
  return surveyAnswers[questionId];
}

export function resetSurveyAnswers() {
  for (const key of Object.keys(surveyAnswers)) {
    delete surveyAnswers[Number(key)];
  }
}

export function getAffirmationKeyFromQ2(): "A" | "B" | "C" | "generic" {
  const answer = surveyAnswers[2];
  const value = typeof answer?.value === "string" ? answer.value : "";
  if (value === "forget") return "A";
  if (value === "lose-track") return "B";
  if (value === "not-good-enough") return "C";
  return "generic";
}

let themePreference: "light" | "dark" | "system" | null = null;

export function setOnboardingThemePreference(pref: "light" | "dark" | "system") {
  themePreference = pref;
}

export function getOnboardingThemePreference() {
  return themePreference;
}
