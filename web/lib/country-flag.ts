import { ONBOARDING_COUNTRY_SHORTCUTS } from "./onboarding-options";

/** Regional-indicator flag emoji for an ISO 3166-1 alpha-2 code ("in" → 🇮🇳). */
export function flagEmojiFromCode(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...Array.from(cc).map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/**
 * Flag for a stored nationality. Onboarding saves the country label ("India"),
 * so resolve it through the same shortcut list; a raw 2-letter code also works.
 */
export function nationalityFlag(nationality?: string | null): string {
  const value = (nationality || "").trim();
  if (!value) return "";
  if (/^[a-z]{2}$/i.test(value)) return flagEmojiFromCode(value);
  const match = ONBOARDING_COUNTRY_SHORTCUTS.find((c) => c.label.toLowerCase() === value.toLowerCase());
  return match ? flagEmojiFromCode(match.id) : "";
}
