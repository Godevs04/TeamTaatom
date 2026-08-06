/**
 * Trigger detection and text insertion for @mention autocomplete.
 *
 * Pure string/index logic, kept out of the hook so it can be reasoned about (and
 * corrected) in one place rather than re-derived at each composer.
 */

/**
 * Shortest query the backend can answer. Its isValidUsername() check requires
 * 3-20 characters, so 1- and 2-character queries always come back empty —
 * there is no point spending a request on them.
 */
export const MENTION_MIN_QUERY_LENGTH = 3;

/** Characters allowed inside a mention, matching TOKEN_RE in caption-parts.ts. */
const MENTION_FRAGMENT_RE = /^[\w.]*$/;

export type MentionTrigger = {
  /** Text typed after the '@', which is what gets searched. */
  query: string;
  /** Index of the triggering '@' within the full text. */
  atIndex: number;
};

/**
 * Finds the mention being typed at the cursor, or null if there isn't one.
 *
 * Only the *last* '@' before the cursor counts, and only while every character
 * between it and the cursor is mention-legal — so whitespace closes a mention
 * even when an earlier unclosed '@' exists further back:
 *
 *   "hey @jo"       cursor 7  -> { query: "jo", atIndex: 4 }
 *   "hey @jo there" cursor 13 -> null   (space closed it)
 *   "a@b @jo"       cursor 7  -> { query: "jo", atIndex: 4 }   (last '@', not the first)
 *
 * No word-boundary check before the '@': the backend's extractMentions regex
 * doesn't require one either, so "a@bobby" is a mention to the server and
 * suppressing the suggestion here would desync the two.
 */
export function findMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;
  const fragment = before.slice(atIndex + 1);
  if (!MENTION_FRAGMENT_RE.test(fragment)) return null;
  return { query: fragment, atIndex };
}

/**
 * Replaces the in-progress mention with the chosen username plus a trailing
 * space, keeping the '@' itself, and reports where the cursor should land.
 *
 *   applyMentionSelection("hey @jo", 7, 4, "jonas")
 *     -> { text: "hey @jonas ", cursor: 11 }
 */
export function applyMentionSelection(
  text: string,
  cursor: number,
  atIndex: number,
  username: string
): { text: string; cursor: number } {
  const inserted = `${username} `;
  return {
    text: text.slice(0, atIndex + 1) + inserted + text.slice(cursor),
    cursor: atIndex + 1 + inserted.length,
  };
}

/**
 * Moves a highlighted-suggestion index by one step, wrapping around at both
 * ends: pressing down from the last item goes to the first, pressing up from
 * the first goes to the last.
 *
 * Returns -1 for an empty list (nothing to highlight). `current` outside
 * [0, length) — including -1, "nothing highlighted yet" — is normalized into
 * range before stepping, so this is safe to call from any state.
 *
 *   moveHighlight(2, 3, 1)  -> 0   (last -> first)
 *   moveHighlight(0, 3, -1) -> 2   (first -> last)
 */
export function moveHighlight(current: number, length: number, delta: 1 | -1): number {
  if (length <= 0) return -1;
  return (((current + delta) % length) + length) % length;
}
