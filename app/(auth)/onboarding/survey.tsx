import BarComparisonGraphRN from "@/components/onboarding/graphs/BarComparisonGraphRN";
import HabitTransitionGraphRN from "@/components/onboarding/graphs/HabitTransitionGraphRN";
import LongTermResultsGraphRN from "@/components/onboarding/graphs/LongTermResultsGraphRN";
import OnboardingHeader from "@/components/onboarding/OnboardingHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getSurveyAnswer, setSurveyAnswer } from "@/components/onboarding/onboardingState";
import PrimaryButton from "@/components/onboarding/PrimaryButton";
import { useAuth } from "@/contexts/AuthProvider";
import {
  trackOnboardingAction,
  trackOnboardingStart,
  trackOnboardingStepViewed,
  trackSurveyQuestionAnswered,
} from "@/lib/analytics/onboarding";
import { getOnboardingProgress, SURVEY_QUESTION_COUNT } from "@/lib/onboardingProgress";
import { upsertOnboardingResponses } from "@/lib/onboardingResponses";
import { colors, fonts, spacing } from "@/theme/theme";
import { FontAwesome, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type QuestionType = "single" | "multi" | "info";

type QuestionOption = {
  label: string;
  value: string;
  isOther?: boolean;
};

type SurveyQuestion =
  | {
      id: number;
      text: string;
      subtext?: string;
      type: "single" | "multi";
      options: QuestionOption[];
      storageKey: StorageKey;
    }
  | {
      id: number;
      text: string;
      subtext?: string;
      type: "info";
      infoKey: "sp1" | "sp2" | "sp3";
    };

type StorageKey = "q1" | "q2" | "q3" | "q4" | "q5" | "q7" | "q8";
type QuestionWithStorage = Extract<SurveyQuestion, { storageKey: StorageKey }>;

const QUESTION_KEY_MAP: Record<StorageKey, string> = {
  q1: "q1_prayer_life",
  q2: "q2_marketing_source",
  q3: "q3_app_experience",
  q4: "q4_journaling_challenge",
  q5: "q5_reflection_habits",
  q7: "q7_prayer_style",
  q8: "q8_journaling_goals",
};

const QUESTIONS: SurveyQuestion[] = [
  {
    id: 1,
    text: "How would you describe your current prayer life?",
    type: "single",
    storageKey: "q1",
    options: [
      { label: "Consistent and growing", value: "consistent-growing" },
      { label: "Irregular but I want to improve", value: "irregular-improve" },
      { label: "Just starting my faith journey", value: "starting-journey" },
      { label: "Struggling to maintain consistency", value: "struggling-consistency" },
    ],
  },
  {
    id: 2,
    text: "Where did you hear about us?",
    type: "single",
    storageKey: "q2",
    options: [
      { label: "Instagram", value: "instagram" },
      { label: "TikTok", value: "tiktok" },
      { label: "Facebook", value: "facebook" },
      { label: "YouTube", value: "youtube" },
      { label: "Reddit", value: "reddit" },
      { label: "Google", value: "google" },
      { label: "App Store", value: "app-store" },
      { label: "Friend or family", value: "friend-family" },
      { label: "Other", value: "other", isOther: true },
    ],
  },
  {
    id: 3,
    text: "Have you used a prayer or journaling app before?",
    type: "single",
    storageKey: "q3",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "first-time" },
    ],
  },
  {
    id: 103,
    type: "info",
    infoKey: "sp1",
    text: "Prayer Journal creates long-term consistency",
    subtext: "80% of Prayer Journal users pray and reflect more consistently even after 6 months.",
  },
  {
    id: 4,
    text: "How do you usually pray?",
    subtext: "(Select all that apply)",
    type: "multi",
    storageKey: "q7",
    options: [
      { label: "Short, spontaneous prayers throughout the day", value: "short-spontaneous" },
      { label: "Structured times (morning/evening)", value: "structured-times" },
      { label: "While walking or moving", value: "walking-moving" },
      { label: "Long, contemplative prayers", value: "long-contemplative" },
      { label: "Written prayers", value: "written-prayers" },
      { label: "I don't have a regular pattern yet", value: "no-pattern" },
    ],
  },
  {
    id: 5,
    text: "What's your biggest challenge when it comes to journaling your prayers?",
    type: "single",
    storageKey: "q4",
    options: [
      { label: "I don't have time to write everything out", value: "no-time" },
      { label: "I forget to journal after I pray", value: "forget-after" },
      { label: "I lose track of what I've prayed about", value: "lose-track" },
      { label: "I've never journaled prayers before", value: "never-journaled" },
      { label: "It feels awkward or forced when I write", value: "awkward-write" },
      { label: "Other", value: "other", isOther: true },
    ],
  },
  {
    id: 6,
    text: "How do you currently reflect on your prayers?",
    type: "single",
    storageKey: "q5",
    options: [
      { label: "I try to remember them mentally", value: "mental" },
      { label: "I write them down somewhere", value: "write-down" },
      { label: "I don't usually reflect back on prayers", value: "dont-reflect" },
      { label: "I wish I had a better way to do this", value: "wish-better" },
      { label: "Other", value: "other", isOther: true },
    ],
  },
  {
    id: 106,
    type: "info",
    infoKey: "sp2",
    text: "See how God is working in your life",
    subtext: "Prayer Journal turns scattered prayers into a personal timeline of God's faithfulness.",
  },
  {
    id: 7,
    text: "What do you hope to gain from journaling your prayers?",
    subtext: "(Select all that apply)",
    type: "multi",
    storageKey: "q8",
    options: [
      { label: "Remember what I've prayed about", value: "remember" },
      { label: "See how God answers over time", value: "answers-over-time" },
      { label: "Pray more consistently", value: "more-consistent" },
      { label: "Notice patterns in my spiritual life", value: "notice-patterns" },
      { label: "Feel closer to God", value: "closer-to-god" },
      { label: "Other", value: "other", isOther: true },
    ],
  },
  {
    id: 107,
    type: "info",
    infoKey: "sp3",
    text: "Your prayer life is about to change forever",
    subtext:
      "Habits begin to form in just 7 days. By day 30, prayer becomes part of who you are.",
  },
];

