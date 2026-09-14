"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useFeed } from "../../../hooks/useFeed";
import { useWatch } from "../../../hooks/useWatch";
import { PostCard } from "../../../components/trip/post-card";
import { CommentsDrawer } from "../../../components/trip/comments-drawer";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { PenLine, ImagePlus, MapPin, Send, Compass, RefreshCw } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { useMounted } from "../../../hooks/use-mounted";
import { getLikedPostIds, getSavedPostIds, mergeLikedIntoPosts, mergeSavedIntoPosts } from "../../../lib/utils";
import { getFriendlyErrorMessage, isUnauthorizedError } from "../../../lib/auth-errors";
import { SocialConnect } from "../../../components/layout/social-connect";
import type { Post } from "../../../types/post";
import { api } from "../../../lib/axios";
import { toast } from "sonner";
import { canShowFeedAd } from "../../../lib/adsense";
import { FeedAdCard } from "../../../components/ads/feed-ad-card";
import { injectFeedAds, isFeedAdSlot } from "../../../lib/feed-ads";

type HomeTabId = "feed" | "watch";

type CreatorFormState = {
  contentNiche: string;
  contentNicheOther: string;
  experienceLevel: string;
  sampleLinks: string;
  postingFrequency: string;
  audienceRegions: string;
  equipment: string;
  whyTaatom: string;
  guidelinesAccepted: boolean;
};

const EMPTY_CREATOR_FORM: CreatorFormState = {
  contentNiche: "",
  contentNicheOther: "",
  experienceLevel: "",
  sampleLinks: "",
  postingFrequency: "",
  audienceRegions: "",
  equipment: "",
  whyTaatom: "",
  guidelinesAccepted: false,
};

const NICHE_OPTIONS = [
  { value: "travel_vlogs", label: "Travel vlogs" },
  { value: "destination_guides", label: "Destination guides" },
  { value: "adventure_sports", label: "Adventure & sports" },
  { value: "culture_food", label: "Culture & food" },
  { value: "lifestyle_storytelling", label: "Lifestyle storytelling" },
  { value: "other", label: "Other" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
];

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly or more" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "occasional", label: "Occasional" },
];

