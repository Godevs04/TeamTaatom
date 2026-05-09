"use client";

import * as React from "react";
import { Loader2, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTaatomSongs, type TaatomSong } from "@/lib/api";

export function SongPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (song: TaatomSong) => void;
}) {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [songs, setSongs] = React.useState<TaatomSong[]>([]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void getTaatomSongs({ search: debounced || undefined, limit: 40 })
      .then((list) => {
        if (!cancelled) setSongs(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Music className="h-5 w-5 text-primary" />
            Taatom music
          </div>
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-100 p-3 dark:border-zinc-800">
          <Input placeholder="Search title or artist…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!loading && songs.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No songs found.</p>
          )}
          <ul className="space-y-1">
            {songs.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-800/90"
                  onClick={() => {
                    onSelect(s);
                    onClose();
                  }}
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                    {s.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-primary">
                        <Music className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{s.title}</p>
                    <p className="truncate text-xs text-slate-500">{s.artist}</p>
                  </div>
                  {typeof s.duration === "number" && (
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">{Math.floor(s.duration)}s</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-slate-100 p-3 dark:border-zinc-800">
          <Button variant="outline" className="w-full" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
