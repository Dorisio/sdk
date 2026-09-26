/**
 * DorisioClient
 *
 * Main client for interacting with Dorisio backend API.
 * Handles authentication, request/response handling, and error management.
 * Supports sandbox/mock mode for offline testing without network calls.
 */

import { HttpClient, RequestOptions, type HttpClientMode } from './http/http-client';
import { getConfig } from './config';
import { ApiResponse } from './types/api';
import { Creator, CreatorProfile, Transaction, TransactionHistory, TransactionStats, User, Wallet } from './types/models';
import { BalanceInfo, AccountBalance } from './client/balance';
import { SessionInfo } from './client/auth';
import { VerificationStatus } from './client/verification';
import {
  BuildTransactionRequest,
  BuildTransactionResponse,
  CreateTipRequest,
  SubmitTransactionRequest,
  SubmitTransactionResponse,
} from './client/transactions';
import type { SandboxHistoryEntry } from './sandbox/mock-router';
import * as creatorMethods from './client/creators';
import * as walletMethods from './client/wallets';
import * as transactionMethods from './client/transactions';
import * as historyMethods from './client/history';
import * as balanceMethods from './client/balance';
import * as verificationMethods from './client/verification';
import * as authMethods from './client/auth';
import { CreateWalletRequest, UpdateWalletRequest } from './types/models';

export type ClientMode = 'sandbox' | 'live' | 'production';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
  /**
   * `sandbox` — all requests return deterministic mocks (no network).
   * `live` / `production` — real HTTP calls.
   */
  mode?: ClientMode;
  /** Seed for deterministic sandbox responses (default 42) */
  sandboxSeed?: number;
  /** Simulated sandbox latency in ms (default 0) */
  sandboxLatency?: number;
  /** Sandbox random error rate 0–1 (default 0) */
  sandboxErrorRate?: number;
}

function normalizeClientMode(mode?: ClientMode): 'live' | 'sandbox' {
  if (mode === 'sandbox') return 'sandbox';
  return 'live';
}

export class DorisioClient {
  private config: ClientConfig & { timeout: number; mode: 'live' | 'sandbox' };
  private httpClient: HttpClient;
  private token?: string;
  private mode: 'live' | 'sandbox';

  constructor(config: ClientConfig) {
    const mode = normalizeClientMode(config.mode);

    this.config = {
      timeout: config.timeout || 30000,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      token: config.token,
      mode,
      sandboxSeed: config.sandboxSeed,
      sandboxLatency: config.sandboxLatency,
      sandboxErrorRate: config.sandboxErrorRate,
    };

    this.token = config.token;
    this.mode = mode;

    this.httpClient = new HttpClient(this.config.baseUrl, {
      timeout: this.config.timeout,
      retryAttempts: getConfig().retryAttempts,
      mode,
      sandboxSeed: config.sandboxSeed,
      sandboxLatency: config.sandboxLatency,
      sandboxErrorRate: config.sandboxErrorRate,
    });

    if (this.token) {
      this.httpClient.setHeader('Authorization', `Bearer ${this.token}`);
    }

    this.bindMethods();

    // A 401 on any API call renews the session once and replays the request,
    // instead of bouncing the user to a logged-out state on a stale token.
    this.httpClient.setTokenRefresher(async () => {
      await this.refreshSession();
    });
  }

