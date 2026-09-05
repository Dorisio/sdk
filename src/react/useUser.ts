/**
 * useUser Hook
 *
 * Hook for user/fan profile operations.
 */

import { useState, useCallback } from 'react';
import { User, UserProfile, UpdateUserRequest } from '../types/models';
import { ApiError } from '../types/errors';
import { useDorisio } from './DorisioProvider';

interface UseUserState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
}

interface UseUserActions {
  fetchUser: (userId: string) => Promise<User | null>;
  fetchCurrentUser: () => Promise<User | null>;
  updateUser: (userId: string, data: UpdateUserRequest) => Promise<User | null>;
  clearError: () => void;
}

/**
 * useUser hook
 * Manages user state and operations
 */
export function useUser(): UseUserState & UseUserActions {
  const { client } = useDorisio();
  const [state, setState] = useState<UseUserState>({
    user: null,
    profile: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: ApiError | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const fetchUser = useCallback(
    async (userId: string): Promise<User | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('GET', `/users/${userId}`, undefined, {
          timeout: 10000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            user: response.data as User,
            loading: false,
          }));
          return response.data as User;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        setLoading(false);
        return null;
      }
    },
    [client]
  );

  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.request('GET', '/users/me', undefined, {
        timeout: 10000,
      });

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          user: response.data as User,
          isAuthenticated: true,
          loading: false,
        }));
        return response.data as User;
      }

      return null;
    } catch (err) {
      const error = err as ApiError;
      setError(error);
      setState((prev) => ({ ...prev, isAuthenticated: false }));
      setLoading(false);
      return null;
    }
  }, [client]);

  const updateUser = useCallback(
    async (userId: string, data: UpdateUserRequest): Promise<User | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('PATCH', `/users/${userId}`, data, {
          timeout: 15000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            user: response.data as User,
            loading: false,
          }));
          return response.data as User;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        setLoading(false);
        return null;
      }
    },
    [client]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    ...state,
    fetchUser,
    fetchCurrentUser,
    updateUser,
    clearError,
  };
}
