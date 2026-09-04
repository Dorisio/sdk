/**
 * Verification Methods
 *
 * SDK methods for creator and wallet verification.
 */

import { Creator, Wallet } from '../types/models';
import { normalizeCreator, normalizeWallet } from '../utils/normalizers';
import { DorisioClient } from '../client';

export interface VerificationStatus {
  verified: boolean;
  verifiedAt?: string;
  expiresAt?: string;
}

/**
 * Verify creator identity (requires proof/admin approval)
 */
export async function verifyCreator(this: DorisioClient, creatorId: string): Promise<Creator> {
  const response = await this.request('POST', `/creators/${creatorId}/verify`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify creator: ${creatorId}`);
  }

  return normalizeCreator(response.data);
}

/**
 * Request creator verification (submits for review)
 */
export async function requestCreatorVerification(
  this: DorisioClient,
  creatorId: string,
  data: {
    documentType: string;
    documentUrl?: string;
    description?: string;
  }
): Promise<VerificationStatus> {
  const response = await this.request<any>(
    'POST',
    `/creators/${creatorId}/request-verification`,
    data
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to request verification for creator: ${creatorId}`);
  }

  const d = response.data;
  return {
    verified: d.verified || false,
    verifiedAt: d.verifiedAt,
    expiresAt: d.expiresAt,
  };
}

/**
 * Get creator verification status
 */
export async function getCreatorVerificationStatus(
  this: DorisioClient,
  creatorId: string
): Promise<VerificationStatus & { status: string }> {
  const response = await this.request<any>('GET', `/creators/${creatorId}/verification-status`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch verification status for creator: ${creatorId}`);
  }

  const d = response.data;
  return {
    verified: d.verified || false,
    verifiedAt: d.verifiedAt,
    expiresAt: d.expiresAt,
    status: d.status || 'unverified',
  };
}

/**
 * Verify wallet ownership (challenge/response)
 */
export async function verifyWallet(
  this: DorisioClient,
  walletId: string,
  proof: string
): Promise<Wallet> {
  const response = await this.request('POST', `/wallets/${walletId}/verify`, { proof });

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify wallet: ${walletId}`);
  }

  return normalizeWallet(response.data);
}

/**
 * Get wallet verification status
 */
export async function getWalletVerificationStatus(
  this: DorisioClient,
  walletId: string
): Promise<VerificationStatus> {
  const response = await this.request<any>('GET', `/wallets/${walletId}/verification-status`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch verification status for wallet: ${walletId}`);
  }

  const d = response.data;
  return {
    verified: d.verified || false,
    verifiedAt: d.verifiedAt,
    expiresAt: d.expiresAt,
  };
}

/**
 * Request wallet verification challenge
 */
export async function requestWalletVerificationChallenge(
  this: DorisioClient,
  walletId: string
): Promise<{ challenge: string; expiresIn: number }> {
  const response = await this.request<any>('POST', `/wallets/${walletId}/verification-challenge`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to request verification challenge for wallet: ${walletId}`);
  }

  const d = response.data;
  return {
    challenge: d.challenge,
    expiresIn: d.expiresIn || 300,
  };
}

/**
 * Check if transaction requires verification
 */
export async function isTransactionVerified(
  this: DorisioClient,
  transactionId: string
): Promise<boolean> {
  const response = await this.request('GET', `/transactions/${transactionId}/verified`);

  if (!response.success || response.data === undefined) {
    throw new Error(`Failed to check verification status for transaction: ${transactionId}`);
  }

  return Boolean(response.data);
}
