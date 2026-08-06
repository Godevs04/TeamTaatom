"use client";

import * as React from "react";
import type { MentionUser } from "../lib/api";
import { cn } from "../lib/utils";

/**
 * Dropdown of @mention candidates, positioned by the caller.
 *
 * Renders nothing when there are no suggestions — an empty list is the normal
 * response for a short query or an unverified match, not an error worth showing.
 * Wrap the field in a `relative` container; this positions itself under it.
 */
export function MentionSuggestions({
  users,
  onSelect,
  className,
}: {
  users: MentionUser[];
  onSelect: (user: MentionUser) => void;
  className?: string;
}) {
  if (users.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Mention suggestions"
      // Keep focus in the field so the caret survives the click.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
        className
      )}
    >
      {users.map((u) => (
        <li key={u._id} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onSelect(u)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              {u.profilePic ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={u.profilePic}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400 dark:text-zinc-500">
                  {(u.fullName || u.username || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900 dark:text-zinc-50">
                {u.fullName || u.username}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">
                @{u.username}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
