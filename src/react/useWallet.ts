/**
 * useWallet Hook
 *
 * Hook for wallet management with challenge-response verification flow.
 * Handles wallet linking, verification, and unlinking.
 */

import { useState, useCallback } from 'react';
import { useTipForge } from './TipForgeProvider';
import { Wallet } from '../types/models';

export interface UseWalletState {
  wallets: Wallet[];
  selectedWallet?: Wallet;
  loading: boolean;
  error?: string;
  nonce?: string;
  challengeStep: 'idle' | 'nonce-generated' | 'challenge-ready' | 'verifying' | 'verified' | 'error';
}

export interface UseWalletActions {
  generateNonce: (publicKey: string) => Promise<{ nonce: string; expiresIn: number }>;
  getChallenge: (nonce: string) => Promise<string>;
  verifyWallet: (
    publicKey: string,
    nonce: string,
    signedTransaction: string
  ) => Promise<Wallet>;
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
 *
 * @example
 * ```tsx
 * function WalletConnectComponent() {
 *   const { generateNonce, getChallenge, verifyWallet, wallets, selectedWallet } = useWallet();
 *   const [publicKey, setPublicKey] = useState('');
 *
 *   const handleConnect = async () => {
 *     // Step 1: Generate nonce
 *     const { nonce } = await generateNonce(publicKey);
 *
 *     // Step 2: Get challenge transaction
 *     const challengeXdr = await getChallenge(nonce);
 *
 *     // Step 3: Sign with Freighter
 *     const signedXdr = await signWithFreighter(challengeXdr);
 *
 *     // Step 4: Verify and link wallet
 *     const wallet = await verifyWallet(publicKey, nonce, signedXdr);
 *
 *     console.log('Wallet verified:', wallet);
 *   };
 *
 *   return (
 *     <div>
 *       <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} />
 *       <button onClick={handleConnect}>Connect Wallet</button>
 *       <p>Selected: {selectedWallet?.publicKey}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWallet(): UseWalletState & UseWalletActions {
  const { client, setError, setIsLoading } = useTipForge();

  const [state, setState] = useState<UseWalletState>({
    wallets: [],
    loading: false,
    challengeStep: 'idle',
  });

  const generateNonce = useCallback(
    async (publicKey: string) => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined, challengeStep: 'idle' }));
        setIsLoading(true);

        const response = await client.request('POST', '/api/v1/wallet/nonce', {
          publicKey,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to generate nonce');
        }

        setState((s) => ({
          ...s,
          nonce: response.data.nonce,
          challengeStep: 'nonce-generated',
          loading: false,
        }));

        return response.data;
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

        const response = await client.request('GET', `/api/v1/wallet/challenge/${nonce}`);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to get challenge');
        }

        setState((s) => ({
          ...s,
          challengeStep: 'challenge-ready',
          loading: false,
        }));

        return response.data.challenge;
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

        const response = await client.request('POST', '/api/v1/wallet/verify', {
          publicKey,
          nonce,
          signedTransaction,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to verify wallet');
        }

        const wallet = response.data as Wallet;

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
        const response = await client.request('GET', `/api/v1/wallet/list${query}`);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to list wallets');
        }

        const wallets = response.data.wallets as Wallet[];

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

        const response = await client.request('PATCH', `/api/v1/wallet/${walletId}/name`, {
          name,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to rename wallet');
        }

        const updatedWallet = response.data as Wallet;

        setState((s) => ({
          ...s,
          wallets: s.wallets.map((w) => (w.id === walletId ? updatedWallet : w)),
          selectedWallet:
            s.selectedWallet?.id === walletId ? updatedWallet : s.selectedWallet,
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

        const response = await client.request('GET', `/api/v1/wallet/${walletId}/balance`);

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
