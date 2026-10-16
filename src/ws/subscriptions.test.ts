/**
 * SubscriptionManager + domain namespace tests (Issue #41)
 *
 * A fake transport stands in for the WebSocket, so routing, filtering,
 * de-duplication, offline buffering and cleanup can be exercised without a
 * server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RealtimeEvent, RealtimeSource } from '../websocket/websocket-client';
import {
  SubscriptionManager,
  TipsSubscriptions,
  CreatorSubscriptions,
  PayoutSubscriptions,
  type RealtimeTransport,
  type SubscriptionManagerProvider,
} from './subscriptions';
import { EARNINGS_CHANNEL, TIPS_CHANNEL, CREATORS_CHANNEL, PAYOUTS_CHANNEL } from '../types/events';

class FakeTransport implements RealtimeTransport {
  readonly listeners = new Map<string, Set<(event: RealtimeEvent<unknown>) => void>>();

  readonly subscribedChannels: string[] = [];

  subscribe<T = unknown>(
    channel: string,
    listener: (event: RealtimeEvent<T>) => void
  ): () => void {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(listener as (event: RealtimeEvent<unknown>) => void);
    this.listeners.set(channel, set);
    this.subscribedChannels.push(channel);

    return () => {
      const current = this.listeners.get(channel);
      if (!current) return;
      current.delete(listener as (event: RealtimeEvent<unknown>) => void);
      if (current.size === 0) this.listeners.delete(channel);
    };
  }

  emit(channel: string, data: unknown, source: RealtimeSource = 'websocket'): void {
    const event: RealtimeEvent<unknown> = {
      channel,
      data,
      receivedAt: new Date(0).toISOString(),
      source,
    };
    for (const listener of [...(this.listeners.get(channel) ?? [])]) {
      listener(event);
    }
  }

  listenerCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }
}

const setup = (options: ConstructorParameters<typeof SubscriptionManager>[1] = {}) => {
  const transport = new FakeTransport();
  const manager = new SubscriptionManager(transport, options);
  const provider: SubscriptionManagerProvider = {
    getSubscriptionManager: () => manager,
  };
  return { transport, manager, provider };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionManager', () => {
  it('routes payloads to the matching resource only', () => {
    const { transport, manager } = setup();
    const tip1 = vi.fn();
    const tip2 = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', tip1);
    manager.subscribeResource(TIPS_CHANNEL, 'tip-2', tip2);

    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1', status: 'completed' });

    expect(tip1).toHaveBeenCalledTimes(1);
    expect(tip1).toHaveBeenCalledWith({ id: 'e1', tipId: 'tip-1', status: 'completed' });
    expect(tip2).not.toHaveBeenCalled();
  });

  it('delivers to wildcard listeners for the channel', () => {
    const { transport, manager } = setup();
    const all = vi.fn();

    manager.subscribe(TIPS_CHANNEL, all);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-9' });

    expect(all).toHaveBeenCalledTimes(1);
  });

  it('applies the filter predicate', () => {
    const { transport, manager } = setup();
    const completed = vi.fn();

    manager.subscribeResource(
      TIPS_CHANNEL,
      'tip-1',
      completed,
      { filter: (event) => (event as { status?: string }).status === 'completed' }
    );

    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1', status: 'pending' });
    transport.emit(TIPS_CHANNEL, { id: 'e2', tipId: 'tip-1', status: 'completed' });

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledWith({ id: 'e2', tipId: 'tip-1', status: 'completed' });
  });

  it('de-duplicates replayed events by id within the window', () => {
    const { transport, manager } = setup({ dedupeWindowMs: 1000, now: () => 0 });
    const listener = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', listener);
    const event = { id: 'evt-1', tipId: 'tip-1', status: 'completed' };
    transport.emit(TIPS_CHANNEL, event);
    transport.emit(TIPS_CHANNEL, { ...event });
    transport.emit(TIPS_CHANNEL, { ...event });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('accepts an event id again once the de-duplication window elapsed', () => {
    let now = 0;
    const { transport, manager } = setup({ dedupeWindowMs: 1000, now: () => now });
    const listener = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', listener);
    transport.emit(TIPS_CHANNEL, { id: 'evt-1', tipId: 'tip-1' });

    now = 5000;
    transport.emit(TIPS_CHANNEL, { id: 'evt-1', tipId: 'tip-1' });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('buffers events while disconnected and replays them in order once connected', () => {
    const { transport, manager } = setup();
    const seen: unknown[] = [];

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', (event) => seen.push(event));

    manager.setConnected(false);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1', status: 'pending' });
    transport.emit(TIPS_CHANNEL, { id: 'e2', tipId: 'tip-1', status: 'completed' });

    expect(seen).toHaveLength(0);
    expect(manager.getPendingCount()).toBe(2);

    manager.setConnected(true);

    expect(seen).toEqual([
      { id: 'e1', tipId: 'tip-1', status: 'pending' },
      { id: 'e2', tipId: 'tip-1', status: 'completed' },
    ]);
    expect(manager.getPendingCount()).toBe(0);
  });

  it('bounds the offline buffer to the configured size, dropping the oldest', () => {
    const { transport, manager } = setup({ maxQueueSize: 2 });
    const seen: unknown[] = [];

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', (event) => seen.push(event));
    manager.setConnected(false);

    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' });
    transport.emit(TIPS_CHANNEL, { id: 'e2', tipId: 'tip-1' });
    transport.emit(TIPS_CHANNEL, { id: 'e3', tipId: 'tip-1' });

    manager.setConnected(true);

    expect(seen).toEqual([
      { id: 'e2', tipId: 'tip-1' },
      { id: 'e3', tipId: 'tip-1' },
    ]);
  });

  it('does not deliver buffered events before reconnecting', () => {
    const { transport, manager } = setup();
    const listener = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', listener);
    manager.setConnected(false);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' });
    manager.flush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('unbinds the transport when the last listener for a channel is removed', () => {
    const { transport, manager } = setup();

    const unsubscribe = manager.subscribeResource(TIPS_CHANNEL, 'tip-1', vi.fn());
    expect(transport.listenerCount(TIPS_CHANNEL)).toBe(1);

    unsubscribe();
    expect(transport.listenerCount(TIPS_CHANNEL)).toBe(0);
    expect(manager.getListenerCount(TIPS_CHANNEL)).toBe(0);
  });

  it('isolates a throwing listener from the others', () => {
    const { transport, manager } = setup();
    const good = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', () => {
      throw new Error('boom');
    });
    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', good);

    expect(() => transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes every listener for a resource without touching wildcards', () => {
    const { transport, manager } = setup();
    const scoped = vi.fn();
    const all = vi.fn();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', scoped, { tag: 'tip' });
    manager.subscribe(TIPS_CHANNEL, all, { tag: 'tip' });
    manager.unsubscribeAll(TIPS_CHANNEL, 'tip-1', 'tip');

    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' });

    expect(scoped).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);
  });

  it('clears listeners, bindings and the buffer', () => {
    const { transport, manager } = setup();

    manager.subscribeResource(TIPS_CHANNEL, 'tip-1', vi.fn());
    manager.setConnected(false);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' });

    manager.clear();

    expect(manager.getListenerCount()).toBe(0);
    expect(manager.getPendingCount()).toBe(0);
    expect(transport.listenerCount(TIPS_CHANNEL)).toBe(0);
  });

  it('rejects invalid subscription arguments', () => {
    const { manager } = setup();
    expect(() => manager.subscribe('', vi.fn())).toThrow(/channel/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => manager.subscribe(TIPS_CHANNEL, undefined as any)).toThrow(/listener/);
  });
});

describe('domain subscription namespaces', () => {
  it('routes tip updates and supports unsubscribe by tip id', () => {
    const { transport, manager, provider } = setup();
    const tips = new TipsSubscriptions(provider);
    const listener = vi.fn();

    tips.subscribe('tip-1', listener);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1', status: 'pending' });
    transport.emit(TIPS_CHANNEL, { id: 'e2', tipId: 'tip-2', status: 'pending' });

    expect(listener).toHaveBeenCalledTimes(1);

    tips.unsubscribe('tip-1');
    transport.emit(TIPS_CHANNEL, { id: 'e3', tipId: 'tip-1', status: 'completed' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(manager.getListenerCount(TIPS_CHANNEL, 'tip-1')).toBe(0);
  });

  it('subscribeAll receives every tip update', () => {
    const { transport, provider } = setup();
    const tips = new TipsSubscriptions(provider);
    const listener = vi.fn();

    tips.subscribeAll(listener);
    transport.emit(TIPS_CHANNEL, { id: 'e1', tipId: 'tip-1' });
    transport.emit(TIPS_CHANNEL, { id: 'e2', tipId: 'tip-2' });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('delivers creator earnings from both the creators and earnings channels', () => {
    const { transport, provider } = setup();
    const creators = new CreatorSubscriptions(provider);
    const listener = vi.fn();

    creators.subscribeEarnings('creator-1', listener);

    transport.emit(CREATORS_CHANNEL, { id: 'e1', creatorId: 'creator-1', totalEarnings: 10 });
    transport.emit(EARNINGS_CHANNEL, { id: 'e2', creatorId: 'creator-1', pendingBalance: 5 });
    transport.emit(CREATORS_CHANNEL, { id: 'e3', creatorId: 'creator-2', totalEarnings: 1 });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('filters non-earnings frames off the creators channel', () => {
    const { transport, provider } = setup();
    const creators = new CreatorSubscriptions(provider);
    const listener = vi.fn();

    creators.subscribeEarnings('creator-1', listener);
    transport.emit(CREATORS_CHANNEL, { id: 'e1', creatorId: 'creator-1', displayName: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps creator updates and earnings subscriptions independent on unsubscribe', () => {
    const { transport, manager, provider } = setup();
    const creators = new CreatorSubscriptions(provider);
    const updates = vi.fn();
    const earnings = vi.fn();

    creators.subscribe('creator-1', updates);
    creators.subscribeEarnings('creator-1', earnings);

    creators.unsubscribeEarnings('creator-1');
    transport.emit(CREATORS_CHANNEL, { id: 'e1', creatorId: 'creator-1', displayName: 'Alice' });
    transport.emit(CREATORS_CHANNEL, { id: 'e2', creatorId: 'creator-1', totalEarnings: 3 });

    expect(updates).toHaveBeenCalledTimes(2);
    expect(earnings).not.toHaveBeenCalled();
    expect(manager.getListenerCount(CREATORS_CHANNEL, 'creator-1')).toBe(1);
  });

  it('routes payout updates', () => {
    const { transport, provider } = setup();
    const payouts = new PayoutSubscriptions(provider);
    const listener = vi.fn();

    payouts.subscribe('payout-1', listener);
    transport.emit(PAYOUTS_CHANNEL, { id: 'e1', payoutId: 'payout-1', status: 'paid' });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
