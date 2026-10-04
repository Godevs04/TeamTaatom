"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Ban,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Crown,
  Eye,
  FileText,
  Gift,
  Hash,
  HelpCircle,
  Info,
  Lock,
  Play,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  activateCreatorMonetization,
  getCreatorMonetizationDashboard,
  requestCreatorWithdrawal,
  saveCreatorPayoutProfile,
  submitCreatorVerification,
  type MonetizationDashboard,
  type MonetizationGate,
} from "../../../lib/creator-monetization";

const STATUS_LABEL: Record<string, string> = {
  not_eligible: "Not eligible",
  eligible: "Eligible",
  active: "Active",
  locked: "Locked",
  under_review: "Under review",
  terminated: "Terminated",
};

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

const count = (value: number) => Number(value || 0).toLocaleString("en-IN");

function statusCopy(status: string) {
  if (status === "eligible") {
    return {
      title: "You're eligible for monetization.",
      body: "Keep creating original content to maximize your earnings.",
    };
  }
  if (status === "active") {
    return {
      title: "Monetization is active.",
      body: "New eligible views earn at the current rate. This month stays pending until it is validated.",
    };
  }
  if (status === "locked") {
    return {
      title: "Monetization is locked.",
      body: "Your available balance can still be withdrawn. One qualifying month unlocks the account.",
    };
  }
  if (status === "under_review") {
    return {
      title: "Your account is under review.",
      body: "New earnings are paused until TAATOM finishes the review.",
    };
  }
  if (status === "terminated") {
    return {
      title: "Monetization has ended.",
      body: "This account can no longer earn from views.",
    };
  }
  return {
    title: "You're not eligible yet.",
    body: "Reach the follower, video, and view requirements to qualify.",
  };
}

function verifyMeta(status: string) {
  if (status === "verified") return { label: "Verified", className: "bg-emerald-50 text-emerald-600" };
  if (status === "pending") return { label: "In review", className: "bg-orange-50 text-orange-600" };
  if (status === "rejected") return { label: "Rejected", className: "bg-red-50 text-red-600" };
  return { label: "Not verified", className: "bg-orange-50 text-orange-600" };
}

