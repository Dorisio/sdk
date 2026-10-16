/**
 * DorisioRealtimeClient facade tests (Issue #41)
 *
 * Uses an injected mock socket so reconnects and offline buffering can be
 * exercised deterministically without a server.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WebSocketLike } from '../websocket/websocket-client';
import { DorisioRealtimeClient } from './websocket-client';

class MockSocket implements WebSocketLike {
  static instances: MockSocket[] = [];

  static get last(): MockSocket {
    const socket = MockSocket.instances[MockSocket.instances.length - 1];
    if (!socket) throw new Error('no mock socket created');
    return socket;
  }

  readonly url: string;

  readonly sent: string[] = [];

  closed: { code?: number; reason?: string } | null = null;

  onopen: ((event: unknown) => void) | null = null;

  onmessage: ((event: { data: unknown }) => void) | null = null;

  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;

  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }

  open(): void {
    this.onopen?.({});
  }

  emit(channel: string, data: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ type: 'event', channel, data }) });
  }
}

const factory = (url: string): MockSocket => new MockSocket(url);

const clients: DorisioRealtimeClient[] = [];

const createClient = (): DorisioRealtimeClient => {
  const client = new DorisioRealtimeClient({
    url: 'wss://realtime.test/socket',
    token: 'jwt',
    reconnectDelayMs: 10,
    maxReconnectDelayMs: 20,
    webSocketFactory: factory,
  });
  clients.push(client);
  return client;
};

const connect = async (client: DorisioRealtimeClient): Promise<MockSocket> => {
  const pending = client.connect();
  const socket = MockSocket.last;
  socket.open();
  await pending;
  return socket;
};

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
  MockSocket.instances = [];
  vi.useRealTimers();
});

describe('DorisioRealtimeClient', () => {
  it('connects, routes events per resource and unsubscribes', async () => {
    const client = createClient();
    const tip1 = vi.fn();

    const unsubscribe = client.subscribeResource('tips', 'tip-1', tip1);

    const socket = await connect(client);
    expect(client.isConnected()).toBe(true);

    socket.emit('tips', { id: 'e1', tipId: 'tip-1', status: 'completed' });
    socket.emit('tips', { id: 'e2', tipId: 'tip-2', status: 'pending' });

    expect(tip1).toHaveBeenCalledTimes(1);
    expect(tip1).toHaveBeenCalledWith({ id: 'e1', tipId: 'tip-1', status: 'completed' });

    unsubscribe();
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? 'null')).toEqual({
      type: 'unsubscribe',
      channel: 'tips',
    });

    socket.emit('tips', { id: 'e3', tipId: 'tip-1', status: 'pending' });
    expect(tip1).toHaveBeenCalledTimes(1);
  });

  it('buffers frames received during an outage and replays them after reconnect', async () => {
    vi.useFakeTimers();
    const client = createClient();
    const received: unknown[] = [];
    client.subscribeResource('tips', 'tip-1', (event) => received.push(event));

    const socket = await connect(client);

    socket.close();
    expect(client.subscriptions.isConnected()).toBe(false);

    // Frames the transport could not deliver yet are queued, not dropped.
    client.subscriptions.handleEvent({
      channel: 'tips',
      data: { id: 'e1', tipId: 'tip-1', status: 'pending' },
      receivedAt: '1970-01-01T00:00:00.000Z',
      source: 'websocket',
    });
    expect(client.getPendingCount()).toBe(1);
    expect(received).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(50);
    const reconnected = MockSocket.last;
    expect(reconnected).not.toBe(socket);
    reconnected.open();

    expect(client.isConnected()).toBe(true);
    expect(received).toEqual([{ id: 'e1', tipId: 'tip-1', status: 'pending' }]);
    expect(client.getPendingCount()).toBe(0);
  });

  it('releases listeners and buffered events on disconnect', async () => {
    const client = createClient();
    client.subscribeResource('tips', 'tip-1', vi.fn());
    await connect(client);

    client.disconnect();

    expect(client.getListenerCount()).toBe(0);
    expect(client.getPendingCount()).toBe(0);
    expect(client.isConnected()).toBe(false);
  });

  it('passes the token to the socket url', async () => {
    const client = createClient();
    await connect(client);
    expect(MockSocket.last.url).toBe('wss://realtime.test/socket?token=jwt');
  });

  it('keeps working without a de-duplication entry for anonymous frames', async () => {
    const client = createClient();
    const listener = vi.fn();
    client.subscribeResource('tips', 'tip-1', listener);
    const socket = await connect(client);

    socket.emit('tips', { tipId: 'tip-1', status: 'pending' });
    socket.emit('tips', { tipId: 'tip-1', status: 'pending' });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
