/**
 * History Methods
 *
 * SDK methods for fetching transaction and activity history.
 */

import { TransactionHistory, TransactionStats } from '../types/models';
import {
  normalizeTransactionHistory,
  calculateTransactionStats,
  filterTransactionsByStatus,
  filterTransactionsByDateRange,
  groupTransactionsByCreator,
} from '../utils/transaction-normalizers';
import { DorisioClient } from '../client';

/**
 * Get full transaction history with filters
 */
export async function getFullTransactionHistory(
  this: DorisioClient,
  options?: {
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
    status?: 'pending' | 'confirmed' | 'failed';
  }
): Promise<TransactionHistory> {
  const params = new URLSearchParams();

  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));
  if (options?.status) params.append('status', options.status);

  // Date filters are applied client-side for flexibility
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/transactions${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch transaction history');
  }

  let history = normalizeTransactionHistory(response.data);

  // Apply date range filter if provided
  if (options?.startDate && options?.endDate) {
    const filtered = filterTransactionsByDateRange(
      history.transactions,
      options.startDate,
      options.endDate
    );
    history.transactions = filtered;
    history.total = filtered.length;
  }

  return history;
}

/**
 * Get transaction statistics
 */
export async function getTransactionStats(
  this: DorisioClient,
  userId?: string
): Promise<TransactionStats> {
  const params = userId ? `?userId=${userId}` : '';
  const response = await this.request('GET', `/transactions/stats${params}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch transaction statistics');
  }

  return {
    totalTransactions: response.data.totalTransactions || 0,
    totalAmount: response.data.totalAmount || 0,
    averageAmount: response.data.averageAmount || 0,
    lastTransactionDate: response.data.lastTransactionDate || null,
  };
}

/**
 * Get creator earnings summary
 */
export async function getCreatorEarnings(
  this: DorisioClient,
  creatorId: string
): Promise<{
  totalEarnings: number;
  pendingBalance: number;
  confirmedBalance: number;
  transactionCount: number;
}> {
  const response = await this.request('GET', `/creators/${creatorId}/earnings`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch earnings for creator: ${creatorId}`);
  }

  return {
    totalEarnings: response.data.totalEarnings || 0,
    pendingBalance: response.data.pendingBalance || 0,
    confirmedBalance: response.data.confirmedBalance || 0,
    transactionCount: response.data.transactionCount || 0,
  };
}

/**
 * Export transaction history (CSV or JSON)
 */
export async function exportTransactionHistory(
  this: DorisioClient,
  options?: {
    format?: 'csv' | 'json';
    startDate?: Date;
    endDate?: Date;
  }
): Promise<string> {
  const format = options?.format || 'json';
  const params = new URLSearchParams();
  params.append('format', format);

  if (options?.startDate) {
    params.append('startDate', options.startDate.toISOString());
  }
  if (options?.endDate) {
    params.append('endDate', options.endDate.toISOString());
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/transactions/export${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to export transaction history');
  }

  return response.data as string;
}
