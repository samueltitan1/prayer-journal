// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import {
  getSafeThemeOrNull,
  getUnclassifiedThemes,
  isSafeTheme,
  normalizeThemeList,
} from "../_shared/notificationThemeConfig.ts";

type UserSettingRow = {
  user_id: string;
  timezone: string | null;
  last_active_at: string | null;
  last_reflection_sent_at: string | null;
  reflection_sent_count_week: number | null;
  reflection_sent_week_key: string | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
  timezone: string | null;
  disabled_at: string | null;
  last_seen_at: string | null;
};

type PrayerRow = {
  id: string;
  prayed_at: string;
  themes: string[] | null;
  transcript_text: string | null;
};

type TriggerPayload = {
  type: "inactivity" | "anniversary" | "pattern" | "milestone";
  title: string;
  body: string;
};

const MILESTONES = new Set([5, 10, 25]);
const MAX_WEEKLY_NOTIFICATIONS = 2;
const RESTRICTED_FALLBACK_COPY = [
  "You've been bringing something heavy to God lately. He hears you.",
  "You've been showing up consistently. Keep going.",
  "Your prayers this week show a heart that's seeking. That matters.",
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getPartsInTimezone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function dateKeyForTimezone(date: Date, timeZone: string) {
  const parts = getPartsInTimezone(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function toUtcMidnightFromTimezone(date: Date, timeZone: string) {
  const parts = getPartsInTimezone(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
}

function dayDiffInTimezone(a: Date, b: Date, timeZone: string) {
  const diff = toUtcMidnightFromTimezone(a, timeZone) - toUtcMidnightFromTimezone(b, timeZone);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function weekKeyInTimezone(date: Date, timeZone: string) {
  const parts = getPartsInTimezone(date, timeZone);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function titleCaseTheme(theme: string) {
  if (!theme) return "prayer";
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

function chooseRecentTheme(prayers: PrayerRow[]) {
  for (const prayer of prayers) {
    const safeTheme = getSafeThemeOrNull(prayer.themes);
    if (safeTheme) return safeTheme;
  }
  return null;
}

function pickAnniversaryPrayer(prayers: PrayerRow[], now: Date, timeZone: string) {
  const nowParts = getPartsInTimezone(now, timeZone);
  const previousMonth = nowParts.month === 1 ? 12 : nowParts.month - 1;
  const previousMonthYear = nowParts.month === 1 ? nowParts.year - 1 : nowParts.year;

  for (const prayer of prayers) {
    const prayedAt = new Date(prayer.prayed_at);
    const parts = getPartsInTimezone(prayedAt, timeZone);
    const sameDay = parts.day === nowParts.day;
    const priorYearSameDate =
      sameDay && parts.month === nowParts.month && parts.year < nowParts.year;
    const priorMonthSameDate =
      sameDay && parts.month === previousMonth && parts.year === previousMonthYear;

    if (priorYearSameDate || priorMonthSameDate) {
      return prayer;
    }
  }
  return null;
}

function findPatternTheme(prayers: PrayerRow[], now: Date) {
  const cutoffMs = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const prayer of prayers) {
    const prayedAtMs = new Date(prayer.prayed_at).getTime();
    if (Number.isNaN(prayedAtMs) || prayedAtMs < cutoffMs) continue;

    const themes = normalizeThemeList(prayer.themes);
    for (const theme of themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }

  let maxCount = 0;
  for (const [theme, count] of counts.entries()) {
    if (count < 3) continue;
    if (count > maxCount) maxCount = count;
  }

  if (maxCount < 3) return null;

  const dominantThemes = Array.from(counts.entries())
    .filter(([, count]) => count === maxCount)
    .map(([theme]) => theme);
  const safeDominantTheme = dominantThemes.find((theme) => isSafeTheme(theme)) ?? null;

  if (safeDominantTheme) {
    return { theme: safeDominantTheme, count: maxCount, canSurface: true };
  }

  return {
    theme: dominantThemes[0] ?? null,
    count: maxCount,
    canSurface: false,
  };
}

function chooseFallbackCopy(seed: string) {
  if (!seed) return RESTRICTED_FALLBACK_COPY[0];
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) {
    total += seed.charCodeAt(i);
  }
  return RESTRICTED_FALLBACK_COPY[total % RESTRICTED_FALLBACK_COPY.length];
}

function pickOldestSafeTheme(prayers: PrayerRow[]) {
  for (const prayer of [...prayers].reverse()) {
    const safeTheme = getSafeThemeOrNull(prayer.themes);
    if (safeTheme) return safeTheme;
  }
  return null;
}

function logUnclassifiedThemes(userId: string, prayers: PrayerRow[]) {
  const unclassified = new Set<string>();
  for (const prayer of prayers) {
    const unknown = getUnclassifiedThemes(prayer.themes);
    for (const theme of unknown) {
      unclassified.add(theme);
    }
  }

  if (unclassified.size > 0) {
    console.warn("reflection_notification_unclassified_themes", {
      user_id: userId,
      themes: Array.from(unclassified),
      count: unclassified.size,
    });
  }
}

async function sendExpoPush(to: string, title: string, body: string, data: Record<string, unknown>) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to,
      title,
      body,
      sound: "default",
      data,
    }),
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  const result = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const status = result?.status;
  if (status !== "ok") {
    return { ok: false, error: result?.message ?? "push_failed", details: result?.details ?? null };
  }

  return { ok: true, error: null };
}

serve(async (req: Request): Promise<Response> => {
  try {
    const scheduled = req.headers.get("x-supabase-scheduled") === "true";
    if (!scheduled) {
      return json(401, { error: "Scheduled invocation required" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const now = new Date();

    const { data: settingsRows, error: settingsError } = await supabase
      .from("user_settings")
      .select(
        "user_id,timezone,last_active_at,last_reflection_sent_at,reflection_sent_count_week,reflection_sent_week_key"
      );
    if (settingsError) {
      return json(500, { error: `Failed to load user settings: ${settingsError.message}` });
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("user_id,expo_push_token,timezone,disabled_at,last_seen_at")
      .is("disabled_at", null)
      .order("last_seen_at", { ascending: false });
    if (tokenError) {
      return json(500, { error: `Failed to load push tokens: ${tokenError.message}` });
    }

    const latestTokenByUser = new Map<string, PushTokenRow>();
    for (const row of (tokenRows ?? []) as PushTokenRow[]) {
      if (!row.user_id || !row.expo_push_token) continue;
      if (!latestTokenByUser.has(row.user_id)) {
        latestTokenByUser.set(row.user_id, row);
      }
    }

    let evaluated = 0;
    let sent = 0;
    let skipped = 0;

    for (const settings of (settingsRows ?? []) as UserSettingRow[]) {
      const token = latestTokenByUser.get(settings.user_id);
      if (!token) {
        skipped += 1;
        continue;
      }

      evaluated += 1;
      const timeZone = settings.timezone || token.timezone || "UTC";
      const localNow = getPartsInTimezone(now, timeZone);
      if (localNow.hour < 9 || localNow.hour >= 20) {
        skipped += 1;
        continue;
      }

      if (settings.last_active_at) {
        const lastActive = new Date(settings.last_active_at);
        if (dateKeyForTimezone(lastActive, timeZone) === dateKeyForTimezone(now, timeZone)) {
          skipped += 1;
          continue;
        }
      }

      if (settings.last_reflection_sent_at) {
        const lastSent = new Date(settings.last_reflection_sent_at);
        if (dayDiffInTimezone(now, lastSent, timeZone) < 5) {
          skipped += 1;
          continue;
        }
      }

      const currentWeekKey = weekKeyInTimezone(now, timeZone);
      const weekCount =
        settings.reflection_sent_week_key === currentWeekKey
          ? settings.reflection_sent_count_week ?? 0
          : 0;
      if (weekCount >= MAX_WEEKLY_NOTIFICATIONS || weekCount >= 3) {
        skipped += 1;
        continue;
      }

      const { data: prayers, count, error: prayersError } = await supabase
        .from("prayers")
        .select("id,prayed_at,themes,transcript_text", { count: "exact" })
        .eq("user_id", settings.user_id)
        .is("deleted_at", null)
        .order("prayed_at", { ascending: false })
        .limit(400);

      if (prayersError || !prayers) {
        skipped += 1;
        continue;
      }

      const totalPrayers = count ?? prayers.length;
      if (totalPrayers < 3) {
        skipped += 1;
        continue;
      }

      const hasTaggedThemes = prayers.some((prayer) => normalizeThemeList(prayer.themes).length > 0);
      if (!hasTaggedThemes) {
        skipped += 1;
        continue;
      }

      logUnclassifiedThemes(settings.user_id, prayers as PrayerRow[]);

      const recentTheme = chooseRecentTheme(prayers as PrayerRow[]);
      const inactivityDays = settings.last_active_at
        ? dayDiffInTimezone(now, new Date(settings.last_active_at), timeZone)
        : null;

      let trigger: TriggerPayload | null = null;

      if (typeof inactivityDays === "number" && inactivityDays >= 5 && inactivityDays <= 7) {
        trigger = {
          type: "inactivity",
          title: "A gentle reminder",
          body: recentTheme
            ? `It's been a few days. Last week you were praying about ${recentTheme}. We're here whenever you're ready.`
            : chooseFallbackCopy(`${settings.user_id}:inactivity`),
        };
      }

      if (!trigger) {
        const anniversaryPrayer = pickAnniversaryPrayer(prayers as PrayerRow[], now, timeZone);
        if (anniversaryPrayer) {
          const anniversaryTheme = getSafeThemeOrNull(anniversaryPrayer.themes);
          trigger = {
            type: "anniversary",
            title: "A meaningful memory",
            body: anniversaryTheme
              ? `On this day before, you were praying for ${anniversaryTheme}. Take a moment to reflect on how far you've come.`
              : chooseFallbackCopy(`${settings.user_id}:anniversary`),
          };
        }
      }

      if (!trigger) {
        const pattern = findPatternTheme(prayers as PrayerRow[], now);
        if (pattern) {
          if (pattern.canSurface && pattern.theme) {
            trigger = {
              type: "pattern",
              title: "A prayer pattern",
              body: `You've brought ${pattern.theme} to prayer ${pattern.count} times recently. God meets you in every honest moment.`,
            };
          }
        }
      }

      if (!trigger && MILESTONES.has(totalPrayers)) {
        const firstSafeTheme = pickOldestSafeTheme(prayers as PrayerRow[]);
        trigger = {
          type: "milestone",
          title: "A faithful milestone",
          body: firstSafeTheme
            ? `You've now logged ${totalPrayers} prayers. Your journey began with ${titleCaseTheme(firstSafeTheme).toLowerCase()}.`
            : chooseFallbackCopy(`${settings.user_id}:milestone`),
        };
      }

      if (!trigger) {
        skipped += 1;
        continue;
      }

      const push = await sendExpoPush(token.expo_push_token, trigger.title, trigger.body, {
        kind: "reflection_prompt",
        trigger: trigger.type,
      });

      if (!push.ok) {
        if (String(push.error).toLowerCase().includes("device") || String(push.error).toLowerCase().includes("notregistered")) {
          await supabase
            .from("user_push_tokens")
            .update({ disabled_at: now.toISOString() })
            .eq("expo_push_token", token.expo_push_token);
        }
        skipped += 1;
        continue;
      }

      await supabase.from("user_settings").upsert(
        {
          user_id: settings.user_id,
          last_reflection_sent_at: now.toISOString(),
          reflection_sent_week_key: currentWeekKey,
          reflection_sent_count_week: weekCount + 1,
          timezone: timeZone,
        },
        { onConflict: "user_id" }
      );

      sent += 1;
    }

    return json(200, {
      ok: true,
      evaluated,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("send_reflection_notifications failed", error);
    return json(500, { error: String(error) });
  }
});
