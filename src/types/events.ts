/**
 * Real-time event type definitions (Issue #41)
 *
 * Typed payloads for the events the Dorisio backend pushes over WebSocket:
 * tip status changes, creator earnings updates, and payout progression.
 *
 * The payloads are intentionally permissive — every field except the resource
 * id is optional — so a server can add fields without breaking consumers.
 */

/** Channel carrying tip lifecycle updates. */
export const TIPS_CHANNEL = 'tips';

/** Channel carrying creator-level updates (profile + earnings). */
export const CREATORS_CHANNEL = 'creators';

/** Channel carrying payout updates. */
export const PAYOUTS_CHANNEL = 'payouts';

/** Channel reserved for earnings-only frames. */
export const EARNINGS_CHANNEL = 'earnings';

/** Channel carrying wallet balance updates. */
export const BALANCE_CHANNEL = 'balance';

/** Channel carrying transaction updates. */
export const TRANSACTIONS_CHANNEL = 'transactions';

/** Channel carrying user notifications. */
export const NOTIFICATIONS_CHANNEL = 'notifications';

/** Well-known channel names, keyed by domain. */
export const REALTIME_CHANNELS = {
  tips: TIPS_CHANNEL,
  creators: CREATORS_CHANNEL,
  payouts: PAYOUTS_CHANNEL,
  earnings: EARNINGS_CHANNEL,
  balance: BALANCE_CHANNEL,
  transactions: TRANSACTIONS_CHANNEL,
  notifications: NOTIFICATIONS_CHANNEL,
} as const;

/** Tip lifecycle states. Servers may emit additional values. */
export type TipStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Payout lifecycle states. Servers may emit additional values. */
export type PayoutStatus = 'queued' | 'processing' | 'paid' | 'failed' | 'cancelled';

/** Fields shared by every real-time payload. */
export interface RealtimeEventEnvelope {
  /**
   * Unique id assigned by the server. Used to de-duplicate events that are
   * replayed after a reconnect.
   */
  id?: string;
  /** Explicit event id, when the server keeps `id` for the resource. */
  eventId?: string;
  /** Event type discriminator, e.g. `tip.updated`. */
  type?: string;
  /** ISO-8601 timestamp. */
  timestamp?: string;
  /** Monotonic sequence number, when provided. */
  sequence?: number;
}

/** Payload pushed when a tip changes state. */
export interface TipUpdateEvent extends RealtimeEventEnvelope {
  tipId: string;
  status: TipStatus | string;
  fromUserId?: string;
  creatorId?: string;
  amount?: number;
  currency?: string;
  message?: string | null;
  stellarTxHash?: string | null;
  /** Amount credited to the creator after fees. */
  creatorEarnings?: number;
  /** Platform fee applied to the tip. */
  fee?: number;
}

/** Payload pushed when a creator's earnings change. */
export interface CreatorEarningsEvent extends RealtimeEventEnvelope {
  creatorId: string;
  totalEarnings?: number;
  pendingBalance?: number;
  availableBalance?: number;
  /** Incremental amount for the event, when the server sends deltas. */
  amount?: number;
  currency?: string;
  tipId?: string;
}

/** Payload pushed when a payout progresses. */
export interface PayoutUpdateEvent extends RealtimeEventEnvelope {
  payoutId: string;
  creatorId?: string;
  status?: PayoutStatus | string;
  amount?: number;
  currency?: string;
  stellarTxHash?: string | null;
}

/** Any payload the SDK knows how to route. */
export type DorisioRealtimeEvent = TipUpdateEvent | CreatorEarningsEvent | PayoutUpdateEvent;

export type TipUpdateListener = (event: TipUpdateEvent) => void;
export type CreatorEarningsListener = (event: CreatorEarningsEvent) => void;
export type PayoutUpdateListener = (event: PayoutUpdateEvent) => void;

/** Keys checked, in order, when extracting the resource id from a payload. */
const RESOURCE_ID_KEYS = ['tipId', 'creatorId', 'payoutId'] as const;

function asRecord(event: unknown): Record<string, unknown> | undefined {
  return event !== null && typeof event === 'object' ? (event as Record<string, unknown>) : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Extract the resource id a payload belongs to (`tipId`, `creatorId`,
 * `payoutId`, falling back to `id`).
 */
export function getEventResourceId(event: unknown): string | undefined {
  const record = asRecord(event);
  if (!record) return undefined;

  for (const key of RESOURCE_ID_KEYS) {
    const value = readString(record, key);
    if (value) return value;
  }
  return readString(record, 'id');
}

/**
 * Extract the unique event id used for de-duplication (`eventId` first, then
 * `id`).
 */
export function getEventId(event: unknown): string | undefined {
  const record = asRecord(event);
  if (!record) return undefined;
  return readString(record, 'eventId') ?? readString(record, 'id');
}

/** True when a payload looks like a creator earnings frame. */
export function isCreatorEarningsEvent(event: unknown): boolean {
  const record = asRecord(event);
  if (!record) return false;
  return (
    'totalEarnings' in record ||
    'pendingBalance' in record ||
    'availableBalance' in record ||
    'earnings' in record ||
    'amount' in record
  );
}
