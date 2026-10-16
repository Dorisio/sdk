/**
 * Domain-level real-time client (Issue #41)
 *
 * `DorisioRealtimeClient` pairs the low-level {@link WebSocketClient}
 * (connection, heartbeat, exponential-backoff reconnect, polling fallback) with
 * a {@link SubscriptionManager} (per-resource routing, filtering,
 * de-duplication, offline buffering), exposing one surface that
 * `DorisioClient` and standalone consumers can use.
 *
 * ```ts
 * const realtime = new DorisioRealtimeClient({ url: 'wss://api.dorisio.com', token });
 * realtime.subscribeResource('tips', 'tip-1', (update) => console.log(update.status));
 * await realtime.connect();
 * ```
 */

import {
  WebSocketClient,
  type RealtimeEvent,
  type RealtimeListener,
  type RealtimeStateListener,
  type WebSocketClientOptions,
  type WebSocketState,
} from '../websocket/websocket-client';
import {
  SubscriptionManager,
  type SubscriptionManagerOptions,
  type SubscriptionOptions,
} from './subscriptions';

export interface DorisioRealtimeClientOptions extends WebSocketClientOptions {
  /** Upper bound on events buffered while disconnected (default 100). */
  maxQueueSize?: number;
  /** How long an event id is remembered for de-duplication (default 60_000 ms). */
  dedupeWindowMs?: number;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
}

/**
 * Real-time client with auto-reconnect, heartbeat, per-resource subscriptions,
 * de-duplication and offline event buffering.
 */
export class DorisioRealtimeClient {
  /** Underlying socket client (reconnect, heartbeat, polling fallback). */
  readonly socket: WebSocketClient;

  /** Subscription router layered on top of the socket. */
  readonly subscriptions: SubscriptionManager;

  constructor(options: DorisioRealtimeClientOptions) {
    const { maxQueueSize, dedupeWindowMs, now, ...socketOptions } = options;
    this.socket = new WebSocketClient(socketOptions);

    const managerOptions: SubscriptionManagerOptions = {};
    if (maxQueueSize !== undefined) managerOptions.maxQueueSize = maxQueueSize;
    if (dedupeWindowMs !== undefined) managerOptions.dedupeWindowMs = dedupeWindowMs;
    if (now !== undefined) managerOptions.now = now;
    this.subscriptions = new SubscriptionManager(this.socket, managerOptions);

    // Buffer events whenever the transport is not usable, then replay them in
    // order on the next successful (re)connection. Polling fallback counts as
    // usable: it is the transport of last resort.
    this.socket.onStateChange((state) => {
      this.subscriptions.setConnected(state === 'open' || state === 'polling');
    });
  }

  /** Open the socket (or start the polling fallback). Never rejects. */
  async connect(): Promise<void> {
    await this.socket.connect();
    this.subscriptions.setConnected(
      this.socket.isConnected() || this.socket.isUsingPollingFallback()
    );
  }

  /** Close the socket, cancel timers and release every subscription. */
  disconnect(): void {
    this.subscriptions.setConnected(false);
    this.socket.disconnect();
    this.subscriptions.clear();
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  /** Listen on a channel. Returns an unsubscribe function. */
  subscribe<T = unknown>(
    channel: string,
    listener: (payload: T) => void,
    options: SubscriptionOptions<T> = {}
  ): () => void {
    return this.subscriptions.subscribe(channel, listener, options);
  }

  /** Listen to a single resource on a channel. Returns an unsubscribe function. */
  subscribeResource<T = unknown>(
    channel: string,
    resourceId: string,
    listener: (payload: T) => void,
    options: SubscriptionOptions<T> = {}
  ): () => void {
    return this.subscriptions.subscribeResource(channel, resourceId, listener, options);
  }

  /** Remove listeners, optionally scoped to a resource/group. */
  unsubscribeAll(channel: string, resourceId?: string, tag?: string): void {
    this.subscriptions.unsubscribeAll(channel, resourceId, tag);
  }

  // ---------------------------------------------------------------------------
  // Transport pass-throughs
  // ---------------------------------------------------------------------------

  /** Raw transport subscription delivering full {@link RealtimeEvent} envelopes. */
  subscribeRaw<T = unknown>(
    channel: string,
    listener: RealtimeListener<T>,
    params?: Record<string, unknown>
  ): () => void {
    return this.socket.subscribe(channel, listener, params);
  }

  send(type: string, payload?: Record<string, unknown>): boolean {
    return this.socket.send(type, payload);
  }

  getState(): WebSocketState {
    return this.socket.getState();
  }

  isConnected(): boolean {
    return this.socket.isConnected();
  }

  isUsingPollingFallback(): boolean {
    return this.socket.isUsingPollingFallback();
  }

  getReconnectAttempt(): number {
    return this.socket.getReconnectAttempt();
  }

  onStateChange(listener: RealtimeStateListener): () => void {
    return this.socket.onStateChange(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    return this.socket.onError(listener);
  }

  /** Events buffered while disconnected. */
  getPendingCount(): number {
    return this.subscriptions.getPendingCount();
  }

  /** Registered listener count, optionally scoped to a channel/resource. */
  getListenerCount(channel?: string, resourceId?: string): number {
    return this.subscriptions.getListenerCount(channel, resourceId);
  }
}

export type { RealtimeEvent };
