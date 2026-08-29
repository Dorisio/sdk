/**
 * Transaction Methods
 *
 * SDK methods for transaction and tip operations.
 */

import { Transaction, TipRequest, TransactionHistory } from '../types/models';
import { normalizeTransaction, normalizeTransactionHistory } from '../utils/normalizers';
import { DorisioClient } from '../client';

/**
 * Create a tip transaction
 */
export async function createTip(this: DorisioClient, data: TipRequest): Promise<Transaction> {
  if (!data.creatorId) {
    throw new Error('Creator ID is required to create a tip');
  }

  if (data.amount <= 0) {
    throw new Error('Tip amount must be greater than 0');
  }

  const response = await this.request('POST', '/transactions/tip', {
    creatorId: data.creatorId,
    amount: data.amount,
    message: data.message || null,
    fromWalletId: data.fromWalletId,
    toWalletId: data.toWalletId,
  });

  if (!response.success || !response.data) {
    throw new Error('Failed to create tip');
  }

  return normalizeTransaction(response.data);
}

/**
 * Get transaction status
 */
export async function getTipStatus(
  this: DorisioClient,
  transactionId: string
): Promise<Transaction> {
  const response = await this.request('GET', `/transactions/${transactionId}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch transaction: ${transactionId}`);
  }

  return normalizeTransaction(response.data);
}

/**
 * Get transaction history for user
 */
export async function getTransactionHistory(
  this: DorisioClient,
  options?: {
    userId?: string;
    creatorId?: string;
    page?: number;
    pageSize?: number;
    status?: 'pending' | 'confirmed' | 'failed';
  }
): Promise<TransactionHistory> {
  const params = new URLSearchParams();

  if (options?.userId) params.append('userId', options.userId);
  if (options?.creatorId) params.append('creatorId', options.creatorId);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));
  if (options?.status) params.append('status', options.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/transactions${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch transaction history');
  }

  return normalizeTransactionHistory(response.data);
}

/**
 * Get user's tips sent
 */
export async function getUserTipsSent(
  this: DorisioClient,
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<TransactionHistory> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/users/${userId}/tips-sent${query}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch tips sent by user: ${userId}`);
  }

  return normalizeTransactionHistory(response.data);
}

/**
 * Get creator's tips received
 */
export async function getCreatorTipsReceived(
  this: DorisioClient,
  creatorId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<TransactionHistory> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/creators/${creatorId}/tips-received${query}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch tips received by creator: ${creatorId}`);
  }

  return normalizeTransactionHistory(response.data);
}

/**
 * Retry failed transaction
 */
export async function retryTransaction(
  this: DorisioClient,
  transactionId: string
): Promise<Transaction> {
  const response = await this.request('POST', `/transactions/${transactionId}/retry`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to retry transaction: ${transactionId}`);
  }

  return normalizeTransaction(response.data);
}
