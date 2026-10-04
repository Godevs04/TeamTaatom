import api from './api';
import { parseError } from '../utils/errorCodes';

export type MonetizationGate = {
  current: number;
  required: number;
  met: boolean;
};

export type MonetizationWithdrawal = {
  id: string;
  amount: number;
  method: 'bank' | 'upi';
  status: string;
  holdReason?: string;
  rejectionReason?: string;
  payoutReference?: string;
  createdAt?: string;
  processedAt?: string;
};

export type MonetizationDashboard = {
  status: string;
  activatedAt?: string | null;
  consecutiveFailMonths: number;
  qualifyingMonths: number;
  failMonthsToLock: number;
  qualifyingMonthsToUnlock: number;
  monthKey: string;
  followers: MonetizationGate;
  videos: MonetizationGate;
  monthlyViews: MonetizationGate;
  eligibleViewsProgress: MonetizationGate;
  recordedViews: number;
  eligibleViews: number;
  ratePerThousand: number;
  currency: string;
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
  policyVersion: number;
  goodStanding: boolean;
  withdrawals: MonetizationWithdrawal[];
};

const unwrap = (data: any): MonetizationDashboard => data?.dashboard || data;

export async function getCreatorMonetizationDashboard(): Promise<MonetizationDashboard> {
  try {
    const res = await api.get('/api/v1/creator-monetization/dashboard');
    return unwrap(res.data);
  } catch (error: any) {
    throw new Error(parseError(error).userMessage);
  }
}

export async function activateCreatorMonetization(): Promise<MonetizationDashboard> {
  try {
    const res = await api.post('/api/v1/creator-monetization/activate');
    return unwrap(res.data);
  } catch (error: any) {
    throw new Error(parseError(error).userMessage || error?.response?.data?.message || 'Could not activate.');
  }
}

export async function saveCreatorPayoutProfile(body: Record<string, string>): Promise<MonetizationDashboard> {
  try {
    const res = await api.put('/api/v1/creator-monetization/payout-profile', body);
    return unwrap(res.data);
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || parseError(error).userMessage);
  }
}

export async function submitCreatorVerification(): Promise<MonetizationDashboard> {
  try {
    const res = await api.post('/api/v1/creator-monetization/verification');
    return unwrap(res.data);
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || parseError(error).userMessage);
  }
}

export async function requestCreatorWithdrawal(amount: number): Promise<MonetizationDashboard> {
  try {
    const res = await api.post('/api/v1/creator-monetization/withdrawals', { amount });
    return unwrap(res.data);
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || parseError(error).userMessage);
  }
}