export default function CreatorMonetizationPage() {
  const [dashboard, setDashboard] = React.useState<MonetizationDashboard | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [legalName, setLegalName] = React.useState("");
  const [method, setMethod] = React.useState<"bank" | "upi">("bank");
  const [bankAccountName, setBankAccountName] = React.useState("");
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [bankIfsc, setBankIfsc] = React.useState("");
  const [upiId, setUpiId] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [amount, setAmount] = React.useState("");

  const apply = (next: MonetizationDashboard) => {
    setDashboard(next);
    setLegalName(next.payoutProfile.legalName || "");
    setMethod(next.payoutProfile.method === "upi" ? "upi" : "bank");
    setBankAccountName(next.payoutProfile.bankAccountName || "");
    setBankIfsc(next.payoutProfile.bankIfsc || "");
    setUpiId(next.payoutProfile.upiId || "");
    setAmount((current) => current || String(next.minimumWithdrawal || 1000));
  };

  React.useEffect(() => {
    getCreatorMonetizationDashboard()
      .then(apply)
      .catch(() => setError("Could not load Creator Dashboard."));
  }, []);

  const run = async (action: () => Promise<MonetizationDashboard>) => {
    try {
      setBusy(true);
      apply(await action());
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const copy = statusCopy(dashboard?.status || "not_eligible");
  const verify = verifyMeta(dashboard?.verificationStatus || "none");
  const good = dashboard?.status === "eligible" || dashboard?.status === "active";
  const reason = dashboard?.status === "locked"
    ? dashboard.lockReason
    : dashboard?.status === "under_review" || dashboard?.status === "terminated"
      ? dashboard.reviewReason || dashboard.lockReason
      : "";
  const total = (dashboard?.pending || 0) + (dashboard?.available || 0) + (dashboard?.withdrawn || 0);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-24 text-slate-900 lg:pb-10 dark:text-zinc-50">
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-500">Creator Dashboard</p>
          <h1 className="text-xl font-extrabold">Monetization</h1>
        </div>
        <a href="#program-rules" className="grid h-10 w-10 place-items-center rounded-full text-slate-700 dark:text-zinc-200" aria-label="Program rules">
          <HelpCircle className="h-6 w-6" />
        </a>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!dashboard && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {dashboard ? (
        <>
          <section className="rounded-3xl bg-gradient-to-br from-sky-100 to-emerald-50 p-4 dark:from-sky-950 dark:to-emerald-950">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-blue-600 dark:bg-sky-900">
                <CircleDollarSign className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-500">Status</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${good ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {STATUS_LABEL[dashboard.status] || dashboard.status}
                  </span>
                </div>
                <p className="mt-1 text-base font-extrabold">{copy.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-zinc-400">{copy.body}</p>
              </div>
              <Crown className="h-10 w-10 shrink-0 text-slate-300" />
            </div>
            {reason ? <p className="mt-3 text-sm text-amber-700">{reason}</p> : null}
            {dashboard.canActivate ? (
              <button type="button" disabled={busy} className="mt-3 w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-extrabold text-white disabled:opacity-50" onClick={() => run(activateCreatorMonetization)}>
                Activate monetization
              </button>
            ) : null}
          </section>

          <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <h2 className="text-base font-extrabold">Progress to qualify</h2>
            <Qualify icon={<UserRound className="h-4 w-4" />} label="Followers" gate={dashboard.followers} detail={`Reach ${count(dashboard.followers.required)} followers`} />
            <Qualify icon={<Play className="h-4 w-4" />} label="Videos this month" gate={dashboard.videos} detail={`Post at least ${count(dashboard.videos.required)} eligible videos`} />
            <Qualify icon={<BarChart3 className="h-4 w-4" />} label="Monthly views" gate={dashboard.monthlyViews} detail={`Get ${count(dashboard.monthlyViews.required)} views recorded this month`} />
            <Qualify icon={<Eye className="h-4 w-4" />} label="Eligible views" gate={dashboard.eligibleViewsProgress} detail="Only these valid views count toward the requirement and earnings" />
          </section>

          <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <h2 className="text-base font-extrabold">Earnings</h2>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-500">Total earnings</p>
                <p className="text-3xl font-extrabold">{inr(total)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 rounded-2xl bg-slate-50 py-3 dark:bg-zinc-800">
              <Stat label="Available" value={inr(dashboard.available)} />
              <Stat label="Pending" value={inr(dashboard.pending)} />
              <Stat label="Withdrawn" value={inr(dashboard.withdrawn)} />
            </div>
            <p className="text-sm leading-5 text-slate-500">
              This month {inr(dashboard.thisMonthEarnings)} at {inr(dashboard.ratePerThousand)} per 1,000 eligible views.
              {dashboard.ratePerThousand > 0 ? " Pending moves to Available after the Asia/Kolkata month is validated." : " TAATOM has not set a rupee rate yet, so earnings stay at ₹0.00."}
              {dashboard.status === "eligible" || dashboard.status === "not_eligible" ? " Views before you activate do not earn." : ""}
            </p>
            <p className="flex gap-2 text-sm leading-5 text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Payouts are processed after verification and may take 3–7 business days.
            </p>
          </section>

          <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-extrabold">Payout and identity</h2>
                <p className="text-sm leading-5 text-slate-500">Verify your identity and add payout details to receive earnings.</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${verify.className}`}>{verify.label}</span>
            </div>
            {dashboard.verificationNote ? <p className="text-sm text-amber-700">{dashboard.verificationNote}</p> : null}
            {dashboard.withdrawalHoldReason ? <p className="text-sm text-amber-700">{dashboard.withdrawalHoldReason}</p> : null}

            <h3 className="text-sm font-extrabold">Payout account</h3>
            <p className="text-sm text-slate-500">Add your bank or UPI details to receive payments.</p>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-zinc-800">
              {(["bank", "upi"] as const).filter((item) => dashboard.paymentMethods.includes(item)).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-xl py-2.5 text-sm font-bold ${method === item ? "bg-blue-600 text-white" : "text-slate-500"}`}
                  onClick={() => setMethod(item)}
                >
                  {item === "bank" ? "Bank account" : "UPI"}
                </button>
              ))}
            </div>

            <Field icon={<UserRound className="h-4 w-4" />} label="Legal name" value={legalName} onChange={setLegalName} placeholder="Enter your legal name" />
            {method === "bank" ? (
              <>
                <Field icon={<CreditCard className="h-4 w-4" />} label="Account name" value={bankAccountName} onChange={setBankAccountName} placeholder="As per bank records" />
                <Field icon={<Hash className="h-4 w-4" />} label="Account number" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder={dashboard.payoutProfile.bankAccountNumber || "Enter account number"} />
                <Field icon={<Building2 className="h-4 w-4" />} label="IFSC" value={bankIfsc} onChange={setBankIfsc} placeholder="Enter IFSC code" />
              </>
            ) : (
              <Field icon={<Hash className="h-4 w-4" />} label="UPI ID" value={upiId} onChange={setUpiId} placeholder="name@bank" />
            )}
            {dashboard.requireTaxIdentity ? (
              <Field icon={<CreditCard className="h-4 w-4" />} label="PAN" value={taxId} onChange={setTaxId} placeholder={dashboard.payoutProfile.taxId || "Enter PAN number"} />
            ) : null}

            <button type="button" disabled={busy} className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-extrabold text-white disabled:opacity-50" onClick={() => run(() => saveCreatorPayoutProfile({ legalName, method, bankAccountName, bankAccountNumber, bankIfsc, upiId, taxId }))}>
              Save payout details
            </button>
            {dashboard.verificationStatus !== "verified" ? (
              <button type="button" disabled={busy} className="w-full rounded-2xl border-2 border-blue-600 py-3.5 text-sm font-extrabold text-blue-600 disabled:opacity-50" onClick={() => run(submitCreatorVerification)}>
                Submit for verification
              </button>
            ) : null}
            <a href="#payout-history" className="block w-full rounded-2xl border-2 border-blue-600 py-3.5 text-center text-sm font-extrabold text-blue-600">
              View payout history
            </a>

            <div className="flex items-center gap-2 pt-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">
                <Wallet className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-extrabold">Withdraw</h3>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Amount (INR)
              <span className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-zinc-700">
                <span className="text-base text-slate-400">₹</span>
                <input className="w-full bg-transparent py-3 text-base font-bold outline-none" value={amount} onChange={(event) => setAmount(event.target.value)} />
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </span>
            </label>
            <button
              type="button"
              disabled={busy || !dashboard.canWithdraw}
              className={`w-full rounded-2xl py-3.5 text-sm font-extrabold disabled:cursor-not-allowed ${dashboard.canWithdraw ? "bg-blue-600 text-white" : "bg-blue-50 text-slate-400 dark:bg-zinc-800"}`}
              onClick={() => run(() => requestCreatorWithdrawal(Number(String(amount).replace(/,/g, ""))))}
            >
              Request withdrawal
            </button>
            <p className="text-sm leading-5 text-slate-500">
              {dashboard.withdrawBlockReason
                || `Minimum withdrawal amount is ${inr(dashboard.minimumWithdrawal).replace(/\.00$/, "")}. Payouts are processed via bank transfer and may take 3–7 business days.`}
            </p>
          </section>

          <section id="payout-history" className="space-y-2 rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <h2 className="text-base font-extrabold">Payout history</h2>
            {dashboard.withdrawals.length === 0 ? <p className="text-sm text-slate-500">No withdrawals yet.</p> : null}
            {dashboard.withdrawals.map((row) => (
              <div key={row.id} className="border-t border-slate-100 pt-2 text-sm dark:border-zinc-800">
                <p className="font-bold">{inr(row.amount)} · {row.method === "upi" ? "UPI" : "Bank"}</p>
                <p className="text-slate-500">
                  {row.status}{row.payoutReference ? ` · ${row.payoutReference}` : ""}{row.rejectionReason ? ` · ${row.rejectionReason}` : ""}{row.holdReason ? ` · ${row.holdReason}` : ""}
                </p>
              </div>
            ))}
          </section>

          {dashboard.notices?.length ? (
            <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
              <h2 className="text-base font-extrabold">Notices</h2>
              {dashboard.notices.map((notice, index) => (
                <p key={`${notice.at || index}`} className="text-sm leading-5">{notice.message}</p>
              ))}
            </section>
          ) : null}

          <div id="program-rules" className="space-y-3">
            <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold">Program rules</h2>
                  <p className="text-sm leading-5 text-slate-500">A view earns only when it comes from a logged-in TAATOM account that meets our eligibility criteria.</p>
                </div>
              </div>
            </section>
            <Rule icon={<Eye className="h-4 w-4" />} tint="bg-emerald-50 text-emerald-600" title="Eligible views" body="A view counts only if it comes from a logged-in TAATOM account that is not the video owner, is verified, watched at least one second, and has not already counted for that video. Logged-out traffic, repeats, and your own views do not earn." />
            <Rule icon={<Play className="h-4 w-4" />} tint="bg-violet-50 text-violet-600" title="Eligible content" body="Your own shorts and long videos that are active and not hidden, archived, flagged, or removed are eligible. Photos do not earn. YouTube imports do not earn unless TAATOM marks that video eligible." />
            <Rule icon={<ShieldCheck className="h-4 w-4" />} tint="bg-orange-50 text-orange-600" title="Original content" body="Content must be original, follow the community guidelines, and not infringe copyright." />
            <Rule icon={<Ban className="h-4 w-4" />} tint="bg-red-50 text-red-600" title="Prohibited actions" body="Do not buy views or followers, use bots, automated viewing, fake accounts, view exchanges, or bug abuse. TAATOM may remove invalid views, reverse earnings, lock the account, hold a withdrawal, or end monetization." />
            <Rule icon={<Calendar className="h-4 w-4" />} tint="bg-blue-50 text-blue-600" title="Payout timeline" body={`This month's earnings stay pending until the Asia/Kolkata month is validated, then move to Available. The minimum withdrawal is ${inr(dashboard.minimumWithdrawal)} unless TAATOM changes it. Payouts are paid after a manual transfer. Timing depends on the bank, verification, and holidays.`} />
            <Rule icon={<Gift className="h-4 w-4" />} tint="bg-pink-50 text-pink-600" title="Consistent growth" body="The program rewards consistent original travel content: create, share, engage, grow, and earn." />
            <Rule icon={<Lock className="h-4 w-4" />} tint="bg-red-50 text-red-600" title="Account standing" body={`${dashboard.consecutiveFailMonths} failing month(s) toward a lock at ${dashboard.failMonthsToLock}. A passing month resets that streak. Locked accounts unlock after ${dashboard.qualifyingMonthsToUnlock} qualifying month, and the available balance can still be withdrawn. Under review, new earnings stop. The account must stay verified. Activation is not automatic.`} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Qualify({
  icon,
  label,
  gate,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  gate: MonetizationGate;
  detail: string;
}) {
  const ratio = gate.required > 0 ? Math.min(100, (gate.current / gate.required) * 100) : 0;
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold">{label}</p>
          <p className={`text-sm font-extrabold ${gate.met ? "text-emerald-600" : "text-blue-600"}`}>
            {count(gate.current)} / {count(gate.required)}
          </p>
        </div>
        <p className="text-sm text-slate-500">{detail}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full ${gate.met ? "bg-emerald-500" : "bg-blue-600"}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-extrabold">{value}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-500">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-zinc-700 dark:bg-zinc-950">
        <span className="text-slate-400">{icon}</span>
        <input
          className="w-full bg-transparent py-3 text-sm font-medium text-slate-900 outline-none dark:text-zinc-50"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function Rule({ icon, tint, title, body }: { icon: React.ReactNode; tint: string; title: string; body: string }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="flex gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tint}`}>{icon}</span>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm leading-5 text-slate-500">{body}</p>
        </div>
      </div>
    </section>
  );
}
