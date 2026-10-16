/**
 * Real-time event helper tests (Issue #41)
 */

import { describe, it, expect } from 'vitest';
import {
  REALTIME_CHANNELS,
  getEventId,
  getEventResourceId,
  isCreatorEarningsEvent,
} from './events';

describe('real-time channel constants', () => {
  it('exposes the well-known channels', () => {
    expect(REALTIME_CHANNELS).toEqual({
      tips: 'tips',
      creators: 'creators',
      payouts: 'payouts',
      earnings: 'earnings',
      balance: 'balance',
      transactions: 'transactions',
      notifications: 'notifications',
    });
  });
});

describe('getEventResourceId', () => {
  it('prefers tipId, then creatorId, then payoutId, then id', () => {
    expect(getEventResourceId({ tipId: 'tip-1', creatorId: 'creator-1', id: 'e1' })).toBe('tip-1');
    expect(getEventResourceId({ creatorId: 'creator-1', payoutId: 'payout-1', id: 'e1' })).toBe(
      'creator-1'
    );
    expect(getEventResourceId({ payoutId: 'payout-1', id: 'e1' })).toBe('payout-1');
    expect(getEventResourceId({ id: 'e1' })).toBe('e1');
  });

  it('ignores empty strings and non-string values', () => {
    expect(getEventResourceId({ tipId: '', creatorId: 42 })).toBeUndefined();
    expect(getEventResourceId({ tipId: null })).toBeUndefined();
  });

  it('returns undefined for non-object payloads', () => {
    expect(getEventResourceId(null)).toBeUndefined();
    expect(getEventResourceId('tip-1')).toBeUndefined();
    expect(getEventResourceId(undefined)).toBeUndefined();
  });
});

describe('getEventId', () => {
  it('prefers eventId over id', () => {
    expect(getEventId({ eventId: 'evt-1', id: 'tip-1' })).toBe('evt-1');
    expect(getEventId({ id: 'tip-1' })).toBe('tip-1');
  });

  it('returns undefined when no id is present', () => {
    expect(getEventId({ tipId: 'tip-1' })).toBeUndefined();
    expect(getEventId(42)).toBeUndefined();
  });
});

describe('isCreatorEarningsEvent', () => {
  it('detects earnings-shaped payloads', () => {
    expect(isCreatorEarningsEvent({ creatorId: 'c1', totalEarnings: 1 })).toBe(true);
    expect(isCreatorEarningsEvent({ creatorId: 'c1', pendingBalance: 1 })).toBe(true);
    expect(isCreatorEarningsEvent({ creatorId: 'c1', availableBalance: 1 })).toBe(true);
    expect(isCreatorEarningsEvent({ creatorId: 'c1', amount: 1 })).toBe(true);
  });

  it('rejects profile-only payloads', () => {
    expect(isCreatorEarningsEvent({ creatorId: 'c1', displayName: 'Alice' })).toBe(false);
    expect(isCreatorEarningsEvent(null)).toBe(false);
  });
});
