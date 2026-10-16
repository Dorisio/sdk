/**
 * Real-time subscription management (Issue #41)
 *
 * `SubscriptionManager` sits on top of the transport ({@link RealtimeTransport},
 * implemented by `WebSocketClient`) and adds the behaviour the raw socket does
 * not provide:
 *
 * - per-resource routing: listeners register for a `tipId` / `creatorId` /
 *   `payoutId` and only receive frames belonging to that resource
 * - event filtering through an optional predicate
 * - de-duplication of events replayed by the server after a reconnect
 * - a bounded buffer of events received while the socket is down, flushed in
 *   order once the connection is usable again
 * - knob-driven cleanup so unsubscribing releases the transport listeners too
 *   (no leaks)
 *
 * Domain namespaces ({@link TipsSubscriptions}, {@link CreatorSubscriptions},
 * {@link PayoutSubscriptions}) wrap the manager with the typed API exposed on
 * `DorisioClient`.
 */

import type { RealtimeEvent } from '../websocket/websocket-client';
import {
  CREATORS_CHANNEL,
  EARNINGS_CHANNEL,
  PAYOUTS_CHANNEL,
  TIPS_CHANNEL,
  getEventId,
  getEventResourceId,
  isCreatorEarningsEvent,
  type CreatorEarningsEvent,
  type CreatorEarningsListener,
  type DorisioRealtimeEvent,
  type PayoutUpdateEvent,
  type PayoutUpdateListener,
  type TipUpdateEvent,
  type TipUpdateListener,
} from '../types/events';

/** Minimal transport surface the manager needs (satisfied by `WebSocketClient`). */
export interface RealtimeTransport {
  subscribe<T = unknown>(
    channel: string,
    listener: (event: RealtimeEvent<T>) => void,
    params?: Record<string, unknown>
  ): () => void;
}

/** Predicate used to accept/reject a payload before it reaches a listener. */
export type EventFilter<T> = (event: T) => boolean;

export interface SubscriptionOptions<T = unknown> {
  /** Only deliver frames whose resource id matches this value. */
  resourceId?: string;
  /** Extra predicate applied after the resource-id check. */
  filter?: EventFilter<T>;
  /**
   * Logical group used to selectively unsubscribe. Set by the domain
   * namespaces (e.g. distinguishing creator updates from earnings updates on
   * the same channel).
   */
  tag?: string;
}

export interface SubscriptionManagerOptions {
  /** Upper bound on events buffered while disconnected (default 100). */
  maxQueueSize?: number;
  /** How long an event id is remembered for de-duplication (default 60_000 ms). */
  dedupeWindowMs?: number;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
}

interface Registration {
  channel: string;
  resourceId?: string;
  filter?: EventFilter<unknown>;
  tag?: string;
  listener: (payload: unknown) => void;
}

interface PendingEvent {
  event: RealtimeEvent<unknown>;
}

const DEFAULT_MAX_QUEUE_SIZE = 100;
const DEFAULT_DEDUPE_WINDOW_MS = 60_000;
const MAX_DEDUPE_ENTRIES = 1_000;

const TAG_TIP = 'tip';
const TAG_CREATOR = 'creator';
const TAG_EARNINGS = 'earnings';
const TAG_PAYOUT = 'payout';