  /**
   * Bind all client methods
   */
  private bindMethods(): void {
    this.getCreator = this.getCreator.bind(this);
    this.listCreators = this.listCreators.bind(this);
    this.getCreatorProfile = this.getCreatorProfile.bind(this);
    this.verifyCreator = this.verifyCreator.bind(this);

    this.connectWallet = this.connectWallet.bind(this);
    this.disconnectWallet = this.disconnectWallet.bind(this);
    this.getWallets = this.getWallets.bind(this);
    this.getWallet = this.getWallet.bind(this);
    this.updateWallet = this.updateWallet.bind(this);
    this.verifyWallet = this.verifyWallet.bind(this);
    this.getWalletBalance = this.getWalletBalance.bind(this);

    this.createTip = this.createTip.bind(this);
    this.getTipStatus = this.getTipStatus.bind(this);
    this.getTransactionHistory = this.getTransactionHistory.bind(this);
    this.getCreatorTipsReceived = this.getCreatorTipsReceived.bind(this);
    this.buildPaymentTransaction = this.buildPaymentTransaction.bind(this);
    this.submitPaymentTransaction = this.submitPaymentTransaction.bind(this);
    this.checkTransactionConfirmation = this.checkTransactionConfirmation.bind(this);
    this.updateTipStatus = this.updateTipStatus.bind(this);

    this.getFullTransactionHistory = this.getFullTransactionHistory.bind(this);
    this.getTransactionStats = this.getTransactionStats.bind(this);
    this.getCreatorEarnings = this.getCreatorEarnings.bind(this);
    this.exportTransactionHistory = this.exportTransactionHistory.bind(this);

    this.getBalance = this.getBalance.bind(this);
    this.getCreatorPendingPayout = this.getCreatorPendingPayout.bind(this);
    this.canPayout = this.canPayout.bind(this);
    this.getAccountSummary = this.getAccountSummary.bind(this);

    this.requestCreatorVerification = this.requestCreatorVerification.bind(this);
    this.getCreatorVerificationStatus = this.getCreatorVerificationStatus.bind(this);
    this.getWalletVerificationStatus = this.getWalletVerificationStatus.bind(this);
    this.requestWalletVerificationChallenge =
      this.requestWalletVerificationChallenge.bind(this);
    this.isTransactionVerified = this.isTransactionVerified.bind(this);

    this.refreshSession = this.refreshSession.bind(this);
    this.validateSession = this.validateSession.bind(this);
    this.getCurrentUser = this.getCurrentUser.bind(this);
    this.logout = this.logout.bind(this);
    this.isAuthenticated = this.isAuthenticated.bind(this);
    this.extendSession = this.extendSession.bind(this);
    this.getSessionExpiry = this.getSessionExpiry.bind(this);
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
    this.config.token = token;
    this.httpClient.setHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.token = undefined;
    this.config.token = undefined;
    this.httpClient.removeHeader('Authorization');
  }

  /**
   * Make request to backend API (mocked automatically in sandbox mode)
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    const data = await this.httpClient.request<ApiResponse<T>>(path, {
      method,
      body: body as Record<string, unknown>,
      ...options,
    });
    return data;
  }

  /**
   * Get HTTP client instance (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }

  /**
   * Get current config
   */
  getConfig(): Readonly<ClientConfig & { timeout: number; mode: 'live' | 'sandbox' }> {
    return { ...this.config };
  }

  /**
   * Get current mode (live or sandbox)
   */
  getMode(): 'live' | 'sandbox' {
    return this.mode;
  }

  /**
   * Toggle sandbox/live without recreating the client
   */
  setMode(mode: ClientMode): void {
    this.mode = normalizeClientMode(mode);
    this.config.mode = this.mode;
    this.httpClient.setMode(mode as HttpClientMode);
  }

  /**
   * Check if in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.mode === 'sandbox';
  }

  /**
   * Sandbox request history for debugging / test assertions
   */
  getSandboxHistory(): readonly SandboxHistoryEntry[] {
    return this.httpClient.getSandboxHistory();
  }

  /**
   * Clear recorded sandbox history
   */
  clearSandboxHistory(): void {
    this.httpClient.clearSandboxHistory();
  }

  /**
   * Configure sandbox latency / seed / error rate at runtime
   */
  configureSandbox(options: { seed?: number; latency?: number; errorRate?: number }): void {
    this.httpClient.configureSandbox(options);
  }

  // ---------------------------------------------------------------------------
  // Creator methods
  // ---------------------------------------------------------------------------

  /**
   * Get creator by ID.
   *
   * @param creatorId - Unique creator ID
   * @returns Promise resolving to Creator object
   * @throws Error if creator fetch fails
   * @example
   * ```ts
   * const creator = await client.getCreator('creator_123');
   * ```
   */
  async getCreator<TCreator = Creator>(creatorId: string): Promise<TCreator> {
    return creatorMethods.getCreator.call(this, creatorId) as Promise<TCreator>;
  }

  /**
   * List creators with optional pagination and verification filter.
   *
   * @param options - Pagination and filter options
   * @returns Promise resolving to paginated creators list
   * @example
   * ```ts
   * const result = await client.listCreators({ page: 1, pageSize: 10, verified: true });
   * ```
   */
  async listCreators<TCreator = Creator>(options?: {
    page?: number;
    pageSize?: number;
    verified?: boolean;
  }): Promise<{ creators: TCreator[]; total: number; page: number; pageSize: number }> {
    return creatorMethods.listCreators.call(this, options) as Promise<{
      creators: TCreator[];
      total: number;
      page: number;
      pageSize: number;
    }>;
  }

