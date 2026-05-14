"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  LayoutDashboard,
  Users,
  Trash2,
  ExternalLink,
  Info,
  MessageCircle,
  X,
  User,
} from "lucide-react";
import {
  connectGetPageDetail,
  connectFollowPage,
  connectUnfollowPage,
  connectRecordView,
  connectSubscribe,
  connectGetSubscriptionStatus,
  connectCancelSubscription,
  connectDeletePage,
  connectGetPayoutPreview,
  connectGetPageFollowers,
} from "@/lib/connect-api";
import type { ConnectFollower } from "@/lib/connect-api";
import { openCashfreeSubscriptionCheckout } from "@/lib/cashfree-client";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { ConnectContentBlocks } from "@/components/connect/connect-content-blocks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "website" | "subscription";

export default function ConnectPageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const qc = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("website");
  const [followBusy, setFollowBusy] = React.useState(false);
  const [subBusy, setSubBusy] = React.useState(false);
  const [payoutBreakdownOpen, setPayoutBreakdownOpen] = React.useState(false);
  const [followersOpen, setFollowersOpen] = React.useState(false);
  const cashfreeReturnDoneRef = React.useRef(false);

  const detailQ = useQuery({
    queryKey: ["connect-page", id],
    queryFn: () => connectGetPageDetail(id),
    enabled: !!id,
  });

  const subQ = useQuery({
    queryKey: ["connect-sub-status", id],
    queryFn: () => connectGetSubscriptionStatus(id),
    enabled:
      !!id &&
      !!detailQ.data?.page &&
      !detailQ.data.isOwner &&
      !!detailQ.data.page.features?.subscription,
  });

  const showSubTabEarly = !!detailQ.data?.page?.features?.subscription;
  const hasPriceEarly = !!(
    detailQ.data?.page?.subscriptionPrice &&
    detailQ.data.page.subscriptionPrice >= 100
  );
  const priceApprovedEarly = detailQ.data?.page?.subscriptionApproval?.status === "approved";
  const isOwnerEarly = detailQ.data?.isOwner ?? false;

  const payoutPreviewQ = useQuery({
    queryKey: ["connect-payout-preview", id],
    queryFn: () => connectGetPayoutPreview(id),
    enabled:
      !!id &&
      payoutBreakdownOpen &&
      isOwnerEarly &&
      showSubTabEarly &&
      hasPriceEarly &&
      priceApprovedEarly,
  });

  const followersQ = useQuery({
    queryKey: ["connect-page-followers", id],
    queryFn: () => connectGetPageFollowers(id, 1, 50),
    enabled: !!id && followersOpen,
  });

  const page = detailQ.data?.page;
  const isOwner = detailQ.data?.isOwner ?? false;
  const isFollowing = detailQ.data?.isFollowing ?? page?.isFollowing ?? false;
  const isCommunityPage = page?.category === "community" || page?.isAdminPage === true;

  React.useEffect(() => {
    if (id) void connectRecordView(id);
  }, [id]);

  /** After Cashfree redirect: refresh subscription state and strip query params (avoids broken `{subscription_status}` macros). */
  React.useEffect(() => {
    if (!id || cashfreeReturnDoneRef.current) return;
    const returned = searchParams.get("subscription_return");
    const status = searchParams.get("subscription_status");
    const brokenMacro = status?.includes("{");
    if (returned !== "1" && !status && !brokenMacro) return;

    cashfreeReturnDoneRef.current = true;
    if (returned === "1" || (status && !brokenMacro)) {
      toast.success("Payment completed. Refreshing your subscription…");
    } else if (brokenMacro) {
      toast.message("Back from checkout. Syncing subscription status…");
    }
    void qc.invalidateQueries({ queryKey: ["connect-sub-status", id] });
    void qc.invalidateQueries({ queryKey: ["connect-page", id] });
    router.replace(`/connect/page/${id}`, { scroll: false });

    const delaysMs = [1200, 3500, 8000];
    delaysMs.forEach((delay) => {
      window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["connect-sub-status", id] });
      }, delay);
    });
  }, [id, searchParams, qc, router]);

  React.useEffect(() => {
    cashfreeReturnDoneRef.current = false;
  }, [id]);

  React.useEffect(() => {
    if (page && !page.features?.website && page.features?.subscription) {
      setTab("subscription");
    }
  }, [page]);

  const ownerUser =
    page && typeof page.userId === "object" && page.userId !== null
      ? page.userId
      : null;

  const canViewSubscriptionContent =
    isOwner ||
    (subQ.data?.isSubscribed &&
      subQ.data?.subscription?.status === "active");

  const handleFollow = async () => {
    if (!page) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await connectUnfollowPage(page._id);
        toast.success("Unfollowed");
      } else {
        await connectFollowPage(page._id);
        toast.success("Following");
      }
      await qc.invalidateQueries({ queryKey: ["connect-page", id] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSubscribe = async () => {
    if (!page) return;
    setSubBusy(true);
    try {
      const res = await connectSubscribe(page._id);
      if (res.paymentSessionId) {
        await openCashfreeSubscriptionCheckout(res.paymentSessionId);
        toast.message("Complete payment on the Cashfree page, then return here if needed.");
      }
      await qc.invalidateQueries({ queryKey: ["connect-sub-status", id] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setSubBusy(false);
    }
  };

  const handleCancelSub = async () => {
    const subId = subQ.data?.subscription?._id;
    if (!subId) return;
    if (!confirm("Are you sure you want to cancel? You will retain access until the end of the current billing period.")) return;
    try {
      await connectCancelSubscription(subId);
      toast.success(isCommunityPage ? "Your purchase has been cancelled." : "Your subscription has been cancelled.");
      await qc.invalidateQueries({ queryKey: ["connect-sub-status", id] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  const handleDelete = async () => {
    if (!page || !isOwner) return;
    if (!confirm("Delete this Connect page permanently?")) return;
    try {
      await connectDeletePage(page._id);
      toast.success("Page deleted.");
      router.replace("/connect");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  if (detailQ.isLoading || !page) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (detailQ.isError) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-destructive">Could not load this page.</p>
        <Link href="/connect" className="mt-4 inline-block text-primary underline">
          Back to Connect
        </Link>
      </div>
    );
  }

  const showSubTab = page.features?.subscription;
  const priceApproved = page.subscriptionApproval?.status === "approved";
  const hasPrice = !!(page.subscriptionPrice && page.subscriptionPrice >= 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-28 lg:pb-10">
      <Link href="/connect" className="text-sm font-medium text-primary hover:underline">
        ← {isCommunityPage ? "Community" : "Connect"}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-premium dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="relative h-36 bg-gradient-to-br from-primary/25 to-violet-500/15 md:h-44">
          {page.bannerImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={page.bannerImage} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="relative px-5 pb-6 pt-0 md:px-8">
          <div className="-mt-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg dark:border-zinc-900 dark:bg-zinc-900">
                {page.profileImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={page.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary">
                    {page.name?.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="mb-1 min-w-0">
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                  {page.name}
                </h1>
                {ownerUser && (
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    @{ownerUser.username} · {ownerUser.fullName}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setFollowersOpen((v) => !v)}
                    className="underline decoration-slate-300 underline-offset-2 transition hover:text-primary hover:decoration-primary dark:decoration-zinc-600"
                  >
                    {(page.followerCount ?? 0) + 1} Members
                  </button>
                  <span>{page.viewCount ?? 0} views</span>
                  {hasPrice && priceApproved && (
                    <span className="font-semibold text-primary">
                      {(page.subscriptionCurrency || "INR") + " " + (page.subscriptionPrice ?? "")}/mo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {isOwner ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/connect/dashboard/${page._id}`}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </Button>
                  {showSubTab && hasPrice && priceApproved && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPayoutBreakdownOpen((v) => !v)}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      {payoutBreakdownOpen ? "Hide payout breakdown" : "Payout breakdown"}
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant={isFollowing ? "outline" : "default"} disabled={followBusy} onClick={handleFollow}>
                    {followBusy ? "…" : isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  {showSubTab && hasPrice && priceApproved && (
                    <>
                      {subQ.data?.isSubscribed && subQ.data.subscription?.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={handleCancelSub}>
                          {isCommunityPage ? "Cancel purchase" : "Cancel subscription"}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={subBusy} onClick={handleSubscribe}>
                          {subBusy ? "…" : isCommunityPage ? "Buy" : "Subscribe"}
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {page.bio ? (
            <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300">
              {page.bio}
            </p>
          ) : null}

          {followersOpen && (
            <Card className="mt-6 border-slate-200 dark:border-zinc-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Members</CardTitle>
                <button
                  type="button"
                  onClick={() => setFollowersOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent className="space-y-2">
                {followersQ.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : followersQ.isError ? (
                  <p className="text-sm text-destructive">Could not load followers.</p>
                ) : (followersQ.data?.followers ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-zinc-400">No followers yet.</p>
                ) : (
                  (followersQ.data?.followers ?? []).map((f: ConnectFollower) => (
                    <Link
                      key={f._id}
                      href={`/profile/${f._id}`}
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                        {f.profilePic ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={f.profilePic} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {f.fullName ?? f.username ?? "User"}
                        </p>
                        {f.username && (
                          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">@{f.username}</p>
                        )}
                      </div>
                      {f.role === "admin" && (
                        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Admin
                        </span>
                      )}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {page.features?.groupChat && page.chatRoomId && (
            <Link
              href={`/chat/room/${page.chatRoomId}`}
              className="mt-6 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 transition hover:border-primary/30 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-primary/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">Group Chat</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {(page.followerCount ?? 0) + 1} members active
                </p>
              </div>
              <svg className="h-4 w-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {isOwner && payoutBreakdownOpen && showSubTab && hasPrice && priceApproved && (
            <Card className="mt-6 border-slate-200 bg-slate-50/90 dark:border-zinc-700 dark:bg-zinc-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estimated payout per subscriber payment</CardTitle>
                <CardDescription>
                  Illustrative breakdown before taxes or rounding — actual totals may vary slightly with gateway
                  settlement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {payoutPreviewQ.isLoading ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </div>
                ) : payoutPreviewQ.isError ? (
                  <p className="text-destructive">{getFriendlyErrorMessage(payoutPreviewQ.error)}</p>
                ) : !payoutPreviewQ.data?.preview ? (
                  <p className="text-muted-foreground">No preview available for this price.</p>
                ) : (
                  (() => {
                    const p = payoutPreviewQ.data.preview;
                    const sym = p.currencySymbol || "";
                    const row = (label: string, amount: number, opts?: { emphasize?: boolean; deduct?: boolean }) => (
                      <div
                        className={cn(
                          "flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0 dark:border-zinc-700",
                          opts?.emphasize && "font-semibold text-slate-900 dark:text-white",
                        )}
                      >
                        <span className="text-slate-600 dark:text-zinc-400">{label}</span>
                        <span className={cn(opts?.deduct && "text-rose-600 dark:text-rose-400")}>
                          {opts?.deduct ? "-" : ""}
                          {sym}
                          {amount}
                        </span>
                      </div>
                    );
                    return (
                      <>
                        {row(`${isCommunityPage ? "Buyer" : "Subscriber"} pays (${p.currency})`, p.grossAmount)}
                        {row(`Payment gateway (${p.gatewayFeePercent}%)`, p.gatewayFee, { deduct: true })}
                        {p.fxCharge > 0
                          ? row(
                              `FX charge (${p.isInternational ? `${p.feeStructure.fxChargePercent}%` : "0%"})`,
                              p.fxCharge,
                              { deduct: true },
                            )
                          : null}
                        {row("Net after gateway", p.netAfterGateway)}
                        {row(`Taatom commission (${p.commissionPercent}%)`, p.commissionAmount, { deduct: true })}
                        {row(`GST on commission (${p.gstPercent}%)`, p.gstAmount, { deduct: true })}
                        {p.wiseFee > 0
                          ? row(`Wise transfer fee (${p.wiseFeePercent}%)`, p.wiseFee, { deduct: true })
                          : null}
                        {row("You receive (estimate)", p.creatorPayout, { emphasize: true })}
                        <p className="pt-2 text-xs text-muted-foreground">{p.note}</p>
                      </>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          )}

          {(page.features?.website || showSubTab) && (
            <div className="mt-8 border-t border-slate-100 pt-6 dark:border-zinc-800">
              <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-800">
                {page.features?.website && (
                  <button
                    type="button"
                    className={cn(
                      "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
                      tab === "website"
                        ? "border-primary text-primary"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                    )}
                    onClick={() => setTab("website")}
                  >
                    Website
                  </button>
                )}
                {showSubTab && (
                  <button
                    type="button"
                    className={cn(
                      "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
                      tab === "subscription"
                        ? "border-primary text-primary"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                    )}
                    onClick={() => setTab("subscription")}
                  >
                    <Users className="mr-1 inline h-4 w-4" />
                    {isCommunityPage ? "Premium content" : "Subscription"}
                  </button>
                )}
              </div>
              <div className="pt-6">
                {tab === "website" && page.features?.website && (
                  <ConnectContentBlocks
                    blocks={page.websiteContent}
                    pageBackground={page.websiteBackground}
                    pageTextColor={page.websiteTextColor}
                  />
                )}
                {tab === "subscription" && showSubTab && (
                  <>
                    {!canViewSubscriptionContent ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/40">
                        <p className="text-sm text-slate-600 dark:text-zinc-300">
                          {isCommunityPage
                            ? "Buy to unlock exclusive content from this community."
                            : "Subscribe to unlock exclusive content from this creator."}
                        </p>
                        {!isOwner && hasPrice && priceApproved && !(subQ.data?.isSubscribed && subQ.data.subscription?.status === "active") && (
                          <Button className="mt-4" disabled={subBusy} onClick={handleSubscribe}>
                            {isCommunityPage ? "Buy now" : "Subscribe now"}
                          </Button>
                        )}
                        {subQ.data?.subscription?.status === "initialized" && (
                          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                            Payment pending — complete checkout if a tab opened.
                          </p>
                        )}
                      </div>
                    ) : page.subscriptionContent && page.subscriptionContent.length > 0 ? (
                      <ConnectContentBlocks
                        blocks={page.subscriptionContent}
                        pageBackground={page.subscriptionBackground}
                        pageTextColor={page.subscriptionTextColor}
                      />
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {isOwner ? "No content added yet." : "No services listed yet."}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Payments open in a secure Cashfree window.{" "}
        <a className="text-primary underline" href="https://www.cashfree.com" target="_blank" rel="noreferrer">
          Learn more <ExternalLink className="inline h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
