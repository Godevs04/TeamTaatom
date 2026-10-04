"use client";

import * as React from "react";
import { toast } from "sonner";
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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

function Gate({ label, gate, detail }: { label: string; gate: MonetizationGate; detail?: string }) {
  const ratio = gate.required > 0 ? Math.min(100, (gate.current / gate.required) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-800 dark:text-zinc-100">{label}</span>
        <span className={gate.met ? "text-emerald-600" : "text-slate-600 dark:text-zinc-300"}>
          {gate.current.toLocaleString("en-IN")} / {gate.required.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
        <div className={`h-full ${gate.met ? "bg-emerald-500" : "bg-sky-600"}`} style={{ width: `${ratio}%` }} />
      </div>
      <p className="text-xs text-slate-500">{detail || (gate.met ? "Requirement met" : "Still short of this requirement")}</p>
    </div>
  );
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

  const reason = dashboard?.status === "locked"
    ? dashboard.lockReason
    : dashboard?.status === "under_review" || dashboard?.status === "terminated"
      ? dashboard.reviewReason || dashboard.lockReason
      : dashboard?.withdrawalHoldReason || "";

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 lg:pb-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">Creator Dashboard</p>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">Monetization</h1>
        <p className="text-slate-600 dark:text-zinc-400">
          View-based earnings on your TAATOM account. This is separate from Connect subscriptions.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!dashboard && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {dashboard ? (
        <>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Status</h2>
              <span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-semibold text-white">
                {STATUS_LABEL[dashboard.status] || dashboard.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">Month {dashboard.monthKey} · Asia/Kolkata. Activation is not automatic.</p>
            {reason ? <p className="text-sm text-amber-700">{reason}</p> : null}
            {dashboard.withdrawalHoldReason ? <p className="text-sm text-amber-700">{dashboard.withdrawalHoldReason}</p> : null}
            <Gate label="Followers" gate={dashboard.followers} />
            <Gate label="Videos this month" gate={dashboard.videos} />
            <Gate label="Monthly views" gate={dashboard.monthlyViews} detail="All views recorded this month" />
            <Gate
              label="Eligible views"
              gate={dashboard.eligibleViewsProgress}
              detail={dashboard.eligibleViewsProgress.met ? "These valid views meet the requirement and are used for earnings" : "Only valid views count toward the requirement and earnings"}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Earnings</h2>
            <p className="text-sm text-slate-500">
              {inr(dashboard.ratePerThousand)} per 1,000 eligible views.
              {dashboard.ratePerThousand > 0
                ? " This month stays pending until the month is validated."
                : " TAATOM has not set a rupee rate yet, so earnings stay at ₹0.00."}
              {dashboard.status === "eligible" || dashboard.status === "not_eligible" ? " Views before you activate do not earn." : ""}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="This month" value={inr(dashboard.thisMonthEarnings)} />
              <Stat label="Pending" value={inr(dashboard.pending)} />
              <Stat label="Available" value={inr(dashboard.available)} />
              <Stat label="Withdrawn" value={inr(dashboard.withdrawn)} />
            </div>
            {dashboard.canActivate ? (
              <button type="button" disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => run(activateCreatorMonetization)}>
                Activate monetization
              </button>
            ) : null}
            {!dashboard.canWithdraw && dashboard.withdrawBlockReason ? (
              <p className="text-sm text-slate-500">{dashboard.withdrawBlockReason}</p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payout and identity</h2>
            <p className="text-sm text-slate-500">Verification: {dashboard.verificationStatus}. {dashboard.verificationNote}</p>
            <label className="block text-sm">
              Legal name
              <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </label>
            <div className="flex gap-2">
              {dashboard.paymentMethods.map((item) => (
                <button key={item} type="button" className={`rounded-full px-3 py-1 text-sm ${method === item ? "bg-sky-700 text-white" : "border border-slate-200"}`} onClick={() => setMethod(item as "bank" | "upi")}>
                  {item === "bank" ? "Bank account" : "UPI"}
                </button>
              ))}
            </div>
            {method === "bank" ? (
              <>
                <Field label="Account name" value={bankAccountName} onChange={setBankAccountName} />
                <Field label="Account number" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder={dashboard.payoutProfile.bankAccountNumber || "Account number"} />
                <Field label="IFSC" value={bankIfsc} onChange={setBankIfsc} />
              </>
            ) : (
              <Field label="UPI ID" value={upiId} onChange={setUpiId} />
            )}
            {dashboard.requireTaxIdentity ? <Field label="PAN" value={taxId} onChange={setTaxId} placeholder={dashboard.payoutProfile.taxId || "PAN"} /> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className="rounded-xl border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-700" onClick={() => run(() => saveCreatorPayoutProfile({ legalName, method, bankAccountName, bankAccountNumber, bankIfsc, upiId, taxId }))}>
                Save payout details
              </button>
              <button type="button" disabled={busy} className="rounded-xl border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-700" onClick={() => run(submitCreatorVerification)}>
                Submit for verification
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Withdraw</h2>
            <Field label="Amount (INR)" value={amount} onChange={setAmount} />
            <button type="button" disabled={busy || !dashboard.canWithdraw} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => run(() => requestCreatorWithdrawal(Number(amount)))}>
              Request withdrawal
            </button>
            <p className="text-sm text-slate-500">
              Minimum {inr(dashboard.minimumWithdrawal)}. Payouts are marked paid after a manual transfer. Timing depends on the bank, verification, and holidays.
            </p>
            <ul className="space-y-2">
              {dashboard.withdrawals.map((row) => (
                <li key={row.id} className="border-t border-slate-100 pt-2 text-sm dark:border-zinc-800">
                  <span className="font-semibold">{inr(row.amount)}</span> · {row.method.toUpperCase()} · {row.status}
                  {row.payoutReference ? ` · ${row.payoutReference}` : ""}
                  {row.rejectionReason ? ` · ${row.rejectionReason}` : ""}
                  {row.holdReason ? ` · ${row.holdReason}` : ""}
                </li>
              ))}
            </ul>
          </section>

          {dashboard.notices?.length ? (
            <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold">Notices</h2>
              {dashboard.notices.map((notice, index) => (
                <p key={`${notice.at || index}`} className="text-sm text-slate-700 dark:text-zinc-300">{notice.message}</p>
              ))}
            </section>
          ) : null}

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Program rules</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{dashboard.policyText}</p>
            <p className="text-sm text-slate-500">
              {dashboard.consecutiveFailMonths} failing month(s) toward a lock at {dashboard.failMonthsToLock}. A locked account unlocks after {dashboard.qualifyingMonthsToUnlock} qualifying month.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-slate-700 dark:text-zinc-200">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
