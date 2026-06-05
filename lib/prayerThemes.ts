export const ALLOWED_PRAYER_THEMES = [
 "anxiety",
  "peace",
  "gratitude",
  "work",
  "family",
  "health",
  "growth",
  "grief",
  "hope",
  "loneliness",
  "shame",
  "overwhelmed",
  "guilt",
  "fear",
  "anger",
  "jealousy",
  "envy",
  "pride",
  "temptation",
  "relationships",
  "joy",
  "comfort",
  "strength",
  "courage",
  "faith",
  "finances",
  "career",
  "education",
  "marriage",
  "parenting",
  "friends",
  "community",
  "travel",
  "leisure",
  "creativity",
  "loss",
  "purpose",
  "love",
  "thankfulness",
  "contentment",
  "healing",
  "salvation",
  "forgiveness",
  "guidance",
  "provision",
  "children",
  "surrender",
  "doubt",
  "worship",
  "trust",
  "friendship",
] as const;

type ThemeExtractionParams = {
  supabase: any;
  prayerId: string;
  userId: string;
  prayerText: string | null;
  maxRetries?: number;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function enqueuePrayerThemeExtraction(params: ThemeExtractionParams): Promise<boolean> {
  const text = (params.prayerText ?? "").trim();
  if (!text) return false;

  const maxRetries = Math.max(0, params.maxRetries ?? 2);
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const { error } = await params.supabase.functions.invoke("extract_prayer_themes", {
        body: {
          prayer_id: params.prayerId,
          user_id: params.userId,
          prayer_text: text,
        },
      });
      if (!error) return true;
      if (attempt === maxRetries) {
        console.warn("Theme extraction failed after retries", {
          prayerId: params.prayerId,
          attempts: attempt + 1,
          error: error.message,
        });
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.warn("Theme extraction threw after retries", {
          prayerId: params.prayerId,
          attempts: attempt + 1,
          error: String(error),
        });
      }
    }

    if (attempt < maxRetries) {
      await wait((attempt + 1) * 700);
    }
  }

  return false;
}
