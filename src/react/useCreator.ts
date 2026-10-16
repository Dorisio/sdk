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

export interface UseCreatorState {
  creator: Creator | null;
  profile: CreatorProfile | null;
  loading: boolean;
  error: ApiError | null;
}

export interface UseCreatorActions {
  fetchCreator: (creatorId: string) => Promise<Creator | null>;
  fetchProfile: (username: string) => Promise<CreatorProfile | null>;
  createCreator: (data: CreateCreatorRequest) => Promise<Creator | null>;
  updateCreator: (creatorId: string, data: UpdateCreatorRequest) => Promise<Creator | null>;
  clearError: () => void;
}

/**
 * Standardized request flags returned by {@link useCreator}.
 *
 * `isLoading` stays `true` from the moment the hook mounts (nothing has been
 * resolved yet) until the first request settles — either with data or with an
 * error — and turns `true` again for every subsequent in-flight request.
 * `isError` mirrors the presence of the `error` object.
 */
export interface UseCreatorRequestFlags<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
}

export type UseCreatorResult = UseCreatorState &
  UseCreatorRequestFlags<Creator | CreatorProfile> &
  UseCreatorActions;

/**
 * Hook for managing creator profiles, identity fetching, and profile updates.
 *
 * Returns the raw entity state (`creator`, `profile`, `loading`, `error`) plus
 * the standardized request flags `{ data, isLoading, isError, error }`.
 *
 * @returns State and action handlers for creator operations
 *
 * @example
 * ```tsx
 * import { useCreator } from 'dorisio-sdk/react';
 *
 * function CreatorProfileView({ creatorId }: { creatorId: string }) {
 *   const { data, isLoading, isError, error, fetchCreator } = useCreator();
 *
 *   useEffect(() => {
 *     fetchCreator(creatorId);
 *   }, [creatorId, fetchCreator]);
 *
 *   if (isLoading) return <div>Loading creator...</div>;
 *   if (isError) return <div>Error: {error?.message}</div>;
 *   if (!data) return null;
 *
 *   return (
 *     <div>
 *       <h1>{data.displayName ?? data.username}</h1>
 *       <p>{data.bio}</p>
 *       {data.verified && <span>Verified</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCreator(): UseCreatorResult {
  const { client, setError: setParentError } = useDorisio();
  const [state, setState] = useState<UseCreatorState>({
    creator: null,
    profile: null,
    loading: false,
    error: null,
  });
  // Cleared the first time a request settles so `isLoading` can report the
  // pending → settled transition described in the hook contract.
  const [settled, setSettled] = useState(false);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
    // Any request that reaches a terminal state (data or error) settles the
    // hook, which flips `isLoading` back to false.
    if (!loading) setSettled(true);
  }, []);

  const setError = useCallback((error: ApiError | null) => {
    setState((prev) => ({ ...prev, error }));
    if (error && setParentError) {
      setParentError({ message: error.message, code: error.code || 'CREATOR_ERROR' });
    }
  }, [setParentError]);

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
          }));
          return response.data as Creator;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, setError, setLoading]
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
          }));
          return response.data as CreatorProfile;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, setError, setLoading]
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
          }));
          return response.data as Creator;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, setError, setLoading]
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
          }));
          return response.data as Creator;
        }

        return null;
      } catch (err) {
        const error = err as ApiError;
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, setError, setLoading]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const data = state.creator ?? state.profile;

  return {
    ...state,
    data,
    isLoading: state.loading || !settled,
    isError: state.error !== null,
    fetchCreator,
    fetchProfile,
    createCreator,
    updateCreator,
    clearError,
  };
}