function CreatorRequestCta() {
  const { user } = useAuth();
  const [status, setStatus] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreatorFormState>(EMPTY_CREATOR_FORM);

  React.useEffect(() => {
    if (!user) return;
    api
      .get("/video-creator/status")
      .then((res) => {
        setStatus(res.data?.status || "none");
        setRejectionReason(res.data?.rejectionReason || "");
      })
      .catch(() => setStatus(null));
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy || status === "pending" || status === "approved") return;
    if (!form.contentNiche || !form.experienceLevel || !form.postingFrequency) {
      toast.error("Please complete all required fields");
      return;
    }
    if (form.contentNiche === "other" && !form.contentNicheOther.trim()) {
      toast.error("Describe your niche");
      return;
    }
    if (form.sampleLinks.trim().length < 8) {
      toast.error("Add at least one sample link");
      return;
    }
    if (form.audienceRegions.trim().length < 2) {
      toast.error("Add regions or destinations");
      return;
    }
    if (form.whyTaatom.trim().length < 10) {
      toast.error("Tell us why TAATOM (min 10 characters)");
      return;
    }
    if (!form.guidelinesAccepted) {
      toast.error("Accept the community guidelines");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post("/video-creator/request", {
        application: {
          ...form,
          contentNicheOther: form.contentNicheOther.trim(),
          sampleLinks: form.sampleLinks.trim(),
          audienceRegions: form.audienceRegions.trim(),
          equipment: form.equipment.trim(),
          whyTaatom: form.whyTaatom.trim(),
        },
        message: form.whyTaatom.trim(),
      });
      setStatus(res.data?.status || "pending");
      setOpen(false);
      setForm(EMPTY_CREATOR_FORM);
      toast.success("Creator application submitted for review");
    } catch (err: unknown) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <motion.div className="mt-6 inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button className="rounded-xl shadow-premium" asChild>
          <Link href="/auth/login?next=/feed">Sign in to request creator access</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div className="mt-6 inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          className="rounded-xl shadow-premium"
          onClick={() => {
            if (status === "pending" || status === "approved") return;
            setOpen(true);
          }}
          disabled={busy || status === "pending" || status === "approved"}
        >
          {status === "approved"
            ? "You are an approved creator"
            : status === "pending"
              ? "Creator request pending"
              : status === "rejected"
                ? "Re-apply as video creator"
                : "Creator Request"}
        </Button>
      </motion.div>
      {status === "rejected" && rejectionReason ? (
        <p className="mt-2 text-sm text-rose-600 max-w-md">Previous rejection: {rejectionReason}</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Creator application</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Answer a few questions for admin review.
                </p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Content niche *
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form.contentNiche}
                  onChange={(e) => setForm((f) => ({ ...f, contentNiche: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {NICHE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.contentNiche === "other" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Describe your niche *
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={form.contentNicheOther}
                    onChange={(e) => setForm((f) => ({ ...f, contentNicheOther: e.target.value }))}
                    maxLength={120}
                    required
                  />
                </label>
              ) : null}
              <label className="block text-sm font-medium text-slate-700">
                Experience *
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form.experienceLevel}
                  onChange={(e) => setForm((f) => ({ ...f, experienceLevel: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Sample video links (1–3) *
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[88px]"
                  value={form.sampleLinks}
                  onChange={(e) => setForm((f) => ({ ...f, sampleLinks: e.target.value }))}
                  maxLength={800}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Posting frequency *
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form.postingFrequency}
                  onChange={(e) => setForm((f) => ({ ...f, postingFrequency: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Regions / destinations *
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form.audienceRegions}
                  onChange={(e) => setForm((f) => ({ ...f, audienceRegions: e.target.value }))}
                  maxLength={200}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Camera / gear
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form.equipment}
                  onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
                  maxLength={200}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Why TAATOM? *
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[88px]"
                  value={form.whyTaatom}
                  onChange={(e) => setForm((f) => ({ ...f, whyTaatom: e.target.value }))}
                  maxLength={500}
                  required
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.guidelinesAccepted}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guidelinesAccepted: e.target.checked }))
                  }
                />
                <span>I agree to TAATOM community & content guidelines *</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="rounded-xl">
                  {busy ? "Submitting…" : "Submit for approval"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const feedTabs: { id: HomeTabId; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "watch", label: "Videos" },
];

const easeOut = [0.22, 1, 0.36, 1] as const;
const springSoft = { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.85 };

const feedHeroVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
};

const feedHeroItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

const feedListVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.05 },
  },
};

const postItemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: easeOut },
  },
};

