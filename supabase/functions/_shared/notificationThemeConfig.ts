export const NOTIFICATION_SAFE_THEMES = [
  "peace", "gratitude", "work", "family", "health", "growth", "hope",
  "joy", "comfort", "strength", "courage", "faith", "finances", "career",
  "education", "marriage", "parenting", "friends", "community", "travel",
  "leisure", "creativity", "purpose", "love", "thankfulness", "contentment",
  "healing", "salvation", "forgiveness", "guidance", "provision", "children",
  "worship", "trust", "friendship", "relationships", "loss",
] as const;

export const NOTIFICATION_RESTRICTED_THEMES = [
  "anxiety", "grief", "loneliness", "shame", "overwhelmed", "guilt",
  "fear", "anger", "jealousy", "envy", "pride", "temptation",
  "doubt", "surrender",
] as const;

const SAFE_SET = new Set<string>(NOTIFICATION_SAFE_THEMES);
const RESTRICTED_SET = new Set<string>(NOTIFICATION_RESTRICTED_THEMES);

for (const theme of SAFE_SET) {
  if (RESTRICTED_SET.has(theme)) {
    throw new Error(`Theme "${theme}" cannot be both safe and restricted.`);
  }
}

export type NotificationThemeClass = "safe" | "restricted" | "unclassified";

export function normalizeTheme(theme: unknown): string | null {
  if (typeof theme !== "string") return null;
  const normalized = theme.trim().toLowerCase();
  return normalized || null;
}

export function isSafeTheme(theme: string): boolean {
  return SAFE_SET.has(theme);
}

export function isRestrictedTheme(theme: string): boolean {
  return RESTRICTED_SET.has(theme);
}

export function isClassifiedTheme(theme: string): boolean {
  return isSafeTheme(theme) || isRestrictedTheme(theme);
}

export function classifyTheme(theme: string): NotificationThemeClass {
  if (isSafeTheme(theme)) return "safe";
  if (isRestrictedTheme(theme)) return "restricted";
  return "unclassified";
}

export function normalizeThemeList(themes: unknown): string[] {
  if (!Array.isArray(themes)) return [];
  const normalized = themes
    .map(normalizeTheme)
    .filter((theme): theme is string => Boolean(theme));
  return Array.from(new Set(normalized));
}

export function getSafeThemeOrNull(themes: unknown): string | null {
  for (const theme of normalizeThemeList(themes)) {
    if (isSafeTheme(theme)) return theme;
  }
  return null;
}

export function getUnclassifiedThemes(themes: unknown): string[] {
  return normalizeThemeList(themes).filter((theme) => !isClassifiedTheme(theme));
}

export function hasOnlyRestrictedThemes(themes: unknown): boolean {
  const normalized = normalizeThemeList(themes);
  if (normalized.length === 0) return false;
  return normalized.every((theme) => isRestrictedTheme(theme));
}

export function hasNoSafeThemes(themes: unknown): boolean {
  return !normalizeThemeList(themes).some((theme) => isSafeTheme(theme));
}
