/**
 * Normalizes auth.users.raw_user_meta_data.full_name for paywall emails.
 * Use when rendering templates and when writing paywall_email_queue.first_name.
 */
export function normalizePaywallFirstName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "Friend";

  const looksGenerated =
    /\d/.test(trimmed) ||
    trimmed.includes("@") ||
    (trimmed.length > 30 && !trimmed.includes(" "));

  if (looksGenerated) return "Friend";

  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord || "Friend";
}
