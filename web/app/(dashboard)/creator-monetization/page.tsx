"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Ban,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
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
  lookupCreatorIfsc,
  requestCreatorWithdrawal,
  saveCreatorPayoutProfile,
  submitCreatorVerification,
  type IfscBank,
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

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/;

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 18);
const ifscText = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
const panText = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

function payoutProblems(input: {
  legalName: string;
  method: "bank" | "upi";
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  taxId: string;
  requireTax: boolean;
  keepAccount: boolean;
  keepTax: boolean;
  bankReady: boolean;
}) {
  const problems: Record<string, string> = {};
  const legalName = input.legalName.trim();
  if (legalName.length < 2 || !/[A-Za-z]/.test(legalName)) problems.legalName = "Enter the legal name on the account.";
  if (input.method === "bank") {
    const accountName = input.bankAccountName.trim();
    if (accountName.length < 2 || !/[A-Za-z]/.test(accountName)) problems.bankAccountName = "Enter the name as it appears on the bank account.";
    const accountNumber = input.bankAccountNumber.trim();
    if (!accountNumber && input.keepAccount) {
      // The saved number stays on the server when this field is left blank.
    } else if (!/^\d{9,18}$/.test(accountNumber)) {
      problems.bankAccountNumber = "Use 9 to 18 digits from the passbook. Letters are not allowed.";
    }
    if (!IFSC_PATTERN.test(input.bankIfsc)) problems.bankIfsc = "Enter an 11-character IFSC, such as HDFC0001234.";
    else if (!input.bankReady) problems.bankIfsc = "Wait until the bank and branch appear for this IFSC.";
  } else if (!UPI_PATTERN.test(input.upiId.trim())) {
    problems.upiId = "Enter a UPI ID such as name@okbank.";
  }
  const taxId = input.taxId.trim();
  if (input.requireTax && !( !taxId && input.keepTax ) && !PAN_PATTERN.test(taxId)) {
    problems.taxId = "Enter a PAN such as ABCDE1234F.";
  }
  return problems;
}

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
  if (status === "verified") return { label: "Verified", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
  if (status === "pending") return { label: "In review", className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
  if (status === "rejected") return { label: "Rejected", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" };
  return { label: "Not verified", className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
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
  const [problems, setProblems] = React.useState<Record<string, string>>({});
  const [ifscBank, setIfscBank] = React.useState<IfscBank | null>(null);
  const [ifscNote, setIfscNote] = React.useState("");

  const apply = (next: MonetizationDashboard) => {
    setDashboard(next);
    setLegalName(next.payoutProfile.legalName || "");
    setMethod(next.payoutProfile.method === "upi" ? "upi" : "bank");
    setBankAccountName(next.payoutProfile.bankAccountName || "");
    setBankIfsc(next.payoutProfile.bankIfsc || "");
    setUpiId(next.payoutProfile.upiId || "");
    setAmount((current) => current || String(next.minimumWithdrawal || 1000));
    if (next.payoutProfile.bankName && next.payoutProfile.bankIfsc) {
      setIfscBank({
        ifsc: next.payoutProfile.bankIfsc,
        bank: next.payoutProfile.bankName,
        branch: next.payoutProfile.bankBranch || "",
        address: "",
        city: next.payoutProfile.bankCity || "",
        state: next.payoutProfile.bankState || "",
      });
      setIfscNote("");
    }
  };

  React.useEffect(() => {
    getCreatorMonetizationDashboard()
      .then(apply)
      .catch(() => setError("Could not load Creator Dashboard."));
  }, []);

  React.useEffect(() => {
    const code = ifscText(bankIfsc);
    if (!IFSC_PATTERN.test(code)) {
      setIfscBank(null);
      setIfscNote("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIfscNote("Checking this IFSC…");
      lookupCreatorIfsc(code)
        .then((bank) => {
          if (cancelled) return;
          setIfscBank(bank);
          setIfscNote("");
          setProblems((current) => {
            const next = { ...current };
            delete next.bankIfsc;
            return next;
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setIfscBank(null);
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setIfscNote(message || "No bank was found for this IFSC code.");
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bankIfsc]);

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
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-24 text-slate-900 lg:pb-10 dark:text-zinc-50">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Creator Dashboard</p>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Monetization</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
            View-based earnings on your own account. This stays separate from Connect subscriptions.
          </p>
        </div>
        <a
          href="#program-rules"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <HelpCircle className="h-4 w-4" />
          Program rules
        </a>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!dashboard && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {dashboard ? (
        <>
          <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-5 shadow-sm dark:border-zinc-800 dark:from-sky-950 dark:via-zinc-900 dark:to-emerald-950 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-sky-900">
                  <CircleDollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Status</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${good ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {STATUS_LABEL[dashboard.status] || dashboard.status}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">{copy.title}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-400">{copy.body}</p>
                  {reason ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{reason}</p> : null}
                </div>
              </div>
              <Crown className="hidden h-12 w-12 text-slate-300 md:block dark:text-zinc-600" />
            </div>
            {dashboard.canActivate ? (
              <button
                type="button"
                disabled={busy}
                className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => run(activateCreatorMonetization)}
              >
                Activate monetization
              </button>
            ) : null}
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold">Progress to qualify</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Month {dashboard.monthKey} in Asia/Kolkata. Eligible views are the gate that pays.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Qualify icon={<UserRound className="h-4 w-4" />} label="Followers" gate={dashboard.followers} detail={`Reach ${count(dashboard.followers.required)} followers`} />
                  <Qualify icon={<Play className="h-4 w-4" />} label="Videos this month" gate={dashboard.videos} detail={`Post at least ${count(dashboard.videos.required)} eligible videos`} />
                  <Qualify icon={<BarChart3 className="h-4 w-4" />} label="Monthly views" gate={dashboard.monthlyViews} detail={`Get ${count(dashboard.monthlyViews.required)} views recorded this month`} />
                  <Qualify icon={<Eye className="h-4 w-4" />} label="Eligible views" gate={dashboard.eligibleViewsProgress} detail="Only these valid views count toward the requirement and earnings" />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold">Earnings</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total earnings</p>
                      <p className="text-3xl font-semibold tracking-tight">{inr(total)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="Available" value={inr(dashboard.available)} />
                    <Stat label="Pending" value={inr(dashboard.pending)} />
                    <Stat label="Withdrawn" value={inr(dashboard.withdrawn)} />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  This month {inr(dashboard.thisMonthEarnings)} at {inr(dashboard.ratePerThousand)} per 1,000 eligible views.
                  {dashboard.ratePerThousand > 0 ? " Pending moves to Available after the Asia/Kolkata month is validated." : " TAATOM has not set a rupee rate yet, so earnings stay at ₹0.00."}
                  {dashboard.status === "eligible" || dashboard.status === "not_eligible" ? " Views before you activate do not earn." : ""}
                </p>
                <p className="mt-2 flex gap-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                  <Info className="mt-1 h-4 w-4 shrink-0" />
                  Payouts are processed after verification and may take 3–7 business days.
                </p>
              </section>

              <section id="payout-history" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold">Payout history</h2>
                {dashboard.withdrawals.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No withdrawals yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-4 font-semibold">Amount</th>
                          <th className="py-2 pr-4 font-semibold">Method</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          <th className="py-2 font-semibold">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.withdrawals.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100 dark:border-zinc-800">
                            <td className="py-3 pr-4 font-semibold">{inr(row.amount)}</td>
                            <td className="py-3 pr-4">{row.method === "upi" ? "UPI" : "Bank"}</td>
                            <td className="py-3 pr-4 capitalize">{row.status.replace(/_/g, " ")}</td>
                            <td className="py-3 text-slate-500">{row.payoutReference || row.rejectionReason || row.holdReason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Payout and identity</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                      Verify your identity and add payout details to receive earnings.
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${verify.className}`}>{verify.label}</span>
                </div>
                {dashboard.verificationNote ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{dashboard.verificationNote}</p> : null}
                {dashboard.withdrawalHoldReason ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{dashboard.withdrawalHoldReason}</p> : null}

                <h3 className="mt-5 text-sm font-semibold">Payout account</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Add your bank or UPI details to receive payments.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
                  {(["bank", "upi"] as const).filter((item) => dashboard.paymentMethods.includes(item)).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`rounded-lg py-2 text-sm font-semibold ${method === item ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-white" : "text-slate-500"}`}
                      onClick={() => setMethod(item)}
                    >
                      {item === "bank" ? "Bank account" : "UPI"}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3">
                  <Field icon={<UserRound className="h-4 w-4" />} label="Legal name" value={legalName} onChange={setLegalName} placeholder="Enter your legal name" error={problems.legalName} />
                  {method === "bank" ? (
                    <>
                      <Field icon={<CreditCard className="h-4 w-4" />} label="Account name" value={bankAccountName} onChange={setBankAccountName} placeholder="As per bank records" error={problems.bankAccountName} />
                      <Field icon={<Hash className="h-4 w-4" />} label="Account number" value={bankAccountNumber} onChange={(value) => {
                        if (/[A-Za-z]/.test(value)) setProblems((current) => ({ ...current, bankAccountNumber: "Use 9 to 18 digits from the passbook. Letters are not allowed." }));
                        else setProblems((current) => { const next = { ...current }; delete next.bankAccountNumber; return next; });
                        setBankAccountNumber(digitsOnly(value));
                      }} placeholder={dashboard.payoutProfile.bankAccountNumber || "9 to 18 digits"} inputMode="numeric" error={problems.bankAccountNumber} />
                      <Field icon={<Building2 className="h-4 w-4" />} label="IFSC" value={bankIfsc} onChange={(value) => setBankIfsc(ifscText(value))} placeholder="HDFC0001234" error={problems.bankIfsc || (bankIfsc && !IFSC_PATTERN.test(ifscText(bankIfsc)) ? "Enter an 11-character IFSC, such as HDFC0001234." : "") || (ifscNote && ifscNote !== "Checking this IFSC…" && !ifscBank ? ifscNote : "")} />
                      {ifscBank && ifscBank.ifsc === ifscText(bankIfsc) ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                          <p className="font-semibold">{ifscBank.bank}</p>
                          {ifscBank.branch ? <p className="mt-0.5">{ifscBank.branch}</p> : null}
                          {ifscBank.address ? <p className="mt-2 break-words">{ifscBank.address}</p> : null}
                          <p className="mt-1">
                            {[ifscBank.city, ifscBank.state].filter(Boolean).join(", ")}
                            {ifscBank.pin ? ` ${ifscBank.pin}` : ""}
                          </p>
                        </div>
                      ) : ifscNote === "Checking this IFSC…" ? (
                        <p className="text-sm text-slate-500">{ifscNote}</p>
                      ) : null}
                    </>
                  ) : (
                    <Field icon={<Hash className="h-4 w-4" />} label="UPI ID" value={upiId} onChange={setUpiId} placeholder="name@bank" error={problems.upiId} />
                  )}
                  {dashboard.requireTaxIdentity ? (
                    <Field icon={<CreditCard className="h-4 w-4" />} label="PAN" value={taxId} onChange={(value) => setTaxId(panText(value))} placeholder={dashboard.payoutProfile.taxId || "ABCDE1234F"} error={problems.taxId || (taxId && !/[A-Z]/.test(panText(taxId)) ? "PAN looks like ABCDE1234F, not only numbers." : "")} />
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => {
                      const next = payoutProblems({
                        legalName,
                        method,
                        bankAccountName,
                        bankAccountNumber,
                        bankIfsc: ifscText(bankIfsc),
                        upiId,
                        taxId: panText(taxId),
                        requireTax: dashboard.requireTaxIdentity,
                        keepAccount: !!dashboard.payoutProfile.hasBankAccount && !bankAccountNumber,
                        keepTax: !!dashboard.payoutProfile.hasTaxId && !taxId,
                        bankReady: !!ifscBank && ifscBank.ifsc === ifscText(bankIfsc),
                      });
                      setProblems(next);
                      const first = Object.values(next)[0];
                      if (first) {
                        toast.error(first);
                        return;
                      }
                      run(() => saveCreatorPayoutProfile({ legalName, method, bankAccountName, bankAccountNumber, bankIfsc: ifscText(bankIfsc), upiId, taxId: panText(taxId) }));
                    }}
                  >
                    Save payout details
                  </button>
                  {dashboard.verificationStatus !== "verified" ? (
                    <button type="button" disabled={busy} className="rounded-xl border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 disabled:opacity-50" onClick={() => run(submitCreatorVerification)}>
                      Submit for verification
                    </button>
                  ) : null}
                  <a href="#payout-history" className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200">
                    View payout history
                  </a>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-semibold">Withdraw</h2>
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-600 dark:text-zinc-300">
                  Amount (INR)
                  <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-zinc-700">
                    <span className="text-slate-400">₹</span>
                    <input className="w-full bg-transparent py-2.5 text-base font-semibold outline-none" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy || !dashboard.canWithdraw}
                  className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold disabled:cursor-not-allowed ${dashboard.canWithdraw ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400 dark:bg-zinc-800"}`}
                  onClick={() => run(() => requestCreatorWithdrawal(Number(String(amount).replace(/,/g, ""))))}
                >
                  Request withdrawal
                </button>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                  {dashboard.withdrawBlockReason
                    || `Minimum withdrawal amount is ${inr(dashboard.minimumWithdrawal).replace(/\.00$/, "")}. Payouts are processed via bank transfer and may take 3–7 business days.`}
                </p>
              </section>

              {dashboard.notices?.length ? (
                <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/40">
                  <h2 className="text-lg font-semibold">Notices</h2>
                  <div className="mt-3 space-y-2">
                    {dashboard.notices.map((notice, index) => (
                      <p key={`${notice.at || index}`} className="text-sm leading-6">{notice.message}</p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <section id="program-rules">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Program rules</h2>
                <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
                  A view earns only when it comes from a logged-in TAATOM account that meets our eligibility criteria.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Rule icon={<Eye className="h-4 w-4" />} tint="bg-emerald-50 text-emerald-600" title="Eligible views" body="A view counts only if it comes from a logged-in TAATOM account that is not the video owner, is verified, watched at least one second, and has not already counted for that video. Logged-out traffic, repeats, and your own views do not earn." />
              <Rule icon={<Play className="h-4 w-4" />} tint="bg-violet-50 text-violet-600" title="Eligible content" body="Your own shorts and long videos that are active and not hidden, archived, flagged, or removed are eligible. Photos do not earn. YouTube imports do not earn unless TAATOM marks that video eligible." />
              <Rule icon={<ShieldCheck className="h-4 w-4" />} tint="bg-orange-50 text-orange-600" title="Original content" body="Content must be original, follow the community guidelines, and not infringe copyright." />
              <Rule icon={<Ban className="h-4 w-4" />} tint="bg-red-50 text-red-600" title="Prohibited actions" body="Do not buy views or followers, use bots, automated viewing, fake accounts, view exchanges, or bug abuse. TAATOM may remove invalid views, reverse earnings, lock the account, hold a withdrawal, or end monetization." />
              <Rule icon={<Calendar className="h-4 w-4" />} tint="bg-blue-50 text-blue-600" title="Payout timeline" body={`This month's earnings stay pending until the Asia/Kolkata month is validated, then move to Available. The minimum withdrawal is ${inr(dashboard.minimumWithdrawal)} unless TAATOM changes it. Payouts are paid after a manual transfer. Timing depends on the bank, verification, and holidays.`} />
              <Rule icon={<Gift className="h-4 w-4" />} tint="bg-pink-50 text-pink-600" title="Consistent growth" body="The program rewards consistent original travel content: create, share, engage, grow, and earn." />
              <Rule icon={<Lock className="h-4 w-4" />} tint="bg-red-50 text-red-600" title="Account standing" body={`${dashboard.consecutiveFailMonths} failing month(s) toward a lock at ${dashboard.failMonthsToLock}. A passing month resets that streak. Locked accounts unlock after ${dashboard.qualifyingMonthsToUnlock} qualifying month, and the available balance can still be withdrawn. Under review, new earnings stop. The account must stay verified. Activation is not automatic.`} />
            </div>
          </section>
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
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-zinc-900">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{label}</p>
            <p className={`text-sm font-semibold ${gate.met ? "text-emerald-600" : "text-blue-600"}`}>
              {count(gate.current)} / {count(gate.required)}
            </p>
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{detail}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full ${gate.met ? "bg-emerald-500" : "bg-blue-600"}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-zinc-800">
      <p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  error,
  inputMode,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block text-sm font-medium text-slate-600 dark:text-zinc-300">
      {label}
      <span className={`mt-1 flex items-center gap-2 rounded-xl border px-3 dark:bg-zinc-950 ${error ? "border-red-400" : "border-slate-200 dark:border-zinc-700"}`}>
        <span className="text-slate-400">{icon}</span>
        <input
          className="w-full bg-transparent py-2.5 text-sm font-medium text-slate-900 outline-none dark:text-zinc-50"
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function Rule({ icon, tint, title, body }: { icon: React.ReactNode; tint: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-400">{body}</p>
        </div>
      </div>
    </article>
  );
}