  /**
   * Get public creator profile by username.
   *
   * @param username - Creator username
   * @returns Promise resolving to CreatorProfile
   * @example
   * ```ts
   * const profile = await client.getCreatorProfile('john_doe');
   * ```
   */
  async getCreatorProfile<TCreatorProfile = CreatorProfile>(
    username: string
  ): Promise<TCreatorProfile> {
    return creatorMethods.getCreatorProfile.call(this, username) as Promise<TCreatorProfile>;
  }

  /**
   * Verify creator identity (admin operation).
   *
   * @param creatorId - Creator ID
   * @param verified - Verification status to set
   * @returns Promise resolving to updated Creator
   */
  async verifyCreator<TCreator = Creator>(
    creatorId: string
  ): Promise<TCreator> {
    return verificationMethods.verifyCreator.call(this, creatorId) as Promise<TCreator>;
  }

  // ---------------------------------------------------------------------------
  // Wallet methods
  // ---------------------------------------------------------------------------

  /**
   * Connect a wallet to user account.
   *
   * @param data - Wallet creation details
   * @returns Promise resolving to connected Wallet
   */
  async connectWallet<TWallet = Wallet>(data: CreateWalletRequest): Promise<TWallet> {
    return walletMethods.connectWallet.call(this, data) as Promise<TWallet>;
  }

  /**
   * Disconnect a wallet from user account.
   *
   * @param walletId - ID of wallet to disconnect
   */
  async disconnectWallet(walletId: string): Promise<void> {
    return walletMethods.disconnectWallet.call(this, walletId);
  }

  /**
   * Get all wallets belonging to user.
   *
   * @param userId - User ID
   * @returns Promise resolving to array of Wallet objects
   */
  async getWallets<TWallet = Wallet>(userId: string): Promise<TWallet[]> {
    return walletMethods.getWallets.call(this, userId) as Promise<TWallet[]>;
  }

  /**
   * Get single wallet by ID.
   *
   * @param walletId - Wallet ID
   * @returns Promise resolving to Wallet object
   */
  async getWallet<TWallet = Wallet>(walletId: string): Promise<TWallet> {
    return walletMethods.getWallet.call(this, walletId) as Promise<TWallet>;
  }

  /**
   * Update wallet details.
   *
   * @param walletId - Wallet ID
   * @param data - Wallet update data
   * @returns Promise resolving to updated Wallet
   */
  async updateWallet<TWallet = Wallet>(
    walletId: string,
    data: UpdateWalletRequest
  ): Promise<TWallet> {
    return walletMethods.updateWallet.call(this, walletId, data) as Promise<TWallet>;
  }

  /**
   * Verify wallet ownership.
   *
   * @param walletId - Wallet ID
   * @param proof - Optional verification proof signature
   * @returns Promise resolving to verified Wallet
   */
  async verifyWallet<TWallet = Wallet>(walletId: string, proof?: string): Promise<TWallet> {
    return (
      proof
        ? walletMethods.verifyWallet.call(this, walletId, proof)
        : walletMethods.verifyWallet.call(this, walletId)
    ) as Promise<TWallet>;
  }

  /**
   * Get single wallet balance info.
   *
   * @param walletId - Wallet ID
   * @returns Promise resolving to BalanceInfo
   */
  async getWalletBalance(walletId: string): Promise<BalanceInfo> {
    return balanceMethods.getWalletBalance.call(this, walletId);
  }

  // ---------------------------------------------------------------------------
  // Transaction methods
  // ---------------------------------------------------------------------------

  /**
   * Create a new tip transaction.
   *
   * @param data - Tip parameters including creatorId, amount, currency, message
   * @returns Promise resolving to Transaction
   */
  async createTip<TTransaction = Transaction>(data: CreateTipRequest): Promise<TTransaction> {
    return transactionMethods.createTip.call(this, data) as Promise<TTransaction>;
  }

  /**
   * Get tip transaction status.
   *
   * @param transactionId - Transaction ID
   * @returns Promise resolving to Transaction
   */
  async getTipStatus<TTransaction = Transaction>(transactionId: string): Promise<TTransaction> {
    return transactionMethods.getTipStatus.call(this, transactionId) as Promise<TTransaction>;
  }

