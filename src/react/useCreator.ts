/**
 * useCreator Hook
 *
 * Hook for creator-related operations.
 */

import { useState, useCallback } from 'react';
import {
  Creator,
  CreatorProfile,
  CreateCreatorRequest,
  UpdateCreatorRequest,
} from '../types/models';
import { ApiError } from '../types/errors';
import { useDorisio } from './DorisioProvider';

interface UseCreatorState {
  creator: Creator | null;
  profile: CreatorProfile | null;
  loading: boolean;
  error: ApiError | null;
}

interface UseCreatorActions {
  fetchCreator: (creatorId: string) => Promise<Creator | null>;
  fetchProfile: (username: string) => Promise<CreatorProfile | null>;
  createCreator: (data: CreateCreatorRequest) => Promise<Creator | null>;
  updateCreator: (creatorId: string, data: UpdateCreatorRequest) => Promise<Creator | null>;
  clearError: () => void;
}

/**
 * useCreator hook
 * Manages creator state and operations
 */
export function useCreator(): UseCreatorState & UseCreatorActions {
  const { client } = useDorisio();
  const [state, setState] = useState<UseCreatorState>({
    creator: null,
    profile: null,
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: ApiError | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const fetchCreator = useCallback(
    async (creatorId: string): Promise<Creator | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('GET', `/creators/${creatorId}`, undefined, {
          timeout: 10000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            creator: response.data as Creator,
            loading: false,
          }));
          return response.data as Creator;
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

  const fetchProfile = useCallback(
    async (username: string): Promise<CreatorProfile | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('GET', `/creators/profile/${username}`, undefined, {
          timeout: 10000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            profile: response.data as CreatorProfile,
            loading: false,
          }));
          return response.data as CreatorProfile;
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

  const createCreator = useCallback(
    async (data: CreateCreatorRequest): Promise<Creator | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('POST', '/creators', data, {
          timeout: 15000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            creator: response.data as Creator,
            loading: false,
          }));
          return response.data as Creator;
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

  const updateCreator = useCallback(
    async (creatorId: string, data: UpdateCreatorRequest): Promise<Creator | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.request('PATCH', `/creators/${creatorId}`, data, {
          timeout: 15000,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            creator: response.data as Creator,
            loading: false,
          }));
          return response.data as Creator;
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
    fetchCreator,
    fetchProfile,
    createCreator,
    updateCreator,
    clearError,
  };
}
