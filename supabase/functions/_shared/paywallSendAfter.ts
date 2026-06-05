const DEFAULT_TIMEZONE = "UTC";

function getZonedHour(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  return Number(formatter.format(date));
}

function getZonedYmd(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
  };
}

function isQuietHour(hour: number): boolean {
  return hour >= 21 || hour < 7;
}

/** Shift to 08:00 on the next calendar day in `timeZone` (UTC instant). */
function nextDayAtEightAm(from: Date, timeZone: string): Date {
  const { year, month, day } = getZonedYmd(from, timeZone);
  const probe = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const { year: y2, month: m2, day: d2 } = getZonedYmd(probe, timeZone);
  const targetLocal = `${y2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}T08:00:00`;
  const utcGuess = new Date(`${targetLocal}Z`);
  const hourGuess = getZonedHour(utcGuess, timeZone);
  return new Date(utcGuess.getTime() + (8 - hourGuess) * 60 * 60 * 1000);
}

/** Same calendar day 08:00 in `timeZone` if still in the future; otherwise next day 08:00. */
function sameOrNextMorningEight(from: Date, timeZone: string): Date {
  const { year, month, day } = getZonedYmd(from, timeZone);
  const targetLocal = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T08:00:00`;
  const utcGuess = new Date(`${targetLocal}Z`);
  const hourGuess = getZonedHour(utcGuess, timeZone);
  const sameDayEight = new Date(utcGuess.getTime() + (8 - hourGuess) * 60 * 60 * 1000);
  if (sameDayEight.getTime() > from.getTime()) {
    return sameDayEight;
  }
  return nextDayAtEightAm(from, timeZone);
}

/**
 * Base send time is now + 30 minutes. If that falls in quiet hours (21:00–07:00),
 * schedule for 08:00 the next morning in the user's timezone.
 */
export function computePaywallSendAfter(
  now = new Date(),
  timeZone: string | null | undefined = DEFAULT_TIMEZONE
): Date {
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  const base = new Date(now.getTime() + 30 * 60 * 1000);
  const hour = getZonedHour(base, tz);
  if (!isQuietHour(hour)) {
    return base;
  }
  if (hour < 7) {
    return sameOrNextMorningEight(base, tz);
  }
  return nextDayAtEightAm(base, tz);
}
