/**
 * Response Normalizers
 *
 * Ensures consistent data structure across SDK responses.
 * All raw API data is validated through Zod schemas before mapping
 * to SDK domain models, so shape mismatches surface at the boundary.
 */

import {
  Creator,
  CreatorProfile,
  Transaction,
  TransactionHistory,
  User,
  Wallet,
} from '../types/models';
import {
  ApiCreatorSchema,
  ApiListCreatorsSchema,
  ApiTransactionHistorySchema,
  ApiTransactionSchema,
  ApiUserSchema,
  ApiWalletSchema,
  PaymentSchemas,
  type CreateTipInput,
} from '../types/schemas';

/**
 * Normalize creator profile.
 * Ensures all optional fields have defaults and validates raw input if necessary.
 *
 * @param creator - Creator entity or raw creator data
 * @returns Normalized CreatorProfile
 *
 * @example
 * ```ts
 * import { normalizeCreatorProfile } from '@dorisio/sdk';
 *
 * const profile = normalizeCreatorProfile(creatorData);
 * ```
 */
export function normalizeCreatorProfile(creator: Creator | unknown): CreatorProfile {
  const isCreatorObj =
    creator !== null &&
    typeof creator === 'object' &&
    'id' in creator &&
    typeof (creator as Record<string, unknown>)['id'] === 'string';
  const normalized = isCreatorObj ? normalizeCreator(creator) : normalizeCreator(creator);

  return {
    ...normalized,
    displayName: normalized.displayName ?? '',
    bio: normalized.bio ?? '',
    avatar: normalized.avatar ?? null,
    stats: {
      totalTips: 0,
      averageTip: 0,
      lastTipDate: null,
    },
  };
}

/**
 * Normalize and validate create-tip input against PaymentSchemas.createTip.
 *
 * @param data - Raw create tip input data
 * @returns Validated CreateTipInput
 *
 * @example
 * ```ts
 * import { normalizeCreateTip } from '@dorisio/sdk';
 *
 * const validatedInput = normalizeCreateTip({
 *   amount: 25,
 *   currency: 'USD',
 *   creatorId: '550e8400-e29b-41d4-a716-446655440000',
 *   message: 'Awesome work!',
 * });
 * ```
 */
export function normalizeCreateTip(data: unknown): CreateTipInput {
  return PaymentSchemas.createTip.parse(data);
}

/**
 * Alias for normalizeCreateTip for explicit input naming.
 *
 * @param data - Raw create tip input data
 * @returns Validated CreateTipInput
 *
 * @example
 * ```ts
 * import { normalizeCreateTipInput } from '@dorisio/sdk';
 *
 * const validated = normalizeCreateTipInput(rawInput);
 * ```
 */
export function normalizeCreateTipInput(data: unknown): CreateTipInput {
  return PaymentSchemas.createTip.parse(data);
}

/**
 * Normalize creator from raw API response.
 * Validates against ApiCreatorSchema before mapping.
 *
 * @param data - Raw creator API payload
 * @returns Normalized Creator model object
 * @throws {ZodError} If raw data does not match ApiCreatorSchema
 *
 * @example
 * ```ts
 * const creator = normalizeCreator(rawData);
 * ```
 */
export function normalizeCreator<TCreator = Creator>(data: unknown): TCreator {
  const parsed = ApiCreatorSchema.parse(data);
  return {
    id: parsed.id,
    userId: parsed.userId,
    username: parsed.username,
    displayName: parsed.displayName ?? null,
    bio: parsed.bio ?? null,
    avatar: parsed.avatar ?? null,
    verified: parsed.verified,
    isPublic: parsed.isPublic,
    totalEarnings: parsed.totalEarnings,
    pendingBalance: parsed.pendingBalance,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  } as unknown as TCreator;
}

/**
 * Normalize array of creators.
 *
 * @param data - Raw array payload
 * @returns Array of normalized Creator objects
 *
 * @example
 * ```ts
 * const creators = normalizeCreators(rawArray);
 * ```
 */
export function normalizeCreators<TCreator = Creator>(data: unknown): TCreator[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((item) => normalizeCreator<TCreator>(item));
}

/**
 * Normalize user from raw API response.
 * Validates against ApiUserSchema before mapping.
 *
 * @param data - Raw user API payload
 * @returns Normalized User model object
 * @throws {ZodError} If raw data does not match ApiUserSchema
 *
 * @example
 * ```ts
 * const user = normalizeUser(rawData);
 * ```
 */
