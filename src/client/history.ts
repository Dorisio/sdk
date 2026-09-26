/**
 * History Methods
 *
 * SDK methods for fetching transaction and activity history.
 */

import { TransactionHistory, TransactionStats } from '../types/models';
import {
  ApiCreatorEarningsSchema,
  ApiTransactionHistorySchema,
} from '../types/schemas';
import { filterTransactionsByDateRange, normalizeTransactionStats } from '../utils/transaction-normalizers';
import { DorisioClient } from '../client';

/**
 * Get full transaction history with filters.
 *
 * @param options - Pagination, status, and date filtering options
 * @returns Filtered transaction history envelope containing transactions, total count, page, and pageSize
 * @throws {Error} If fetching transaction history fails or API returns error response
 *
 * @example
 * ```ts
 * const history = await client.getFullTransactionHistory({
 *   page: 1,
 *   pageSize: 10,
 *   status: 'confirmed',
 * });
 * console.log(history.transactions, history.total);
 * ```
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

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/transactions${query}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch transaction history');
  }

  const parsed = ApiTransactionHistorySchema.parse(response.data);
  const history: TransactionHistory = {
    transactions: parsed.transactions.map((tx) => {
      const rawStatus = tx.stellarStatus ?? tx.status ?? 'pending';
      const status = (rawStatus === 'completed' ? 'confirmed' : rawStatus) as
        | 'pending'
        | 'confirmed'
        | 'failed';
      return {
        id: tx.id,
        fromUserId: tx.fromUserId,
        creatorId: tx.creatorId,
        amount: tx.amount,
        message: tx.message ?? null,
        status,
        stellarTxHash: tx.stellarTxHash ?? null,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    }),
    total: parsed.total,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };

  // Apply date range filter client-side if provided
  if (options?.startDate && options?.endDate) {
    const filtered = filterTransactionsByDateRange(
      history.transactions,
      options.startDate,
      options.endDate
    );
    return { ...history, transactions: filtered, total: filtered.length };
  }

  return history;
}

/**
 * Get aggregate transaction statistics.
 *
 * @param userId - Optional user ID filter
 * @returns Transaction statistics object containing summary metrics
 * @throws {Error} If fetching statistics fails
 *
 * @example
 * ```ts
 * const stats = await client.getTransactionStats('user-123');
 * console.log(stats.totalVolume, stats.totalCount);
 * ```
 */
export async function getTransactionStats(
  this: DorisioClient,
  userId?: string
): Promise<TransactionStats> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await this.request('GET', `/transactions/stats${params}`);

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch transaction statistics');
  }

  return normalizeTransactionStats(response.data);
}

/**
 * Get creator earnings summary.
 *
 * @param creatorId - Unique identifier of the creator
 * @returns Earnings summary including total earnings, pending balance, confirmed balance, and transaction count
 * @throws {Error} If fetching creator earnings fails
 *
 * @example
 * ```ts
 * const earnings = await client.getCreatorEarnings('creator-456');
 * console.log(earnings.totalEarnings, earnings.pendingBalance);
 * ```
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

  const parsed = ApiCreatorEarningsSchema.parse(response.data);
  return {
    totalEarnings: parsed.totalEarnings,
    pendingBalance: parsed.pendingBalance,
    confirmedBalance: parsed.confirmedBalance,
    transactionCount: parsed.transactionCount,
  };
}

/**
 * Export transaction history as CSV or JSON.
 *
 * @param options - Export options including format ('csv' | 'json') and optional date range
 * @returns Exported transaction history data string
 * @throws {Error} If exporting transaction history fails
 *
 * @example
 * ```ts
 * const csvData = await client.exportTransactionHistory({
 *   format: 'csv',
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31'),
 * });
 * ```
 */
export async function exportTransactionHistory(
  this: DorisioClient,
  options?: {
    format?: 'csv' | 'json';
    startDate?: Date;
    endDate?: Date;
  }
): Promise<string> {
  const format = options?.format ?? 'json';
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

  return String(response.data);
}