function FeedContent() {
  const [activeTab, setActiveTab] = React.useState<HomeTabId>("feed");
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [commentsPost, setCommentsPost] = React.useState<Post | null>(null);
  const searchParams = useSearchParams();
  const deepLinkPostId = searchParams.get("postId");
  const mounted = useMounted();
  const feedQuery = useFeed("recents");
  const watchQuery = useWatch();
  const q = activeTab === "watch" ? watchQuery : feedQuery;
  const { user } = useAuth();

  React.useEffect(() => {
    setLoadMoreError(false);
  }, [activeTab]);

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "watch" || tab === "feed") setActiveTab(tab);
  }, [searchParams]);

  const fetchNextPageSafe = React.useCallback(() => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    q.fetchNextPage()
      .then(() => setLoadMoreError(false))
      .catch(() => setLoadMoreError(true));
  }, [q]);
  const rawPosts = React.useMemo(
    () => q.data?.pages.flatMap((p) => p.posts) ?? [],
    [q.data?.pages]
  );
  const likedIds = React.useMemo(() => (mounted ? getLikedPostIds() : []), [mounted]);
  const savedIds = React.useMemo(() => (mounted ? getSavedPostIds() : []), [mounted]);
  const posts: Post[] = React.useMemo(
    () => mergeSavedIntoPosts(mergeLikedIntoPosts(rawPosts, likedIds), savedIds),
    [rawPosts, likedIds, savedIds]
  );

  /** Photo + Videos lists: insert sponsored units every 5 items (mobile parity). */
  const feedItems = React.useMemo(() => {
    if (!canShowFeedAd() || posts.length === 0) return posts;
    return injectFeedAds(posts);
  }, [posts]);

  React.useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 900;
      if (nearBottom) fetchNextPageSafe();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPageSafe]);

  React.useEffect(() => {
    if (!deepLinkPostId || posts.length === 0) return;
    const el = document.querySelector(`[data-post-id="${deepLinkPostId}"]`);
    if (el) {
      let attempts = 0;
      const tryScroll = () => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        attempts += 1;
        if (attempts < 5) setTimeout(tryScroll, 100 * attempts);
      };
      tryScroll();
    }
  }, [deepLinkPostId, posts.length]);

  return (
    <div className="relative space-y-5 sm:space-y-6 lg:space-y-8">
      {/* Ambient wash — slow drift, low contrast */}
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-[460px] overflow-hidden" aria-hidden>
        <div className="feed-orb absolute -left-36 top-2 h-80 w-80 rounded-full bg-primary/[0.055] blur-3xl" />
        <div className="feed-orb-delayed absolute -right-16 top-28 h-[22rem] w-[22rem] rounded-full bg-violet-500/[0.045] blur-3xl" />
        <div className="feed-orb-late absolute left-[22%] top-44 h-64 w-64 rounded-full bg-sky-400/[0.04] blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f8fafc] dark:to-zinc-950" />
      </div>

      <div className="relative z-10 space-y-5 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.52, ease: easeOut }}
          className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-[1px] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.45)] sm:rounded-[1.85rem]"
        >
          <div className="relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-white via-white to-slate-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 sm:rounded-[1.8rem]">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              aria-hidden
              style={{
                background:
                  "radial-gradient(900px 320px at 0% 0%, rgba(59,130,246,0.06), transparent 55%), radial-gradient(700px 280px at 100% 0%, rgba(139,92,246,0.05), transparent 50%)",
              }}
            />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-zinc-700/50" aria-hidden />
            <motion.div
              variants={feedHeroVariants}
              initial="hidden"
              animate="show"
              className="relative flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8"
            >
              <div className="min-w-0 flex-1">
                <motion.p
                  variants={feedHeroItemVariants}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500"
                >
                  {activeTab === "watch" ? "Videos" : "News feed"}
                </motion.p>
                <motion.h1
                  variants={feedHeroItemVariants}
                  className="mt-3 font-display text-[1.65rem] font-semibold leading-[1.15] tracking-[-0.02em] text-slate-950 sm:text-3xl lg:text-[2.125rem] dark:text-zinc-50"
                >
                  <span className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-400">
                    {activeTab === "watch" ? "Long-form from creators" : "Stories that move with you"}
                  </span>
                </motion.h1>
                <motion.p
                  variants={feedHeroItemVariants}
                  className="mt-3 max-w-lg text-sm leading-[1.65] text-slate-600 dark:text-zinc-400 sm:text-[15px]"
                >
                  {activeTab === "watch"
                    ? "Videos from approved creators — play, like, comment, and share."
                    : "Trips and moments from travelers you follow — calm, visual, and easy to browse."}
                </motion.p>
                <motion.div variants={feedHeroItemVariants} className="mt-5 hidden sm:block">
                  <div className="border-t border-slate-100/90 pt-4 dark:border-zinc-800/80">
                    <SocialConnect variant="inline" />
                  </div>
                </motion.div>
              </div>
              <motion.div
                variants={feedHeroItemVariants}
                className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end md:flex-row md:items-center"
              >
                <div className="relative inline-flex rounded-2xl bg-slate-100/85 p-1.5 shadow-inner shadow-slate-200/40 ring-1 ring-slate-200/50 dark:bg-zinc-800/90 dark:shadow-black/40 dark:ring-zinc-700/80">
                  {feedTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className="relative z-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-300"
                      >
                        {active && (
                          <motion.span
                            layoutId="feed-tab-pill"
                            className="absolute inset-0 -z-10 rounded-xl bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:shadow-black/30 dark:ring-zinc-600/80"
                            transition={springSoft}
                          />
                        )}
                        <span
                          className={
                            active
                              ? "text-slate-900 dark:text-zinc-50"
                              : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                          }
                        >
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={springSoft}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200/70 bg-white/90 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800/90"
                    onClick={() => {
                      setLoadMoreError(false);
                      void q.refetch();
                    }}
                    disabled={q.isRefetching}
                    aria-label="Refresh feed"
                  >
                    <RefreshCw className={`h-4 w-4 ${q.isRefetching ? "animate-spin" : ""}`} />
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.header>

        {activeTab === "watch" ? (
          <div className="relative z-10 space-y-4">
            <CreatorRequestCta />
          </div>
        ) : null}

        {/* Composer — photo Feed only */}
        {activeTab === "feed" ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: easeOut, delay: 0.06 }}
        >
          <Link href="/create" className="group block">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.997 }}
              transition={springSoft}
              className="flex items-center gap-3 rounded-[1.75rem] border border-slate-200/70 bg-white/92 px-4 py-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.25)] transition-[border-color,box-shadow] duration-500 group-hover:border-slate-300/60 group-hover:shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)] dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.5)] dark:group-hover:border-zinc-600 dark:group-hover:shadow-[0_20px_50px_-28px_rgba(0,0,0,0.45)] sm:gap-4 sm:px-6 sm:py-5 md:px-8"
            >
              <motion.div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/12 to-violet-500/12 ring-1 ring-slate-200/70 dark:ring-zinc-600/60"
                whileHover={{ scale: 1.04 }}
                transition={springSoft}
              >
                {mounted && user?.profilePic ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.profilePic}
                    alt="Your profile"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    <PenLine className="h-6 w-6" />
                  </div>
                )}
              </motion.div>
              <span className="flex-1 text-left text-[15px] text-slate-500 transition-colors duration-300 group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                Share a trip or experience…
              </span>
              <div className="hidden items-center gap-1 sm:flex">
                <span className="rounded-xl p-2.5 text-slate-400 transition-all duration-300 group-hover:bg-slate-100/90 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-300">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="rounded-xl p-2.5 text-slate-400 transition-all duration-300 group-hover:bg-slate-100/90 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-300">
                  <MapPin className="h-5 w-5" />
                </span>
              </div>
              <span
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 transition-opacity duration-300 group-hover:opacity-[0.96] [&_svg]:text-white"
                aria-hidden
              >
                <Send className="h-4 w-4" />
                Post
              </span>
            </motion.div>
          </Link>
        </motion.div>
        ) : null}

        {/* Feed posts */}
        <div className="grid gap-4 sm:gap-6 lg:gap-8">
          {q.isPending ? (
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: easeOut }}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm border-premium dark:border-zinc-800/80 dark:bg-zinc-900/90"
              >
                <div className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </motion.div>
            ))
          ) : q.isError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: easeOut }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-12 text-center shadow-premium backdrop-blur-sm border-premium dark:border-zinc-800/80 dark:bg-zinc-900/90"
            >
              <p className="text-[15px] text-slate-600 dark:text-zinc-300">{getFriendlyErrorMessage(q.error)}</p>
              <motion.div className="mt-5 flex flex-wrap items-center justify-center gap-3" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="rounded-xl shadow-premium"
                  onClick={() => {
                    setLoadMoreError(false);
                    void q.refetch();
                  }}
                >
                  Try again
                </Button>
                {isUnauthorizedError(q.error) && (
                  <Button variant="outline" className="rounded-xl border-slate-200/80 dark:border-zinc-700" asChild>
                    <Link href="/auth/login?next=/feed">Sign in</Link>
                  </Button>
                )}
              </motion.div>
            </motion.div>
          ) : posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-14 text-center shadow-premium backdrop-blur-sm border-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-16"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 ring-1 ring-slate-200/80 dark:ring-zinc-700/80"
              >
                <Compass className="h-8 w-8 text-primary/70" />
              </motion.div>
              {activeTab === "watch" ? (
                <>
                  <h3 className="mt-6 font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
                    Nothing in Videos yet
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-zinc-400">
                    Long-form videos from approved creators will show up here.
                  </p>
                  <CreatorRequestCta />
                </>
              ) : (
                <>
                  <h3 className="mt-6 font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
                    No posts yet
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-zinc-400">
                    Be the first to share a trip or follow travelers to see their stories.
                  </p>
                  <motion.div
                    className="mt-6 inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button className="rounded-xl shadow-premium" asChild>
                      <Link href="/create">Create post</Link>
                    </Button>
                  </motion.div>
                </>
              )}
            </motion.div>
          ) : (
            <>
              {loadMoreError && posts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 rounded-[1.25rem] border border-amber-200/90 bg-amber-50/90 px-4 py-3 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  role="status"
                >
                  <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                    Couldn&apos;t load more posts. Check your connection and try again.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-xl border-amber-300 bg-white/90 text-amber-950 hover:bg-white dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-100 dark:hover:bg-zinc-700"
                    onClick={() => {
                      setLoadMoreError(false);
                      fetchNextPageSafe();
                    }}
                    disabled={q.isFetchingNextPage || !q.hasNextPage}
                  >
                    Retry
                  </Button>
                </motion.div>
              )}
              <motion.div
                key={activeTab}
                variants={feedListVariants}
                initial="hidden"
                animate="show"
                className="grid items-stretch gap-8 xl:grid-cols-2"
              >
                {feedItems.map((item) => {
                  if (isFeedAdSlot(item)) {
                    return (
                      <motion.div
                        key={`feed-ad-${item.adIndex}-${item.afterCount}`}
                        variants={postItemVariants}
                        className="flex h-full min-h-0"
                      >
                        <FeedAdCard adIndex={item.adIndex} />
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div
                      key={item._id}
                      variants={postItemVariants}
                      data-post-id={item._id}
                      className="flex h-full min-h-0"
                    >
                      <PostCard post={item} onOpenComments={(post) => setCommentsPost(post)} />
                    </motion.div>
                  );
                })}
              </motion.div>

              {q.isFetchingNextPage ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center py-8"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40 [animation-delay:300ms]" />
                    <span className="ml-1">Loading more…</span>
                  </span>
                </motion.div>
              ) : q.hasNextPage ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center"
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200/80 bg-white/80 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/90"
                      onClick={() => {
                        setLoadMoreError(false);
                        fetchNextPageSafe();
                      }}
                    >
                      Load more
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400"
                >
                  You&apos;re all caught up.
                </motion.p>
              )}
            </>
          )}
        </div>
      </div>

      <CommentsDrawer post={commentsPost} onClose={() => setCommentsPost(null)} />
    </div>
  );
}

function FeedPageFallback() {
  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <header className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6 md:p-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
        <div className="mt-5 flex flex-wrap gap-3">
          <Skeleton className="h-11 w-[220px] max-w-full rounded-2xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </header>
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-4 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-[1.75rem]" />
        ))}
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <React.Suspense fallback={<FeedPageFallback />}>
      <FeedContent />
    </React.Suspense>
  );
}
