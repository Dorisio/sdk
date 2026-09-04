/**
 * Transaction Methods
 *
 * SDK methods for transaction and tip operations.
 * Aligned with backend payment routes from /api/v1/transactions/*
 */

import { Transaction, TransactionHistory } from '../types/models';
import { normalizeTransaction, normalizeTransactionHistory } from '../utils/normalizers';
import { DorisioClient } from '../client';

export interface CreateTipRequest {
  creatorId: string;
  amount: number;
  message?: string;
}

export interface BuildTransactionRequest {
  senderPublicKey: string;
  creatorPublicKey: string;
  amount: string;
  assetCode?: string;
  assetIssuer?: string;
}

export interface SubmitTransactionRequest {
  transactionEnvelope: string;
}

export interface BuildTransactionResponse {
  transactionEnvelope: string;
  tipId: string;
  fee: number;
}

export interface SubmitTransactionResponse {
  tipId: string;
  transactionHash: string;
  status: string;
}

/**
 * Create a tip transaction (initial step before payment)
 * POST /api/v1/transactions/tip
 *
 * Validates:
 * - Amount is positive
 * - Creator exists and is public and verified
 * - Sender has a verified wallet
 */
export async function createTip(this: DorisioClient, data: CreateTipRequest): Promise<Transaction> {
  if (!data.creatorId) {
    throw new Error('Creator ID is required to create a tip');
  }

  if (data.amount <= 0) {
    throw new Error('Tip amount must be greater than 0');
  }

  const response = await this.request('POST', '/api/v1/transactions/tip', {
    creatorId: data.creatorId,
    amount: data.amount,
    message: data.message || undefined,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to create tip');
  }

  return normalizeTransaction(response.data);
}

/**
 * Get transaction status
 * GET /api/v1/transactions/:id
 */
export async function getTipStatus(
  this: DorisioClient,
  transactionId: string
): Promise<Transaction> {
  const response = await this.request('GET', `/api/v1/transactions/${transactionId}`);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || `Failed to fetch transaction: ${transactionId}`);
  }

  return normalizeTransaction(response.data);
}

/**
 * Get user's tip history (tips they sent)
 * GET /api/v1/transactions/history
 */
export async function getTransactionHistory(
  this: DorisioClient,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<TransactionHistory> {
  const params = new URLSearchParams();

  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await this.request('GET', `/api/v1/transactions/history${query}`);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch transaction history');
  }

  return normalizeTransactionHistory(response.data);
}

/**
 * Get tips received by a creator
 * GET /api/v1/transactions/creator/:creatorId
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
  const response = await this.request('GET', `/api/v1/transactions/creator/${creatorId}${query}`);

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || `Failed to fetch tips received by creator: ${creatorId}`
    );
  }

  return normalizeTransactionHistory(response.data);
}

/**
 * Build a Stellar payment transaction for frontend signing
 * POST /api/v1/transactions/:id/build
 *
 * Returns unsigned transaction that user signs with Freighter wallet
 */
export async function buildPaymentTransaction(
  this: DorisioClient,
  tipId: string,
  data: BuildTransactionRequest
): Promise<BuildTransactionResponse> {
  const response = await this.request('POST', `/api/v1/transactions/${tipId}/build`, {
    senderPublicKey: data.senderPublicKey,
    creatorPublicKey: data.creatorPublicKey,
    amount: data.amount,
    assetCode: data.assetCode,
    assetIssuer: data.assetIssuer,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to build payment transaction');
  }

  return response.data as BuildTransactionResponse;
}

/**
 * Submit a signed payment transaction to Stellar network
 * POST /api/v1/transactions/:id/submit
 *
 * Frontend must sign the transaction with user's wallet before calling this
 */
export async function submitPaymentTransaction(
  this: DorisioClient,
  tipId: string,
  data: SubmitTransactionRequest
): Promise<SubmitTransactionResponse> {
  if (!data.transactionEnvelope) {
    throw new Error('Signed transaction envelope is required');
  }

  const response = await this.request('POST', `/api/v1/transactions/${tipId}/submit`, {
    transactionEnvelope: data.transactionEnvelope,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to submit payment transaction');
  }

  return response.data as SubmitTransactionResponse;
}

/**
 * Check transaction confirmation status
 * GET /api/v1/transactions/:id/confirm
 *
 * Polls Horizon to verify if transaction has been confirmed on the network
 */
export async function checkTransactionConfirmation(
  this: DorisioClient,
  tipId: string
): Promise<Transaction> {
  const response = await this.request('GET', `/api/v1/transactions/${tipId}/confirm`);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to check transaction confirmation');
  }

  return normalizeTransaction(response.data);
}

/**
 * Update tip status (typically used by backend confirmation service)
 * PATCH /api/v1/transactions/:id/status
 */
export async function updateTipStatus(
  this: DorisioClient,
  tipId: string,
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
): Promise<Transaction> {
  const response = await this.request('PATCH', `/api/v1/transactions/${tipId}/status`, {
    status,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to update tip status');
  }

  return normalizeTransaction(response.data);
}
