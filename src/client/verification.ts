/**
 * Verification Methods
 *
 * SDK methods for creator and wallet verification.
 */

import { Creator, Wallet } from '../types/models';
import {
  ApiVerificationStatusSchema,
  ApiWalletChallengeSchema,
} from '../types/schemas';
import { normalizeCreator, normalizeWallet } from '../utils/normalizers';
import { DorisioClient } from '../client';

export interface VerificationStatus {
  verified: boolean;
  verifiedAt?: string;
  expiresAt?: string;
}

/**
 * Verify creator identity (requires proof/admin approval).
 *
 * @param creatorId - Unique identifier of the creator
 * @returns Promise resolving to verified Creator object
 * @throws {Error} If verification request fails
 *
 * @example
 * ```ts
 * const creator = await client.verifyCreator('creator-123');
 * console.log(creator.verified);
 * ```
 */
export async function verifyCreator<TCreator = Creator>(
  this: DorisioClient,
  creatorId: string
): Promise<TCreator> {
  const response = await this.request('POST', `/creators/${creatorId}/verify`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify creator: ${creatorId}`);
  }

  return normalizeCreator(response.data) as TCreator;
}

/**
 * Request creator verification (submits documents/description for review).
 *
 * @param creatorId - Unique identifier of the creator
 * @param data - Verification submission payload including document details
 * @returns Promise resolving to updated VerificationStatus
 * @throws {Error} If submitting verification request fails
 *
 * @example
 * ```ts
 * const status = await client.requestCreatorVerification('creator-123', {
 *   documentType: 'passport',
 *   documentUrl: 'https://example.com/doc.pdf',
 * });
 * ```
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
  const response = await this.request(
    'POST',
    `/creators/${creatorId}/request-verification`,
    data
  );

  if (!response.success || !response.data) {
    throw new Error(`Failed to request verification for creator: ${creatorId}`);
  }

  const parsed = ApiVerificationStatusSchema.parse(response.data);
  return {
    verified: parsed.verified,
    verifiedAt: parsed.verifiedAt,
    expiresAt: parsed.expiresAt,
  };
}

/**
 * Get creator verification status.
 *
 * @param creatorId - Unique identifier of the creator
 * @returns Promise resolving to VerificationStatus with textual status string
 * @throws {Error} If fetching verification status fails
 *
 * @example
 * ```ts
 * const status = await client.getCreatorVerificationStatus('creator-123');
 * console.log(status.verified, status.status);
 * ```
 */
export async function getCreatorVerificationStatus(
  this: DorisioClient,
  creatorId: string
): Promise<VerificationStatus & { status: string }> {
  const response = await this.request('GET', `/creators/${creatorId}/verification-status`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch verification status for creator: ${creatorId}`);
  }

  const parsed = ApiVerificationStatusSchema.parse(response.data);
  return {
    verified: parsed.verified,
    verifiedAt: parsed.verifiedAt,
    expiresAt: parsed.expiresAt,
    status: parsed.status ?? 'unverified',
  };
}

/**
 * Verify wallet ownership via optional cryptographic proof.
 *
 * @param walletId - Unique identifier of the wallet
 * @param proof - Optional cryptographic signature proof string
 * @returns Promise resolving to verified Wallet object
 * @throws {Error} If wallet verification fails
 *
 * @example
 * ```ts
 * const wallet = await client.verifyWallet('wallet-123', 'signed_proof_hash');
 * console.log(wallet.verified);
 * ```
 */
export async function verifyWallet<TWallet = Wallet>(
  this: DorisioClient,
  walletId: string,
  proof?: string
): Promise<TWallet> {
  const response = proof
    ? await this.request('POST', `/wallets/${walletId}/verify`, { proof })
    : await this.request('POST', `/wallets/${walletId}/verify`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to verify wallet: ${walletId}`);
  }

  return normalizeWallet(response.data) as TWallet;
}

/**
 * Get wallet verification status.
 *
 * @param walletId - Unique identifier of the wallet
 * @returns Promise resolving to VerificationStatus
 * @throws {Error} If fetching verification status fails
 *
 * @example
 * ```ts
 * const status = await client.getWalletVerificationStatus('wallet-123');
 * console.log(status.verified);
 * ```
 */
export async function getWalletVerificationStatus(
  this: DorisioClient,
  walletId: string
): Promise<VerificationStatus> {
  const response = await this.request('GET', `/wallets/${walletId}/verification-status`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch verification status for wallet: ${walletId}`);
  }

  const parsed = ApiVerificationStatusSchema.parse(response.data);
  return {
    verified: parsed.verified,
    verifiedAt: parsed.verifiedAt,
    expiresAt: parsed.expiresAt,
  };
}

/**
 * Request wallet verification challenge.
 *
 * @param walletId - Unique identifier of the wallet
 * @returns Promise resolving to challenge string and expiration duration in seconds
 * @throws {Error} If requesting challenge fails
 *
 * @example
 * ```ts
 * const { challenge, expiresIn } = await client.requestWalletVerificationChallenge('wallet-123');
 * ```
 */
export async function requestWalletVerificationChallenge(
  this: DorisioClient,
  walletId: string
): Promise<{ challenge: string; expiresIn: number }> {
  const response = await this.request('POST', `/wallets/${walletId}/verification-challenge`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to request verification challenge for wallet: ${walletId}`);
  }

  const parsed = ApiWalletChallengeSchema.parse(response.data);
  return {
    challenge: parsed.challenge,
    expiresIn: parsed.expiresIn,
  };
}

/**
 * Check if transaction is verified.
 *
 * @param transactionId - Unique identifier of the transaction
 * @returns Promise resolving to boolean indicating if transaction is verified
 * @throws {Error} If checking transaction verification fails
 *
 * @example
 * ```ts
 * const verified = await client.isTransactionVerified('tx-123');
 * ```
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