  /**
   * Get transaction history for current user.
   *
   * @param options - Pagination options
   * @returns Promise resolving to TransactionHistory
   */
  async getTransactionHistory(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<TransactionHistory> {
    return transactionMethods.getTransactionHistory.call(this, options);
  }

  /**
   * Get tips received by a specific creator.
   *
   * @param creatorId - Creator ID
   * @param options - Pagination options
   * @returns Promise resolving to TransactionHistory
   */
  async getCreatorTipsReceived(
    creatorId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<TransactionHistory> {
    return transactionMethods.getCreatorTipsReceived.call(this, creatorId, options);
  }

  /**
   * Build an unsigned payment transaction.
   *
   * @param tipId - Tip ID
   * @param data - Build transaction parameters
   * @returns Promise resolving to BuildTransactionResponse
   */
  async buildPaymentTransaction(
    tipId: string,
    data: BuildTransactionRequest
  ): Promise<BuildTransactionResponse> {
    return transactionMethods.buildPaymentTransaction.call(this, tipId, data);
  }

  /**
   * Submit a signed payment transaction.
   *
   * @param tipId - Tip ID
   * @param data - Submit transaction parameters containing signed envelope XDR
   * @returns Promise resolving to SubmitTransactionResponse
   */
  async submitPaymentTransaction(
    tipId: string,
    data: SubmitTransactionRequest
  ): Promise<SubmitTransactionResponse> {
    return transactionMethods.submitPaymentTransaction.call(this, tipId, data);
  }

  /**
   * Check if transaction confirmation is complete.
   *
   * @param tipId - Tip ID
   * @returns Promise resolving to Transaction
   */
  async checkTransactionConfirmation<TTransaction = Transaction>(
    tipId: string
  ): Promise<TTransaction> {
    return transactionMethods.checkTransactionConfirmation.call(
      this,
      tipId
    ) as Promise<TTransaction>;
  }

  /**
   * Update tip status.
   *
   * @param tipId - Tip ID
   * @param status - New status ('pending' | 'completed' | 'failed' | 'cancelled')
   * @returns Promise resolving to Transaction
   */
  async updateTipStatus<TTransaction = Transaction>(
    tipId: string,
    status: 'pending' | 'completed' | 'failed' | 'cancelled'
  ): Promise<TTransaction> {
    return transactionMethods.updateTipStatus.call(
      this,
      tipId,
      status
    ) as Promise<TTransaction>;
  }

  // ---------------------------------------------------------------------------
  // History methods
  // ---------------------------------------------------------------------------

  /**
   * Get full transaction history with date and status filters.
   *
   * @param options - Filter and pagination options
   * @returns Promise resolving to TransactionHistory
   */
  async getFullTransactionHistory(options?: {
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
    status?: 'pending' | 'confirmed' | 'failed';
  }): Promise<TransactionHistory> {
    return historyMethods.getFullTransactionHistory.call(this, options);
  }

  /**
   * Get aggregated transaction statistics.
   *
   * @param userId - Optional user ID filter
   * @returns Promise resolving to TransactionStats
   */
  async getTransactionStats(userId?: string): Promise<TransactionStats> {
    return historyMethods.getTransactionStats.call(this, userId);
  }

  /**
   * Get creator earnings summary.
   *
   * @param creatorId - Creator ID
   * @returns Promise resolving to earnings breakdown object
   */
  async getCreatorEarnings(creatorId: string): Promise<{
    totalEarnings: number;
    pendingBalance: number;
    confirmedBalance: number;
    transactionCount: number;
  }> {
    return historyMethods.getCreatorEarnings.call(this, creatorId);
  }

  /**
   * Export transaction history in CSV or JSON format.
   *
   * @param options - Export options (format, date range)
   * @returns Promise resolving to formatted export string
   */
  async exportTransactionHistory(options?: {
    format?: 'csv' | 'json';
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    return historyMethods.exportTransactionHistory.call(this, options);
  }

  // ---------------------------------------------------------------------------
  // Balance methods
  // ---------------------------------------------------------------------------

  /**
   * Get user's aggregate balance across all wallets.
   *
   * @param userId - User ID
   * @returns Promise resolving to AccountBalance
   */
  async getBalance(userId: string): Promise<AccountBalance> {
    return balanceMethods.getBalance.call(this, userId);
  }

  /**
   * Get creator's pending payout details.
   *
   * @param creatorId - Creator ID
   * @returns Promise resolving to pending payout info
   */
  async getCreatorPendingPayout(creatorId: string): Promise<{
    pending: number;
    nextPayoutDate?: string;
    minimumThreshold: number;
  }> {
    return balanceMethods.getCreatorPendingPayout.call(this, creatorId);
  }

  /**
   * Check if creator meets minimum payout threshold.
   *
   * @param creatorId - Creator ID
   * @returns Promise resolving to boolean
   */
  async canPayout(creatorId: string): Promise<boolean> {
    return balanceMethods.canPayout.call(this, creatorId);
  }

  /**
   * Get current account summary with balances and activity stats.
   *
   * @returns Promise resolving to account summary object
   */
  async getAccountSummary(): Promise<{
    userId: string;
    email: string;
    role: string;
    balance: AccountBalance;
    totalTipsSent?: number;
    totalEarnings?: number;
    lastActivityDate?: string;
  }> {
    return balanceMethods.getAccountSummary.call(this);
  }

  // ---------------------------------------------------------------------------
  // Verification methods
  // ---------------------------------------------------------------------------

  /**
   * Request verification for creator profile.
   *
   * @param creatorId - Creator ID
   * @param data - Verification document and description
   * @returns Promise resolving to VerificationStatus
   */
  async requestCreatorVerification(
    creatorId: string,
    data: { documentType: string; documentUrl?: string; description?: string }
  ): Promise<VerificationStatus> {
    return verificationMethods.requestCreatorVerification.call(this, creatorId, data);
  }

  /**
   * Get creator verification status.
   *
   * @param creatorId - Creator ID
   * @returns Promise resolving to verification status info
   */
  async getCreatorVerificationStatus(
    creatorId: string
  ): Promise<VerificationStatus & { status: string }> {
    return verificationMethods.getCreatorVerificationStatus.call(this, creatorId);
  }

  /**
   * Get wallet verification status.
   *
   * @param walletId - Wallet ID
   * @returns Promise resolving to VerificationStatus
   */
  async getWalletVerificationStatus(walletId: string): Promise<VerificationStatus> {
    return verificationMethods.getWalletVerificationStatus.call(this, walletId);
  }

  /**
   * Request wallet verification challenge string for signing.
   *
   * @param walletId - Wallet ID
   * @returns Promise resolving to challenge object with expiration
   */
  async requestWalletVerificationChallenge(
    walletId: string
  ): Promise<{ challenge: string; expiresIn: number }> {
    return verificationMethods.requestWalletVerificationChallenge.call(this, walletId);
  }

  /**
   * Check if a transaction is verified.
   *
   * @param transactionId - Transaction ID
   * @returns Promise resolving to boolean
   */
  async isTransactionVerified(transactionId: string): Promise<boolean> {
    return verificationMethods.isTransactionVerified.call(this, transactionId);
  }

  // ---------------------------------------------------------------------------
  // Auth methods
  // ---------------------------------------------------------------------------

  /**
   * Refresh user session and receive new session token.
   *
   * @returns Promise resolving to SessionInfo
   */
  async refreshSession(): Promise<SessionInfo> {
    return authMethods.refreshSession.call(this);
  }

  /**
   * Validate active session token.
   *
   * @returns Promise resolving to User model
   */
  async validateSession<TUser = User>(): Promise<TUser> {
    return authMethods.validateSession.call(this) as Promise<TUser>;
  }

  /**
   * Get current authenticated user profile.
   *
   * @returns Promise resolving to User model
   */
  async getCurrentUser<TUser = User>(): Promise<TUser> {
    return authMethods.getCurrentUser.call(this) as Promise<TUser>;
  }

  /**
   * Logout user and clear auth token.
   */
  async logout(): Promise<void> {
    return authMethods.logout.call(this);
  }

  /**
   * Check if client has a valid authenticated session.
   *
   * @returns Promise resolving to boolean
   */
  async isAuthenticated(): Promise<boolean> {
    return authMethods.isAuthenticated.call(this);
  }

  /**
   * Extend current user session expiry.
   *
   * @returns Promise resolving to updated SessionInfo
   */
  async extendSession(): Promise<SessionInfo> {
    return authMethods.extendSession.call(this);
  }

  /**
   * Get session expiry details.
   *
   * @returns Promise resolving to session expiry information
   */
  async getSessionExpiry(): Promise<{
    expiresAt: string;
    expiresIn: number;
    isExpired: boolean;
  }> {
    return authMethods.getSessionExpiry.call(this);
  }
}
