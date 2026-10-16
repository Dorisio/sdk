import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, type CSSProperties } from 'react';
import { DorisioClient } from '../client';
import type { ClientConfig } from '../client';
import { DorisioProvider } from './DorisioProvider';
import { useCreator } from './useCreator';

const meta: Meta<typeof UseCreatorStory> = {
  title: 'Hooks/useCreator',
  component: UseCreatorStory,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UseCreatorStory>;

const baseConfig: ClientConfig = {
  baseUrl: 'https://api.example.com',
  mode: 'sandbox',
  token: 'storybook-token',
};

function createClient(config: ClientConfig = baseConfig): DorisioClient {
  return new DorisioClient(config);
}

/** Client whose requests never resolve, so the loading state stays visible. */
function createPendingClient(): DorisioClient {
  const client = createClient();
  client.request = () => new Promise(() => undefined);
  return client;
}

/** Client whose creator lookup always fails, to demonstrate the error state. */
function createFailingClient(): DorisioClient {
  const client = createClient();
  client.request = () =>
    Promise.reject(new Error('Creator not found: the request failed with status 404'));
  return client;
}

function LoadingSkeleton() {
  const block: CSSProperties = {
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    marginBottom: '10px',
  };

  return (
    <div role="status" aria-label="Loading creator" style={{ maxWidth: '320px' }}>
      <div style={{ ...block, height: '24px', width: '60%' }} />
      <div style={{ ...block, height: '14px', width: '100%' }} />
      <div style={{ ...block, height: '14px', width: '85%' }} />
      <span style={{ color: '#6c757d', fontSize: '13px' }}>Loading creator…</span>
    </div>
  );
}

function UseCreatorStory() {
  const { data, creator, isLoading, isError, error, fetchCreator } = useCreator();

  useEffect(() => {
    void fetchCreator('creator-123').catch(() => undefined);
  }, [fetchCreator]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>useCreator Hook</h2>
      <div style={{ marginBottom: '20px' }}>
        <strong>isLoading:</strong> {isLoading ? 'Yes' : 'No'}
        {' · '}
        <strong>isError:</strong> {isError ? 'Yes' : 'No'}
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && !isLoading && (
        <div style={{ color: '#c92a2a', marginBottom: '20px' }}>
          <strong>Error:</strong> {error?.message}
        </div>
      )}

      {!isLoading && !isError && data && (
        <div style={{ marginBottom: '20px' }}>
          <div>
            <strong>Display name:</strong> {data.displayName ?? data.username}
          </div>
          <div>
            <strong>Bio:</strong> {data.bio ?? '—'}
          </div>
          <div>
            <strong>Verified:</strong> {creator?.verified ? 'Yes' : 'No'}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          void fetchCreator('creator-123').catch(() => undefined);
        }}
        disabled={isLoading}
        style={{
          padding: '10px 20px',
          backgroundColor: isLoading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        Reload creator
      </button>
    </div>
  );
}

export const Default: Story = {
  decorators: [
    (Story) => (
      <DorisioProvider client={createClient()} config={baseConfig}>
        <Story />
      </DorisioProvider>
    ),
  ],
};

/** Exercises the loading branch — the request never resolves. */
export const LoadingState: Story = {
  decorators: [
    (Story) => (
      <DorisioProvider client={createPendingClient()} config={baseConfig}>
        <Story />
      </DorisioProvider>
    ),
  ],
};

/** Exercises the error branch — the request always rejects. */
export const ErrorState: Story = {
  decorators: [
    (Story) => (
      <DorisioProvider client={createFailingClient()} config={baseConfig}>
        <Story />
      </DorisioProvider>
    ),
  ],
};
