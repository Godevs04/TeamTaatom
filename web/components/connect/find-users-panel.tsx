"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  connectFindUsers,
  connectGetCountries,
  connectGetLanguages,
  type FoundUser,
} from "@/lib/connect-api";
import { authMe, followProfile } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TRAVEL_STYLES = [
  { code: "solo", name: "Solo Traveler" },
  { code: "couple", name: "Couple" },
  { code: "group", name: "Group" },
  { code: "backpacker", name: "Backpacker" },
  { code: "luxury", name: "Luxury" },
];

export function FindUsersPanel() {
  const [targetCountry, setTargetCountry] = React.useState("");
  const [currentCountry, setCurrentCountry] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [travelStyle, setTravelStyle] = React.useState("");
  const [users, setUsers] = React.useState<FoundUser[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [followBusy, setFollowBusy] = React.useState<string | null>(null);

  const geoQ = useQuery({
    queryKey: ["connect-geo"],
    queryFn: async () => {
      const [c, l, me] = await Promise.all([
        connectGetCountries(),
        connectGetLanguages(),
        authMe().catch(() => null),
      ]);
      return { countries: c.countries, languages: l.languages, me: me?.user };
    },
  });

  React.useEffect(() => {
    const me = geoQ.data?.me;
    if (!me || language) return;
    const langs = geoQ.data?.languages ?? [];
    const first = me.languagesKnown?.[0]?.toLowerCase();
    if (first) {
      const match = langs.find(
        (item) =>
          item.code.toLowerCase() === first || item.name.toLowerCase() === first
      );
      if (match) setLanguage(match.code);
    }
    const nat = me.nationality?.toLowerCase();
    if (nat && !targetCountry) {
      const match = (geoQ.data?.countries ?? []).find(
        (item) =>
          item.code.toLowerCase() === nat || item.name.toLowerCase() === nat
      );
      if (match) setTargetCountry(match.code);
    }
  }, [geoQ.data, language, targetCountry]);

  const runSearch = async () => {
    if (!language) {
      toast.error("Please select a language.");
      return;
    }
    setLoading(true);
    try {
      const res = await connectFindUsers({
        target_country: targetCountry || undefined,
        current_country: currentCountry || undefined,
        travel_style: travelStyle || undefined,
        lang: language,
        page: 1,
        limit: 30,
      });
      setUsers(res.users);
      setSearched(true);
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (user: FoundUser) => {
    setFollowBusy(user._id);
    const wasFollowing = user.isFollowing;
    setUsers((prev) =>
      prev.map((u) =>
        u._id === user._id ? { ...u, isFollowing: !wasFollowing } : u
      )
    );
    try {
      await followProfile(user._id);
    } catch (e) {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id ? { ...u, isFollowing: wasFollowing } : u
        )
      );
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setFollowBusy(null);
    }
  };

  const countries = geoQ.data?.countries ?? [];
  const languages = geoQ.data?.languages ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find fellow travelers</CardTitle>
          <CardDescription>
            Discover travelers who speak your language (same filters as the mobile app).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              People from country (optional)
            </span>
            <select
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Any country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Currently in country (optional)
            </span>
            <select
              value={currentCountry}
              onChange={(e) => setCurrentCountry(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Any country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Language (required)
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select language</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Travel style (optional)
            </span>
            <select
              value={travelStyle}
              onChange={(e) => setTravelStyle(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Any style</option>
              {TRAVEL_STYLES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={loading || !language}
              onClick={() => void runSearch()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search travelers
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && users.length === 0 && !loading && (
        <p className="text-center text-sm text-slate-500 dark:text-zinc-400">
          No travelers matched your filters. Try broadening your search.
        </p>
      )}

      <div className="grid gap-3">
        {users.map((user) => (
          <Card key={user._id}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <Link href={`/profile/${user._id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                  {user.profilePic ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.profilePic}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary">
                      {(user.fullName || user.username || "?").slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {user.fullName}
                  </p>
                  <p className="truncate text-sm text-slate-500">@{user.username}</p>
                  {user.travelStyle ? (
                    <p className="text-xs text-primary">
                      {TRAVEL_STYLES.find((s) => s.code === user.travelStyle)?.name ||
                        user.travelStyle}
                    </p>
                  ) : null}
                </div>
              </Link>
              <Button
                variant={user.isFollowing ? "outline" : "default"}
                size="sm"
                disabled={followBusy === user._id}
                onClick={() => void toggleFollow(user)}
              >
                {followBusy === user._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : user.isFollowing ? (
                  <>
                    <UserMinus className="mr-1 h-4 w-4" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1 h-4 w-4" />
                    Follow
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
