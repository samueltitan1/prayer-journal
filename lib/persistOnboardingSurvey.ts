import { getSurveyAnswer } from "@/components/onboarding/onboardingState";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";

const QUESTION_TO_COLUMN: Record<number, string> = {
  1: "q1",
  2: "q2",
  3: "q3",
  4: "q7",
  5: "q4",
  6: "q5",
  7: "q8",
};

export async function persistOnboardingSurveyAnswers(userId: string | null | undefined) {
  if (!userId) {
    console.warn("Missing userId for onboarding survey persistence");
    return;
  }

  const payload: Record<string, string | string[]> = {};

  for (const [key, column] of Object.entries(QUESTION_TO_COLUMN)) {
    const questionId = Number(key);
    const answer = getSurveyAnswer(questionId);
    if (!answer) continue;

    const value = answer.value;
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v === "string")) {
        payload[column] = value;
      } else {
        console.warn(`Invalid survey value for ${column}; expected string[]`);
      }
    } else if (typeof value === "string") {
      payload[column] = value;
    }
  }

  if (Object.keys(payload).length === 0) return;
  payload.onboarding_started_at = new Date().toISOString();
  await upsertOnboardingResponses(userId, payload);
}