const TOTAL_QUESTIONS = QUESTIONS.length;


type OptionIcon = {
  type: "fontawesome" | "fontawesome5" | "ionicons";
  name: string;
};

const getOptionIcon = (questionId: number, value: string): OptionIcon | null => {
  if (questionId === 3) {
    if (value === "yes") return { type: "fontawesome", name: "thumbs-up" };
    if (value === "first-time") return { type: "fontawesome", name: "thumbs-down" };
    return null;
  }
  if (questionId !== 2) return null;
  switch (value) {
    case "instagram":
      return { type: "fontawesome", name: "instagram" };
    case "tiktok":
      return { type: "fontawesome5", name: "tiktok" };
    case "facebook":
      return { type: "fontawesome", name: "facebook" };
    case "youtube":
      return { type: "fontawesome", name: "youtube-play" };
    case "reddit":
      return { type: "fontawesome", name: "reddit" };
    case "google":
      return { type: "fontawesome", name: "google" };
    case "app-store":
      return { type: "fontawesome5", name: "app-store" };
    case "friend-family":
      return { type: "ionicons", name: "people" };
    case "other":
      return { type: "ionicons", name: "ellipsis-horizontal" };
    default:
      return null;
  }
};

export default function OnboardingSurvey() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1..7 = questions
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const startedRef = useRef(false);

  const question = useMemo(
    () => (step >= 1 ? QUESTIONS[step - 1] : null),
    [step]
  );

  const surveyIndex = useMemo(() => {
    if (!question) return 1;
    const completed = QUESTIONS.slice(0, step).filter((q) => q.type !== "info").length;
    return Math.min(Math.max(completed, 1), SURVEY_QUESTION_COUNT);
  }, [question, step]);

  const currentStepName = useMemo(() => {
    if (!question) return "survey";
    if (question.type === "info") return `survey-${question.infoKey}`;
    return `survey-${surveyIndex}`;
  }, [question, surveyIndex]);

  useEffect(() => {
    if (!startedRef.current) {
      trackOnboardingStart();
      startedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!question) return;
    trackOnboardingStepViewed(currentStepName);
    void upsertOnboardingResponses(user?.id, {
      onboarding_step: currentStepName,
      onboarding_last_seen_at: new Date().toISOString(),
    });
  }, [currentStepName, question, user?.id]);

  useEffect(() => {
    if (!stepParam) return;
    const parsed = Number(stepParam);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= SURVEY_QUESTION_COUNT) {
      let count = 0;
      for (let i = 0; i < QUESTIONS.length; i += 1) {
        if (QUESTIONS[i].type !== "info") count += 1;
        if (count === parsed) {
          setStep(i + 1);
          break;
        }
      }
    }
  }, [stepParam]);

  useEffect(() => {
    if (!question) return;
    const saved = getSurveyAnswer(question.id);
    if (question.type === "single") {
      setSelectedSingle(typeof saved?.value === "string" ? saved.value : null);
      setSelectedMulti([]);
    } else {
      setSelectedMulti(Array.isArray(saved?.value) ? saved?.value : []);
      setSelectedSingle(null);
    }
  }, [question]);

  const isValid = useMemo(() => {
    if (!question) return false;
    if (question.type === "info") return true;
    if (question.type === "single") {
      return !!selectedSingle;
    }
    return selectedMulti.length > 0;
  }, [question, selectedSingle, selectedMulti]);

  const handleSelect = (value: string) => {
    if (!question) return;
    if (question.type === "info") return;
    if (question.type === "single") {
      setSelectedSingle(value);
      if ("storageKey" in question) {
        trackSurveyQuestionAnswered(
          surveyIndex,
          QUESTION_KEY_MAP[question.storageKey],
          1
        );
      }
      return;
    }

    setSelectedMulti((prev) => {
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      if ("storageKey" in question) {
        trackSurveyQuestionAnswered(
          surveyIndex,
          QUESTION_KEY_MAP[question.storageKey],
          next.length
        );
      }
      return next;
    });
  };

  const persistAnswer = async (currentQuestion: QuestionWithStorage, value: string | string[]) => {
    if (!user?.id) {
      console.warn("Missing userId for onboarding survey save");
      return;
    }

    const payload: Record<string, string | string[]> = {};
    const storageKey = currentQuestion.storageKey;
    if (Array.isArray(value)) {
      if (storageKey === "q7" || storageKey === "q8") {
        if (value.every((v) => typeof v === "string")) {
          payload[storageKey] = value;
        } else {
          console.warn(`Invalid ${storageKey} value; expected string[]`);
        }
      } else {
        console.warn(`Unexpected array value for ${storageKey}`);
      }
    } else {
      payload[storageKey] = value;
    }

    if (Object.keys(payload).length > 0) {
      await upsertOnboardingResponses(user.id, payload);
    }
  };

  const handleNext = async () => {
    if (!question) return;
    trackOnboardingAction(currentStepName, "continue");
    if (question.type === "info") {
      if (step >= TOTAL_QUESTIONS) {
        router.replace("/(auth)/onboarding/privacy");
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    const value = question.type === "single" ? (selectedSingle ?? "") : selectedMulti;
    const questionWithStorage = question as QuestionWithStorage;
    setSurveyAnswer(question.id, {
      value,
    });
    await persistAnswer(questionWithStorage, value);

    if (step >= TOTAL_QUESTIONS) {
      router.replace("/(auth)/onboarding/privacy");
      return;
    }

    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      trackOnboardingAction(currentStepName, "back");
      setStep((s) => s - 1);
      return;
    }
    trackOnboardingAction(currentStepName, "back");
    router.replace("/(auth)/onboarding/welcome");
  };

  if (!question) return null;

  return (
    <OnboardingShell showBack={false}>
      <View style={styles.container}>
        <OnboardingHeader
          progress={getOnboardingProgress(`survey-${surveyIndex}` as any)}
          onBack={handleBack}
        />

        {question.type !== "info" ? (
          <View style={styles.questionWrap}>
            <Text style={styles.questionText}>{question.text}</Text>
            {question.subtext ? (
              <Text style={styles.questionSubtext}>{question.subtext}</Text>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            question.type === "info" ? styles.scrollContentCentered : null,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {question.type === "info" ? (
            <View style={styles.infoWrap}>
              <Text style={styles.infoTitle}>{question.text}</Text>
              {question.infoKey === "sp1" ? (
                <>
                  <LongTermResultsGraphRN
                    title="Your prayer life"
                    description="80% of Prayer Journal users are still praying consistently after 6 months"
                  />
                </>
              ) : null}
              {question.infoKey === "sp2" ? (
                <>
                  <BarComparisonGraphRN
                    title="Answered prayers you notice"
                    description="Prayer Journal turns scattered prayers into a personal timeline of God's faithfulness"
                  />
                </>
              ) : null}
              {question.infoKey === "sp3" ? (
                <>
                  <HabitTransitionGraphRN
                    title="Your first 30 days"
                    description="Habits begin to form in just 7 days. By day 30, prayer becomes part of who you are"
                  />
                </>
              ) : null}
              {!question.infoKey ? (
                question.subtext ? <Text style={styles.infoBody}>{question.subtext}</Text> : null
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.optionsWrap}>
                {question.options.map((option) => {
                  const selected = question.type === "single"
                    ? selectedSingle === option.value
                    : selectedMulti.includes(option.value);
                  const icon = getOptionIcon(question.id, option.value);
                  const iconColor = selected ? colors.accentGold : colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                      activeOpacity={0.85}
                      onPress={() => handleSelect(option.value)}
                    >
                      <View style={styles.optionRow}>
                        {icon ? (
                          <View style={styles.optionIcon}>
                            {icon.type === "fontawesome" ? (
                              <FontAwesome name={icon.name as any} size={18} color={iconColor} />
                            ) : icon.type === "fontawesome5" ? (
                              <FontAwesome5 name={icon.name as any} size={18} color={iconColor} />
                            ) : (
                              <Ionicons name={icon.name as any} size={18} color={iconColor} />
                            )}
                          </View>
                        ) : null}
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Continue" onPress={handleNext} disabled={!isValid} />
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl + 64,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: "center",
  },
  questionWrap: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  questionText: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: "center",
  },
  questionSubtext: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  optionsWrap: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  optionCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    backgroundColor: "#FFFFFF",
  },
  optionCardSelected: {
    borderColor: colors.accentGold,
    backgroundColor: "rgba(227, 198, 123, 0.12)",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: {
    width: 26,
    alignItems: "center",
    marginRight: spacing.md,
  },
  optionLabel: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    color: colors.textPrimary,
  },
  infoWrap: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",

  },
  infoTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 23,
    color: colors.textPrimary,
    textAlign: "center",
    paddingHorizontal: spacing.sm * 6,
    marginBottom: spacing.xl * 3,
    marginHorizontal: spacing.sm,
  },
  infoBody: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.backgroundLight,
  },
});
