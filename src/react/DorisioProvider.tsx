/**
 * DorisioProvider
 *
 * Comprehensive React context provider for Dorisio integration.
 * Manages client configuration, authentication state, error boundaries, and global state.
 */

import React, { createContext, useContext, useCallback, useState, ReactNode, useMemo } from 'react';
import { DorisioClient, ClientConfig } from '../client';

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  userId?: string;
  createdAt: number;
}

/**
 * Global error state
 */
export interface ErrorState {
  message?: string;
  code?: string;
  timestamp: number;
}

/**
 * Dorisio context value
 */
export interface DorisioContextValue {
  // Client and configuration
  client: DorisioClient;
  config: ClientConfig;

  // Authentication
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;

  // Error handling
  error?: ErrorState;
  setError: (error: Omit<ErrorState, 'timestamp'>) => void;
  clearError: () => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const DorisioContext = createContext<DorisioContextValue | null>(null);

export interface DorisioProviderProps {
  client: DorisioClient;
  config: ClientConfig;
  initialAuth?: AuthState;
  onError?: (error: ErrorState) => void;
  children: ReactNode;
}

/**
 * DorisioProvider
 *
 * Main provider for Dorisio SDK integration in React applications.
 * Provides client, authentication state, and error management.
 *
 * @example
 * ```tsx
 * const client = new DorisioClient({
 *   baseUrl: 'https://api.dorisio.com',
 *   token: 'user-token',
 * });
 *
 * function App() {
 *   return (
 *     <DorisioProvider client={client} config={client.getConfig()}>
 *       <YourApp />
 *     </DorisioProvider>
 *   );
 * }
 * ```
 */
export function DorisioProvider({
  client,
  config,
  initialAuth,
  onError,
  children,
}: DorisioProviderProps): React.ReactElement {
  // Authentication state
  const [auth, setAuthState] = useState<AuthState>(
    initialAuth || {
      isAuthenticated: false,
      createdAt: Date.now(),
    }
  );

  // Error state
  const [error, setErrorState] = useState<ErrorState | undefined>();

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Authentication handlers
  const setAuth = useCallback(
    (newAuth: AuthState) => {
      setAuthState(newAuth);

      // Update client token if provided
      if (newAuth.token) {
        client.setToken(newAuth.token);
      }
    },
    [client]
  );

  const clearAuth = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      createdAt: Date.now(),
    });
    client.clearToken();
  }, [client]);

  // Error handlers
  const setError = useCallback(
    (errorData: Omit<ErrorState, 'timestamp'>) => {
      const errorState: ErrorState = {
        ...errorData,
        timestamp: Date.now(),
      };
      setErrorState(errorState);

      // Notify parent app of error if handler provided
      if (onError) {
        onError(errorState);
      }
    },
    [onError]
  );

  const clearError = useCallback(() => {
    setErrorState(undefined);
  }, []);

  // Create context value
  const value: DorisioContextValue = useMemo(
    () => ({
      client,
      config,
      auth,
      setAuth,
      clearAuth,
      error,
      setError,
      clearError,
      isLoading,
      setIsLoading,
    }),
    [client, config, auth, setAuth, clearAuth, error, setError, clearError, isLoading]
  );

  return (
    <DorisioContext.Provider value={value}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DorisioContext.Provider>
  );
}

/**
 * useDorisio hook
 *
 * Get access to Dorisio context and client within a component.
 * Must be used within a DorisioProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { client, auth, setError } = useDorisio();
 *   // Use client and context...
 * }
 * ```
 */
export function useDorisio(): DorisioContextValue {
  const context = useContext(DorisioContext);

  if (!context) {
    throw new Error('useDorisio must be used within DorisioProvider');
  }

  return context;
}

/**
 * Error Boundary component
 * Catches React errors and displays fallback UI
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Dorisio Error Boundary caught error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            border: '1px solid #ff6b6b',
            borderRadius: '8px',
            backgroundColor: '#ffe0e0',
            color: '#c92a2a',
          }}
        >
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c92a2a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
