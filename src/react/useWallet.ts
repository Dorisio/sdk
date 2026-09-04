/**
 * useWallet Hook
 *
 * Hook for wallet management with challenge-response verification flow.
 * Handles wallet linking, verification, and unlinking.
 */

import { useState, useCallback } from 'react';
import { useTipForge } from './DorisioProvider';
import { Wallet } from '../types/models';

export interface UseWalletState {
  wallets: Wallet[];
  selectedWallet?: Wallet;
  loading: boolean;
  error?: string;
  nonce?: string;
  challengeStep:
    'idle' | 'nonce-generated' | 'challenge-ready' | 'verifying' | 'verified' | 'error';
}

export interface UseWalletActions {
  generateNonce: (publicKey: string) => Promise<{ nonce: string; expiresIn: number }>;
  getChallenge: (nonce: string) => Promise<string>;
  verifyWallet: (publicKey: string, nonce: string, signedTransaction: string) => Promise<Wallet>;
  listWallets: (includeBalance?: boolean) => Promise<Wallet[]>;
  selectWallet: (wallet: Wallet) => void;
  unlinkWallet: (walletId: string) => Promise<void>;
  renameWallet: (walletId: string, name: string) => Promise<Wallet>;
  getBalance: (walletId: string) => Promise<any>;
  reset: () => void;
}

/**
 * useWallet
 *
 * Manages wallet operations including challenge-response verification with Freighter.
 */
export function useWallet(): UseWalletState & UseWalletActions {
  const { client, setError, setIsLoading } = useTipForge();

  const [state, setState] = useState<UseWalletState>({
    wallets: [],
    loading: false,
    challengeStep: 'idle',
  });

  const generateNonce = useCallback(
    async (publicKey: string): Promise<{ nonce: string; expiresIn: number }> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const response = await client.request<any>('POST', '/api/v1/wallet/nonce', {
          publicKey,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to generate nonce');
        }

        const data = response.data;
        setState((s) => ({
          ...s,
          nonce: data.nonce,
          challengeStep: 'nonce-generated',
          loading: false,
        }));

        return { nonce: data.nonce, expiresIn: data.expiresIn || 300 };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to generate nonce';
        setState((s) => ({ ...s, error, challengeStep: 'error', loading: false }));
        setError({ message: error, code: 'NONCE_GENERATION_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const getChallenge = useCallback(
    async (nonce: string): Promise<string> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const response = await client.request<any>('GET', `/api/v1/wallet/challenge/${nonce}`);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to get challenge');
        }

        const data = response.data;
        setState((s) => ({
          ...s,
          challengeStep: 'challenge-ready',
          loading: false,
        }));

        return data.challenge || data;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to get challenge';
        setState((s) => ({ ...s, error, challengeStep: 'error', loading: false }));
        setError({ message: error, code: 'CHALLENGE_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const verifyWallet = useCallback(
    async (publicKey: string, nonce: string, signedTransaction: string): Promise<Wallet> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined, challengeStep: 'verifying' }));
        setIsLoading(true);

        const response = await client.request<Wallet>('POST', '/api/v1/wallet/verify', {
          publicKey,
          nonce,
          signedTransaction,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to verify wallet');
        }

        const wallet = response.data;

        setState((s) => ({
          ...s,
          wallets: [...s.wallets, wallet],
          selectedWallet: wallet,
          challengeStep: 'verified',
          loading: false,
          nonce: undefined,
        }));

        return wallet;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to verify wallet';
        setState((s) => ({ ...s, error, challengeStep: 'error', loading: false }));
        setError({ message: error, code: 'WALLET_VERIFICATION_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const listWallets = useCallback(
    async (includeBalance = false): Promise<Wallet[]> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const query = includeBalance ? '?includeBalance=true' : '';
        const response = await client.request<any>('GET', `/api/v1/wallet/list${query}`);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to list wallets');
        }

        const data = response.data;
        const wallets = (data.wallets || data) as Wallet[];

        setState((s) => ({
          ...s,
          wallets,
          loading: false,
        }));

        return wallets;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to list wallets';
        setState((s) => ({ ...s, error, loading: false }));
        setError({ message: error, code: 'LIST_WALLETS_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const selectWallet = useCallback((wallet: Wallet) => {
    setState((s) => ({ ...s, selectedWallet: wallet }));
  }, []);

  const unlinkWallet = useCallback(
    async (walletId: string): Promise<void> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const response = await client.request('DELETE', `/api/v1/wallet/${walletId}`);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to unlink wallet');
        }

        setState((s) => ({
          ...s,
          wallets: s.wallets.filter((w) => w.id !== walletId),
          selectedWallet: s.selectedWallet?.id === walletId ? undefined : s.selectedWallet,
          loading: false,
        }));
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to unlink wallet';
        setState((s) => ({ ...s, error, loading: false }));
        setError({ message: error, code: 'UNLINK_WALLET_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const renameWallet = useCallback(
    async (walletId: string, name: string): Promise<Wallet> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const response = await client.request<Wallet>('PATCH', `/api/v1/wallet/${walletId}/name`, {
          name,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to rename wallet');
        }

        const updatedWallet = response.data;

        setState((s) => ({
          ...s,
          wallets: s.wallets.map((w) => (w.id === walletId ? updatedWallet : w)),
          selectedWallet: s.selectedWallet?.id === walletId ? updatedWallet : s.selectedWallet,
          loading: false,
        }));

        return updatedWallet;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to rename wallet';
        setState((s) => ({ ...s, error, loading: false }));
        setError({ message: error, code: 'RENAME_WALLET_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const getBalance = useCallback(
    async (walletId: string): Promise<any> => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        setIsLoading(true);

        const response = await client.request<any>('GET', `/api/v1/wallet/${walletId}/balance`);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch balance');
        }

        setState((s) => ({ ...s, loading: false }));
        return response.data;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to fetch balance';
        setState((s) => ({ ...s, error, loading: false }));
        setError({ message: error, code: 'GET_BALANCE_ERROR' });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client, setError, setIsLoading]
  );

  const reset = useCallback(() => {
    setState({
      wallets: [],
      loading: false,
      challengeStep: 'idle',
    });
  }, []);

  return {
    ...state,
    generateNonce,
    getChallenge,
    verifyWallet,
    listWallets,
    selectWallet,
    unlinkWallet,
    renameWallet,
    getBalance,
    reset,
  };
}
