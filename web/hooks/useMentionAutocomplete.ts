"use client";

import * as React from "react";
import { searchUsersForMention, type MentionUser } from "../lib/api";
import {
  applyMentionSelection,
  findMentionTrigger,
  MENTION_MIN_QUERY_LENGTH,
  moveHighlight,
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
  /** -1 means nothing highlighted. Kept in lockstep with `suggestions`: reset to
   * 0 whenever a non-empty list lands, -1 whenever it's cleared. */
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  /** Unique per hook instance, so aria-activedescendant can't collide if more than
   * one composer with mentions is mounted at once. */
  const listboxId = React.useId();
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
    setHighlightedIndex(-1);
  }, []);

  const query = trigger ? trigger.query : null;

  React.useEffect(() => {
    if (query === null || query.length < MENTION_MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      searchUsersForMention(query, SUGGESTION_LIMIT)
        .then((users) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(users);
          setHighlightedIndex(users.length > 0 ? 0 : -1);
        })
        .catch(() => {
          // Autocomplete is an assist, not a task the user asked for: fail quiet.
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setHighlightedIndex(-1);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  /** Moves the highlight with wraparound; a no-op while the list is empty. */
  const moveHighlightBy = React.useCallback(
    (delta: 1 | -1) => {
      setHighlightedIndex((current) => moveHighlight(current, suggestions.length, delta));
    },
    [suggestions.length]
  );

  /** Sets the highlight to a specific index, e.g. on mouse hover over a row. */
  const highlight = React.useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

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
      setHighlightedIndex(-1);
      return next.text;
    },
    [trigger]
  );

  /** Selects whichever suggestion is currently highlighted, e.g. for Enter. */
  const selectHighlighted = React.useCallback((): string | null => {
    if (highlightedIndex < 0) return null;
    const user = suggestions[highlightedIndex];
    return user ? select(user) : null;
  }, [highlightedIndex, suggestions, select]);

  return {
    fieldRef,
    listboxId,
    suggestions,
    highlightedIndex,
    sync,
    dismiss,
    select,
    selectHighlighted,
    moveHighlight: moveHighlightBy,
    highlight,
  };
}