export function normalizeUser<TUser = User>(data: unknown): TUser {
  const parsed = ApiUserSchema.parse(data);
  return {
    id: parsed.id,
    email: parsed.email,
    name: parsed.name ?? null,
    role: parsed.role,
    verified: parsed.verified,
    avatar: parsed.avatar ?? null,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  } as unknown as TUser;
}

/**
 * Normalize wallet from raw API response.
 * Validates against ApiWalletSchema before mapping.
 *
 * @param data - Raw wallet API payload
 * @returns Normalized Wallet model object
 * @throws {ZodError} If raw data does not match ApiWalletSchema
 *
 * @example
 * ```ts
 * const wallet = normalizeWallet(rawData);
 * ```
 */
export function normalizeWallet<TWallet = Wallet>(data: unknown): TWallet {
  const parsed = ApiWalletSchema.parse(data);
  return {
    id: parsed.id,
    userId: parsed.userId,
    publicKey: parsed.publicKey,
    name: parsed.name ?? null,
    verified: parsed.verified,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  } as unknown as TWallet;
}

/**
 * Normalize array of wallets.
 *
 * @param data - Raw array payload
 * @returns Array of normalized Wallet objects
 *
 * @example
 * ```ts
 * const wallets = normalizeWallets(rawArray);
 * ```
 */
export function normalizeWallets<TWallet = Wallet>(data: unknown): TWallet[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((item) => normalizeWallet<TWallet>(item));
}

/**
 * Normalize transaction from raw API response.
 * Validates against ApiTransactionSchema before mapping.
 *
 * @param data - Raw transaction API payload
 * @returns Normalized Transaction model object
 * @throws {ZodError} If raw data does not match ApiTransactionSchema
 *
 * @example
 * ```ts
 * const tx = normalizeTransaction(rawData);
 * ```
 */
export function normalizeTransaction<TTransaction = Transaction>(data: unknown): TTransaction {
  const parsed = ApiTransactionSchema.parse(data);

  // Map 'completed' (used by updateTipStatus endpoint) to 'confirmed' for the domain model
  const rawStatus = parsed.stellarStatus ?? parsed.status ?? 'pending';
  const status = (rawStatus === 'completed' ? 'confirmed' : rawStatus) as
    | 'pending'
    | 'confirmed'
    | 'failed';

  return {
    id: parsed.id,
    fromUserId: parsed.fromUserId,
    creatorId: parsed.creatorId,
    amount: parsed.amount,
    message: parsed.message ?? null,
    status,
    stellarTxHash: parsed.stellarTxHash ?? null,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  } as unknown as TTransaction;
}

/**
 * Normalize array of transactions.
 *
 * @param data - Raw array payload
 * @returns Array of normalized Transaction objects
 *
 * @example
 * ```ts
 * const transactions = normalizeTransactions(rawArray);
 * ```
 */
export function normalizeTransactions<TTransaction = Transaction>(data: unknown): TTransaction[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((item) => normalizeTransaction<TTransaction>(item));
}

/**
 * Normalize transaction history response.
 * Validates the entire envelope (including nested transactions) via Zod.
 *
 * @param data - Raw transaction history payload
 * @returns TransactionHistory envelope object
 * @throws {ZodError} If schema validation fails
 *
 * @example
 * ```ts
 * const history = normalizeTransactionHistory(rawData);
 * ```
 */
export function normalizeTransactionHistory<TTransaction = Transaction>(data: unknown): TransactionHistory<TTransaction> {
  const parsed = ApiTransactionHistorySchema.parse(data);
  return {
    transactions: parsed.transactions.map((tx) => normalizeTransaction<TTransaction>(tx)),
    total: parsed.total,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

/**
 * Normalize paginated list-creators response.
 * Validates through ApiListCreatorsSchema before mapping.
 *
 * @param data - Raw list-creators API payload
 * @returns Envelope containing creators array, total count, page, and pageSize
 * @throws {ZodError} If schema validation fails
 *
 * @example
 * ```ts
 * const result = normalizeListCreatorsResponse(rawData);
 * ```
 */
export function normalizeListCreatorsResponse<TCreator = Creator>(data: unknown): {
  creators: TCreator[];
  total: number;
  page: number;
  pageSize: number;
} {
  const parsed = ApiListCreatorsSchema.parse(data);
  return {
    creators: parsed.creators.map((c) => normalizeCreator<TCreator>(c)),
    total: parsed.total,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}
