/**
 * Balance Methods
 *
 * SDK methods for balance and account queries.
 */

import { DorisioClient } from '../client';

export interface BalanceInfo {
  walletId: string;
  available: number;
  pending: number;
  total: number;
  currency: string;
}

export interface AccountBalance {
  total: number;
  available: number;
  pending: number;
  wallets: BalanceInfo[];
}

/**
 * Get user's total balance across all wallets
 */
export async function getBalance(this: DorisioClient, userId: string): Promise<AccountBalance> {
  const response = await this.request<AccountBalance>('GET', `/users/${userId}/balance`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch balance for user: ${userId}`);
  }

  const data = response.data;
  return {
    total: data.total || 0,
    available: data.available || 0,
    pending: data.pending || 0,
    wallets: (data.wallets || []).map((w: BalanceInfo) => ({
      walletId: w.walletId,
      available: w.available || 0,
      pending: w.pending || 0,
      total: (w.available || 0) + (w.pending || 0),
      currency: w.currency || 'USDC',
    })),
  };
}

/**
 * Get single wallet balance
 */
export async function getWalletBalance(
  this: DorisioClient,
  walletId: string
): Promise<BalanceInfo> {
  const response = await this.request<BalanceInfo>('GET', `/wallets/${walletId}/balance`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch wallet balance: ${walletId}`);
  }

  const data = response.data;
  return {
    walletId,
    available: data.available || 0,
    pending: data.pending || 0,
    total: (data.available || 0) + (data.pending || 0),
    currency: data.currency || 'USDC',
  };
}

/**
 * Get creator's pending payout
 */
export async function getCreatorPendingPayout(
  this: DorisioClient,
  creatorId: string
): Promise<{
  pending: number;
  nextPayoutDate?: string;
  minimumThreshold: number;
}> {
  const response = await this.request<{
    pending: number;
    nextPayoutDate?: string;
    minimumThreshold: number;
  }>('GET', `/creators/${creatorId}/payout-pending`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch pending payout for creator: ${creatorId}`);
  }

  const data = response.data;
  return {
    pending: data.pending || 0,
    nextPayoutDate: data.nextPayoutDate,
    minimumThreshold: data.minimumThreshold || 10,
  };
}

/**
 * Check if minimum payout threshold is reached
 */
export async function canPayout(this: DorisioClient, creatorId: string): Promise<boolean> {
  const response = await this.request('GET', `/creators/${creatorId}/can-payout`);

  if (!response.success || response.data === undefined) {
    throw new Error(`Failed to check payout eligibility for creator: ${creatorId}`);
  }

  return Boolean(response.data);
}

/**
 * Get account summary with balance and stats
 */
export async function getAccountSummary(this: DorisioClient): Promise<{
  userId: string;
  email: string;
  role: string;
  balance: AccountBalance;
  totalTipsSent?: number;
  totalEarnings?: number;
  lastActivityDate?: string;
}> {
  const response = await this.request<any>('GET', '/users/me/summary');

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch account summary');
  }

  const data = response.data;
  return {
    userId: data.userId,
    email: data.email,
    role: data.role || 'fan',
    balance: {
      total: data.balance?.total || 0,
      available: data.balance?.available || 0,
      pending: data.balance?.pending || 0,
      wallets: (data.balance?.wallets || []).map((w: any) => ({
        walletId: w.walletId,
        available: w.available || 0,
        pending: w.pending || 0,
        total: (w.available || 0) + (w.pending || 0),
        currency: w.currency || 'USDC',
      })),
    },
    totalTipsSent: data.totalTipsSent,
    totalEarnings: data.totalEarnings,
    lastActivityDate: data.lastActivityDate,
  };
}
