/**
 * Wallet Methods
 *
 * SDK methods for wallet operations.
 */

import { Wallet, CreateWalletRequest, UpdateWalletRequest } from '../types/models';
import { normalizeWallet, normalizeWallets } from '../utils/normalizers';
import { DorisioClient } from '../client';

/**
 * Connect a wallet to user account.
 *
 * @param data - Wallet creation details (publicKey, name, etc.)
 * @returns Promise resolving to connected Wallet object
 * @throws Error if connection fails
 * @example
 * ```ts
 * const wallet = await client.connectWallet({ publicKey: 'G...', name: 'Primary Wallet' });
 * ```
 */
export async function connectWallet<TWallet = Wallet>(
  this: DorisioClient,
  data: CreateWalletRequest
): Promise<TWallet> {
  const response = await this.request('POST', '/wallets', data);

  if (!response.success || !response.data) {
    throw new Error('Failed to connect wallet');
  }

  return normalizeWallet(response.data) as TWallet;
}

/**
 * Disconnect a wallet from user account.
 *
 * @param walletId - ID of wallet to disconnect
 * @throws Error if disconnection fails
 */
export async function disconnectWallet(this: DorisioClient, walletId: string): Promise<void> {
  const response = await this.request('DELETE', `/wallets/${walletId}`);

  if (!response.success) {
    throw new Error(`Failed to disconnect wallet: ${walletId}`);
  }
}

/**
 * Get all wallets belonging to a user.
 *
 * @param userId - Unique user ID
 * @returns Promise resolving to array of Wallet objects
 * @throws Error if wallet list fetch fails
 * @example
 * ```ts
 * const wallets = await client.getWallets('user_123');
 * ```
 */
export async function getWallets<TWallet = Wallet>(
  this: DorisioClient,
  userId: string
): Promise<TWallet[]> {
  const response = await this.request('GET', `/users/${userId}/wallets`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch wallets for user: ${userId}`);
  }

  return normalizeWallets(Array.isArray(response.data) ? response.data : []) as TWallet[];
}

/**
 * Get single wallet by ID.
 *
 * @param walletId - Unique wallet ID
 * @returns Promise resolving to Wallet object
 * @throws Error if wallet fetch fails or wallet not found
 * @example
 * ```ts
 * const wallet = await client.getWallet('wallet_123');
 * ```
 */
export async function getWallet<TWallet = Wallet>(
  this: DorisioClient,
  walletId: string
): Promise<TWallet> {
  const response = await this.request('GET', `/wallets/${walletId}`);

  if (!response.success || !response.data) {
    throw new Error(`Failed to fetch wallet: ${walletId}`);
  }

  return normalizeWallet(response.data) as TWallet;
}

/**
 * Update wallet details.
 *
 * @param walletId - Wallet ID to update
 * @param data - Update details (e.g. name, status)
 * @returns Promise resolving to updated Wallet object
 * @throws Error if update fails
 */
export async function updateWallet<TWallet = Wallet>(
  this: DorisioClient,
  walletId: string,
  data: UpdateWalletRequest
): Promise<TWallet> {
  const response = await this.request('PATCH', `/wallets/${walletId}`, data);

  if (!response.success || !response.data) {
    throw new Error(`Failed to update wallet: ${walletId}`);
  }

  return normalizeWallet(response.data) as TWallet;
}

/**
 * Verify wallet ownership (for Stellar wallets).
 *
 * @param walletId - Wallet ID to verify
 * @param proof - Optional signed challenge proof string
 * @returns Promise resolving to verified Wallet object
 * @throws Error if verification fails
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
 * Get single wallet balance numeric value.
 *
 * @param walletId - Wallet ID
 * @returns Promise resolving to balance number
 * @throws Error if balance query fails
 * @example
 * ```ts
 * const balance = await client.getBalance('wallet_123');
 * ```
 */
export async function getBalance(this: DorisioClient, walletId: string): Promise<number> {
  const response = await this.request('GET', `/wallets/${walletId}/balance`);

  if (!response.success || response.data === undefined) {
    throw new Error(`Failed to fetch wallet balance: ${walletId}`);
  }

  return Number(response.data);
}