function safeCall(listener: (payload: unknown) => void, payload: unknown): void {
  try {
    listener(payload);
  } catch {
    // Listener isolation: one failing subscriber must not stop the others.
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

export class SubscriptionManager {
  private readonly transport: RealtimeTransport;

  private readonly maxQueueSize: number;

  private readonly dedupeWindowMs: number;

  private readonly now: () => number;

  private readonly registrations = new Map<string, Set<Registration>>();

  private readonly bindings = new Map<string, () => void>();

  private readonly seenEvents = new Map<string, number>();

  private readonly queue: PendingEvent[] = [];

  // Delivery is live until the transport reports an outage. A real socket only
  // emits frames once open, so this default never bypasses a known outage.
  private connected = true;

  constructor(transport: RealtimeTransport, options: SubscriptionManagerOptions = {}) {
    if (!transport || typeof transport.subscribe !== 'function') {
      throw new Error('SubscriptionManager requires a transport with a subscribe() method');
    }
    this.transport = transport;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.dedupeWindowMs = options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /** Listen on a channel. Returns an unsubscribe function. */
  subscribe<T = unknown>(
    channel: string,
    listener: (payload: T) => void,
    options: SubscriptionOptions<T> = {}
  ): () => void {
    if (typeof channel !== 'string' || channel.length === 0) {
      throw new Error('subscribe() requires a channel name');
    }
    if (typeof listener !== 'function') {
      throw new Error('subscribe() requires a listener function');
    }

    const registration: Registration = {
      channel,
      resourceId: options.resourceId,
      filter: options.filter as EventFilter<unknown> | undefined,
      tag: options.tag,
      listener: listener as (payload: unknown) => void,
    };

    const listeners = this.registrations.get(channel) ?? new Set<Registration>();
    listeners.add(registration);
    this.registrations.set(channel, listeners);
    this.bindChannel(channel);

    return () => {
      this.removeRegistration(channel, registration);
    };
  }

  /** Listen to a single resource on a channel. Returns an unsubscribe function. */
  subscribeResource<T = unknown>(
    channel: string,
    resourceId: string,
    listener: (payload: T) => void,
    options: SubscriptionOptions<T> = {}
  ): () => void {
    return this.subscribe(channel, listener, { ...options, resourceId });
  }

  /**
   * Remove listeners from a channel. When `resourceId` is given only that
   * resource is affected; `tag` narrows the removal to a logical group.
   */
  unsubscribeAll(channel: string, resourceId?: string, tag?: string): void {
    const listeners = this.registrations.get(channel);
    if (!listeners) return;

    for (const registration of [...listeners]) {
      if (resourceId !== undefined && registration.resourceId !== resourceId) continue;
      if (tag !== undefined && registration.tag !== tag) continue;
      listeners.delete(registration);
    }

    if (listeners.size === 0) {
      this.registrations.delete(channel);
      this.unbindChannel(channel);
    }
  }

  /** Number of registered listeners, optionally narrowed by channel/resource. */
  getListenerCount(channel?: string, resourceId?: string): number {
    if (channel === undefined) {
      let total = 0;
      for (const listeners of this.registrations.values()) total += listeners.size;
      return total;
    }

    const listeners = this.registrations.get(channel);
    if (!listeners) return 0;
    if (resourceId === undefined) return listeners.size;

    let count = 0;
    for (const registration of listeners) {
      if (registration.resourceId === resourceId) count += 1;
    }
    return count;
  }

  /** Channels that currently have at least one listener. */
  getChannels(): string[] {
    return [...this.registrations.keys()];
  }

  private removeRegistration(channel: string, registration: Registration): void {
    const listeners = this.registrations.get(channel);
    if (!listeners) return;

    listeners.delete(registration);
    if (listeners.size === 0) {
      this.registrations.delete(channel);
      this.unbindChannel(channel);
    }
  }

  // ---------------------------------------------------------------------------
  // Delivery
  // ---------------------------------------------------------------------------

  /** Feed a transport event into the manager. */
  handleEvent(event: RealtimeEvent<unknown>): void {
    if (!event || typeof event !== 'object') return;

    const key = this.dedupeKey(event);
    if (key && this.isDuplicate(key)) return;

    if (!this.connected) {
      this.enqueue(event);
      return;
    }
    this.dispatch(event);
  }

  /**
   * Mark the transport as usable. Enabling flushes everything buffered while
   * disconnected, in arrival order.
   */
  setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    if (connected) this.flush();
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Events buffered while disconnected. */
  getPendingCount(): number {
    return this.queue.length;
  }

  /** Deliver buffered events. No-op while disconnected. */
  flush(): void {
    if (!this.connected) return;
    while (this.queue.length > 0) {
      const pending = this.queue.shift();
      if (pending) this.dispatch(pending.event);
    }
  }

  /** Drop every listener, transport binding, buffer and de-duplication entry. */
  clear(): void {
    for (const unsubscribe of this.bindings.values()) {
      try {
        unsubscribe();
      } catch {
        // A misbehaving transport must not block cleanup.
      }
    }
    this.bindings.clear();
    this.registrations.clear();
    this.seenEvents.clear();
    this.queue.length = 0;
  }

  private dispatch(event: RealtimeEvent<unknown>): void {
    const listeners = this.registrations.get(event.channel);
    if (!listeners || listeners.size === 0) return;

    const payload = event.data;
    const resourceId = getEventResourceId(payload);

    for (const registration of [...listeners]) {
      if (registration.resourceId !== undefined && registration.resourceId !== resourceId) {
        continue;
      }
      if (registration.filter && !registration.filter(payload)) continue;
      safeCall(registration.listener, payload);
    }
  }

  private enqueue(event: RealtimeEvent<unknown>): void {
    this.queue.push({ event });
    while (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // De-duplication
  // ---------------------------------------------------------------------------

  private dedupeKey(event: RealtimeEvent<unknown>): string | undefined {
    const payload = event.data;
    const explicit = getEventId(payload);
    if (explicit) return `${event.channel}:${explicit}`;

    const resourceId = getEventResourceId(payload);
    if (!resourceId) return undefined;

    const record = asRecord(payload);
    if (!record) return undefined;

    const type = typeof record.type === 'string' ? record.type : '';
    const marker =
      typeof record.sequence === 'number'
        ? String(record.sequence)
        : typeof record.timestamp === 'string'
          ? record.timestamp
          : undefined;
    if (marker === undefined) return undefined;

    return `${event.channel}:${resourceId}:${type}:${marker}`;
  }

  private isDuplicate(key: string): boolean {
    const now = this.now();
    const seenAt = this.seenEvents.get(key);
    if (seenAt !== undefined && now - seenAt < this.dedupeWindowMs) return true;

    this.seenEvents.set(key, now);
    this.pruneSeen(now);
    return false;
  }

  private pruneSeen(now: number): void {
    if (this.seenEvents.size <= MAX_DEDUPE_ENTRIES) return;

    for (const [key, seenAt] of this.seenEvents) {
      if (now - seenAt >= this.dedupeWindowMs) this.seenEvents.delete(key);
    }
    while (this.seenEvents.size > MAX_DEDUPE_ENTRIES) {
      const oldest = this.seenEvents.keys().next().value;
      if (oldest === undefined) break;
      this.seenEvents.delete(oldest);
    }
  }

  // ---------------------------------------------------------------------------
  // Transport bindings
  // ---------------------------------------------------------------------------

  private bindChannel(channel: string): void {
    if (this.bindings.has(channel)) return;

    const unsubscribe = this.transport.subscribe(channel, (event) => {
      this.handleEvent(event as RealtimeEvent<unknown>);
    });
    this.bindings.set(channel, unsubscribe);
  }

  private unbindChannel(channel: string): void {
    const unsubscribe = this.bindings.get(channel);
    if (!unsubscribe) return;

    this.bindings.delete(channel);
    try {
      unsubscribe();
    } catch {
      // Ignore transport cleanup failures.
    }
  }
}

/** Supplies the manager, lazily created by the client. */
export interface SubscriptionManagerProvider {
  getSubscriptionManager(): SubscriptionManager;
}

type DomainOptions<T> = Omit<SubscriptionOptions<T>, 'resourceId' | 'tag'>;

/** Typed subscriptions for tip updates. */
export class TipsSubscriptions {
  constructor(private readonly provider: SubscriptionManagerProvider) {}

  /** Subscribe to updates for a single tip. */
  subscribe(tipId: string, listener: TipUpdateListener, options: DomainOptions<TipUpdateEvent> = {}): () => void {
    return this.provider
      .getSubscriptionManager()
      .subscribeResource<TipUpdateEvent>(TIPS_CHANNEL, tipId, listener, { ...options, tag: TAG_TIP });
  }

  /** Subscribe to every tip update. */
  subscribeAll(listener: TipUpdateListener): () => void {
    return this.provider
      .getSubscriptionManager()
      .subscribe<TipUpdateEvent>(TIPS_CHANNEL, listener, { tag: TAG_TIP });
  }

  /** Remove every tip listener registered for `tipId`. */
  unsubscribe(tipId: string): void {
    this.provider.getSubscriptionManager().unsubscribeAll(TIPS_CHANNEL, tipId, TAG_TIP);
  }
}

/** Typed subscriptions for creator updates and earnings. */
export class CreatorSubscriptions {
  constructor(private readonly provider: SubscriptionManagerProvider) {}

  /** Subscribe to updates for a single creator. */
  subscribe(
    creatorId: string,
    listener: (event: DorisioRealtimeEvent) => void,
    options: DomainOptions<DorisioRealtimeEvent> = {}
  ): () => void {
    return this.provider
      .getSubscriptionManager()
      .subscribeResource<DorisioRealtimeEvent>(CREATORS_CHANNEL, creatorId, listener, {
        ...options,
        tag: TAG_CREATOR,
      });
  }

  /**
   * Subscribe to earnings updates for a single creator.
   *
   * Earnings frames may arrive on the `creators` channel (filtered down to
   * earnings payloads) or on the dedicated `earnings` channel.
   */
  subscribeEarnings(
    creatorId: string,
    listener: CreatorEarningsListener,
    options: DomainOptions<CreatorEarningsEvent> = {}
  ): () => void {
    const manager = this.provider.getSubscriptionManager();
    const fromCreators = manager.subscribeResource<CreatorEarningsEvent>(
      CREATORS_CHANNEL,
      creatorId,
      listener,
      { ...options, filter: options.filter ?? isCreatorEarningsEvent, tag: TAG_EARNINGS }
    );
    const fromEarnings = manager.subscribeResource<CreatorEarningsEvent>(
      EARNINGS_CHANNEL,
      creatorId,
      listener,
      { ...options, tag: TAG_EARNINGS }
    );

    return () => {
      fromCreators();
      fromEarnings();
    };
  }

  /** Remove every creator-update listener registered for `creatorId`. */
  unsubscribe(creatorId: string): void {
    this.provider.getSubscriptionManager().unsubscribeAll(CREATORS_CHANNEL, creatorId, TAG_CREATOR);
  }

  /** Remove every earnings listener registered for `creatorId`. */
  unsubscribeEarnings(creatorId: string): void {
    const manager = this.provider.getSubscriptionManager();
    manager.unsubscribeAll(CREATORS_CHANNEL, creatorId, TAG_EARNINGS);
    manager.unsubscribeAll(EARNINGS_CHANNEL, creatorId, TAG_EARNINGS);
  }
}

/** Typed subscriptions for payout updates. */
export class PayoutSubscriptions {
  constructor(private readonly provider: SubscriptionManagerProvider) {}

  /** Subscribe to updates for a single payout. */
  subscribe(
    payoutId: string,
    listener: PayoutUpdateListener,
    options: DomainOptions<PayoutUpdateEvent> = {}
  ): () => void {
    return this.provider
      .getSubscriptionManager()
      .subscribeResource<PayoutUpdateEvent>(PAYOUTS_CHANNEL, payoutId, listener, {
        ...options,
        tag: TAG_PAYOUT,
      });
  }

  /** Subscribe to every payout update. */
  subscribeAll(listener: PayoutUpdateListener): () => void {
    return this.provider
      .getSubscriptionManager()
      .subscribe<PayoutUpdateEvent>(PAYOUTS_CHANNEL, listener, { tag: TAG_PAYOUT });
  }

  /** Remove every payout listener registered for `payoutId`. */
  unsubscribe(payoutId: string): void {
    this.provider.getSubscriptionManager().unsubscribeAll(PAYOUTS_CHANNEL, payoutId, TAG_PAYOUT);
  }
}
