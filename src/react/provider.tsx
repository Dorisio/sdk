/**
 * Dorisio React Provider
 *
 * Context provider for DorisioClient and configuration.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { DorisioClient, ClientConfig } from '../client';

interface DorisioContextValue {
  client: DorisioClient;
  config: ClientConfig;
}

const DorisioContext = createContext<DorisioContextValue | null>(null);

interface DorisioProviderProps {
  client: DorisioClient;
  config: ClientConfig;
  children: ReactNode;
}

/**
 * DorisioProvider
 * Wrap your app with this provider to enable Dorisio hooks
 */
export function DorisioProvider({
  client,
  config,
  children,
}: DorisioProviderProps): React.ReactElement {
  const value: DorisioContextValue = {
    client,
    config,
  };

  return <DorisioContext.Provider value={value}>{children}</DorisioContext.Provider>;
}

/**
 * useDorisio hook
 * Get DorisioClient and config from context
 */
export function useDorisio(): DorisioContextValue {
  const context = useContext(DorisioContext);

  if (!context) {
    throw new Error('useDorisio must be used within DorisioProvider');
  }

  return context;
}
