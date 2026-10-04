import { api } from "./axios";

export type MonetizationGate = {
  current: number;
  required: number;
  met: boolean;
};

export type MonetizationWithdrawal = {
  id: string;
  amount: number;
  method: "bank" | "upi";
  status: string;
  holdReason?: string;
  rejectionReason?: string;
  payoutReference?: string;
  createdAt?: string;
};

export type MonetizationDashboard = {
  status: string;
  monthKey: string;
  followers: MonetizationGate;
  videos: MonetizationGate;
  monthlyViews: MonetizationGate;
  eligibleViewsProgress: MonetizationGate;
  recordedViews: number;
  eligibleViews: number;
  ratePerThousand: number;
  thisMonthEarnings: number;
  pending: number;
  available: number;
  withdrawn: number;
  minimumWithdrawal: number;
  lockReason: string;
  reviewReason: string;
  withdrawalHold: boolean;
  withdrawalHoldReason: string;
  verificationStatus: string;
  verificationNote: string;
  payoutProfile: {
    legalName: string;
    method: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    upiId: string;
    taxId: string;
    bankName?: string;
    bankBranch?: string;
    bankCity?: string;
    bankState?: string;
    hasBankAccount?: boolean;
    hasTaxId?: boolean;
  };
  paymentMethods: string[];
  requireTaxIdentity: boolean;
  canActivate: boolean;
  canWithdraw: boolean;
  withdrawBlockReason: string;
  notices: Array<{ message: string; at?: string }>;
  policyText: string;
  consecutiveFailMonths: number;
  qualifyingMonths: number;
  failMonthsToLock: number;
  qualifyingMonthsToUnlock: number;
  withdrawals: MonetizationWithdrawal[];
};

function messageFrom(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } };
  return err.response?.data?.message || fallback;
}

export async function getCreatorMonetizationDashboard() {
  const res = await api.get("/creator-monetization/dashboard");
  return res.data.dashboard as MonetizationDashboard;
}

export async function activateCreatorMonetization() {
  try {
    const res = await api.post("/creator-monetization/activate");
    return res.data.dashboard as MonetizationDashboard;
  } catch (error) {
    throw new Error(messageFrom(error, "Could not activate monetization."));
  }
}

export type IfscBank = {
  ifsc: string;
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  pin?: string;
};

export async function lookupCreatorIfsc(code: string) {
  const res = await api.get(`/creator-monetization/ifsc/${encodeURIComponent(code)}`);
  return res.data.bank as IfscBank;
}

export async function saveCreatorPayoutProfile(body: Record<string, string>) {
  try {
    const res = await api.put("/creator-monetization/payout-profile", body);
    return res.data.dashboard as MonetizationDashboard;
  } catch (error) {
    throw new Error(messageFrom(error, "Could not save payout details."));
  }
}

export async function submitCreatorVerification() {
  try {
    const res = await api.post("/creator-monetization/verification");
    return res.data.dashboard as MonetizationDashboard;
  } catch (error) {
    throw new Error(messageFrom(error, "Could not submit verification."));
  }
}

export async function requestCreatorWithdrawal(amount: number) {
  try {
    const res = await api.post("/creator-monetization/withdrawals", { amount });
    return res.data.dashboard as MonetizationDashboard;
  } catch (error) {
    throw new Error(messageFrom(error, "Could not request the withdrawal."));
  }
}
