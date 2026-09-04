/**
 * DorisioClient
 *
 * Main client for interacting with Dorisio backend API.
 * Handles authentication, request/response handling, and error management.
 */

import { HttpClient, RequestOptions } from './http/http-client';
import { getConfig } from './config';
import { ApiResponse } from './types/api';
import { Creator, Wallet, Transaction, User } from './types/models';
import * as creatorMethods from './client/creators';
import * as walletMethods from './client/wallets';
import * as transactionMethods from './client/transactions';
import * as historyMethods from './client/history';
import * as balanceMethods from './client/balance';
import * as verificationMethods from './client/verification';
import * as authMethods from './client/auth';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
}

export class DorisioClient {
  private config: ClientConfig & { timeout: number };
  private httpClient: HttpClient;
  private token?: string;

  constructor(config: ClientConfig) {
    this.config = {
      timeout: config.timeout || 30000,
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      token: config.token,
    };

    this.token = config.token;

    this.httpClient = new HttpClient(this.config.baseUrl, {
      timeout: this.config.timeout,
      retryAttempts: getConfig().retryAttempts,
    });

    if (this.token) {
      this.httpClient.setHeader('Authorization', `Bearer ${this.token}`);
    }

    // Bind methods
    this.bindMethods();
  }

  /**
   * Bind all client methods
   */
  private bindMethods(): void {
    // Creator methods
    this.getCreator = creatorMethods.getCreator.bind(this);
    this.listCreators = creatorMethods.listCreators.bind(this);
    this.getCreatorProfile = creatorMethods.getCreatorProfile.bind(this);
    this.verifyCreator = verificationMethods.verifyCreator.bind(this);

    // Wallet methods
    this.connectWallet = walletMethods.connectWallet.bind(this);
    this.disconnectWallet = walletMethods.disconnectWallet.bind(this);
    this.getWallets = walletMethods.getWallets.bind(this);
    this.getWallet = walletMethods.getWallet.bind(this);
    this.updateWallet = walletMethods.updateWallet.bind(this);
    this.verifyWallet = verificationMethods.verifyWallet.bind(this);
    this.getWalletBalance = balanceMethods.getWalletBalance.bind(this);

    // Transaction methods
    this.createTip = transactionMethods.createTip.bind(this);
    this.getTipStatus = transactionMethods.getTipStatus.bind(this);
    this.getTransactionHistory = transactionMethods.getTransactionHistory.bind(this);
    this.getCreatorTipsReceived = transactionMethods.getCreatorTipsReceived.bind(this);
    this.buildPaymentTransaction = transactionMethods.buildPaymentTransaction.bind(this);
    this.submitPaymentTransaction = transactionMethods.submitPaymentTransaction.bind(this);
    this.checkTransactionConfirmation = transactionMethods.checkTransactionConfirmation.bind(this);
    this.updateTipStatus = transactionMethods.updateTipStatus.bind(this);

    // History methods
    this.getFullTransactionHistory = historyMethods.getFullTransactionHistory.bind(this);
    this.getTransactionStats = historyMethods.getTransactionStats.bind(this);
    this.getCreatorEarnings = historyMethods.getCreatorEarnings.bind(this);
    this.exportTransactionHistory = historyMethods.exportTransactionHistory.bind(this);

    // Balance methods
    this.getBalance = balanceMethods.getBalance.bind(this);
    this.getCreatorPendingPayout = balanceMethods.getCreatorPendingPayout.bind(this);
    this.canPayout = balanceMethods.canPayout.bind(this);
    this.getAccountSummary = balanceMethods.getAccountSummary.bind(this);

    // Verification methods
    this.requestCreatorVerification = verificationMethods.requestCreatorVerification.bind(this);
    this.getCreatorVerificationStatus = verificationMethods.getCreatorVerificationStatus.bind(this);
    this.getWalletVerificationStatus = verificationMethods.getWalletVerificationStatus.bind(this);
    this.requestWalletVerificationChallenge =
      verificationMethods.requestWalletVerificationChallenge.bind(this);
    this.isTransactionVerified = verificationMethods.isTransactionVerified.bind(this);

    // Auth methods
    this.refreshSession = authMethods.refreshSession.bind(this);
    this.validateSession = authMethods.validateSession.bind(this);
    this.getCurrentUser = authMethods.getCurrentUser.bind(this);
    this.logout = authMethods.logout.bind(this);
    this.isAuthenticated = authMethods.isAuthenticated.bind(this);
    this.extendSession = authMethods.extendSession.bind(this);
    this.getSessionExpiry = authMethods.getSessionExpiry.bind(this);
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
   * Make request to backend API
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: Partial<RequestOptions>
  ): Promise<ApiResponse<T>> {
    try {
      const data = await this.httpClient.request<ApiResponse<T>>(path, {
        method,
        body: body as Record<string, unknown>,
        ...options,
      });
      return data;
    } catch (error) {
      throw error;
    }
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
  getConfig(): Readonly<ClientConfig & { timeout: number }> {
    return { ...this.config };
  }

  // Creator methods
  declare getCreator: (creatorId: string) => Promise<Creator>;
  declare listCreators: (options?: any) => Promise<any>;
  declare getCreatorProfile: (username: string) => Promise<any>;
  declare verifyCreator: (creatorId: string) => Promise<Creator>;

  // Wallet methods
  declare connectWallet: (data: any) => Promise<Wallet>;
  declare disconnectWallet: (walletId: string) => Promise<void>;
  declare getWallets: (userId: string) => Promise<Wallet[]>;
  declare getWallet: (walletId: string) => Promise<Wallet>;
  declare updateWallet: (walletId: string, data: any) => Promise<Wallet>;
  declare verifyWallet: (walletId: string, proof: string) => Promise<Wallet>;
  declare getWalletBalance: (walletId: string) => Promise<any>;

  // Transaction methods
  declare createTip: (data: any) => Promise<Transaction>;
  declare getTipStatus: (transactionId: string) => Promise<Transaction>;
  declare getTransactionHistory: (options?: any) => Promise<any>;
  declare getCreatorTipsReceived: (creatorId: string, options?: any) => Promise<any>;
  declare buildPaymentTransaction: (tipId: string, data: any) => Promise<any>;
  declare submitPaymentTransaction: (tipId: string, data: any) => Promise<any>;
  declare checkTransactionConfirmation: (tipId: string) => Promise<Transaction>;
  declare updateTipStatus: (
    tipId: string,
    status: 'pending' | 'completed' | 'failed' | 'cancelled'
  ) => Promise<Transaction>;

  // History methods
  declare getFullTransactionHistory: (options?: any) => Promise<any>;
  declare getTransactionStats: (userId?: string) => Promise<any>;
  declare getCreatorEarnings: (creatorId: string) => Promise<any>;
  declare exportTransactionHistory: (options?: any) => Promise<string>;

  // Balance methods
  declare getBalance: (userId: string) => Promise<any>;
  declare getCreatorPendingPayout: (creatorId: string) => Promise<any>;
  declare canPayout: (creatorId: string) => Promise<boolean>;
  declare getAccountSummary: () => Promise<any>;

  // Verification methods
  declare requestCreatorVerification: (creatorId: string, data: any) => Promise<any>;
  declare getCreatorVerificationStatus: (creatorId: string) => Promise<any>;
  declare getWalletVerificationStatus: (walletId: string) => Promise<any>;
  declare requestWalletVerificationChallenge: (walletId: string) => Promise<any>;
  declare isTransactionVerified: (transactionId: string) => Promise<boolean>;

  // Auth methods
  declare refreshSession: () => Promise<any>;
  declare validateSession: () => Promise<User>;
  declare getCurrentUser: () => Promise<User>;
  declare logout: () => Promise<void>;
  declare isAuthenticated: () => Promise<boolean>;
  declare extendSession: () => Promise<any>;
  declare getSessionExpiry: () => Promise<any>;
}
