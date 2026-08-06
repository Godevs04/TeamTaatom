"use client";

import * as React from "react";
import { searchUsersForMention, type MentionUser } from "../lib/api";
import {
  applyMentionSelection,
  findMentionTrigger,
  MENTION_MIN_QUERY_LENGTH,
  type MentionTrigger,
} from "../lib/mention-autocomplete";

const DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 10;

export type MentionField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Drives @mention autocomplete for a single text field.
 *
 * The caller owns the input element and its value; this hook only watches the
 * text/cursor it is handed and returns the suggestions plus the replacement text
 * to apply on selection. That keeps it usable from both <input> and <textarea>
 * composers with different layouts.
 */
export function useMentionAutocomplete<T extends MentionField>(enabled = true) {
  const [trigger, setTrigger] = React.useState<MentionTrigger | null>(null);
  const [suggestions, setSuggestions] = React.useState<MentionUser[]>([]);
  /** Attach to the field being completed; the hook reads and re-focuses it. */
  const fieldRef = React.useRef<T>(null);
  // Latest text/cursor seen, so select() can rebuild the string without the
  // caller having to pass it back in.
  const fieldStateRef = React.useRef({ text: "", cursor: 0 });
  // Guards against a slow response for an old query clobbering a newer one.
  const requestIdRef = React.useRef(0);
  // Caret position to restore once React has re-rendered with the new value.
  const pendingCaretRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  });

  /** Re-evaluate after anything that can move the cursor: input, click, arrow keys. */
  const sync = React.useCallback(
    (el: MentionField | null) => {
      if (!el || !enabled) {
        setTrigger(null);
        return;
      }
      const text = el.value;
      const cursor = el.selectionStart ?? text.length;
      fieldStateRef.current = { text, cursor };
      setTrigger(findMentionTrigger(text, cursor));
    },
    [enabled]
  );

  const dismiss = React.useCallback(() => {
    requestIdRef.current += 1;
    setTrigger(null);
    setSuggestions([]);
  }, []);

  const query = trigger ? trigger.query : null;

  React.useEffect(() => {
    if (query === null || query.length < MENTION_MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      searchUsersForMention(query, SUGGESTION_LIMIT)
        .then((users) => {
          if (requestId === requestIdRef.current) setSuggestions(users);
        })
        .catch(() => {
          // Autocomplete is an assist, not a task the user asked for: fail quiet.
          if (requestId === requestIdRef.current) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * New field text for the picked user, or null if the mention is no longer
   * active. The caller just stores the returned string; the caret is restored
   * here once the re-render lands.
   */
  const select = React.useCallback(
    (user: MentionUser): string | null => {
      if (!trigger) return null;
      const { text, cursor } = fieldStateRef.current;
      const next = applyMentionSelection(text, cursor, trigger.atIndex, user.username);
      requestIdRef.current += 1;
      pendingCaretRef.current = next.cursor;
      fieldStateRef.current = { text: next.text, cursor: next.cursor };
      setTrigger(null);
      setSuggestions([]);
      return next.text;
    },
    [trigger]
  );

  return { fieldRef, suggestions, sync, dismiss, select };
}
