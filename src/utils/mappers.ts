/**
 * Response Mappers
 *
 * Transforms backend responses into SDK models.
 * Uses the same Zod-backed normalizers under the hood — no `any` at the
 * boundary; unknown data is narrowed before access.
 */

import { Creator, User, Transaction, Wallet, TransactionHistory } from '../types/models';
import {
  normalizeCreator,
  normalizeUser,
  normalizeTransaction,
  normalizeWallet,
} from './normalizers';

/**
 * Creator response mapper.
 *
 * @example
 * ```ts
 * const creator = CreatorMapper.fromApi(rawResponseData);
 * ```
 */
export class CreatorMapper {
  /**
   * Map backend creator response to SDK Creator model.
   *
   * @param data - Raw API payload
   * @returns Normalized Creator object
   * @throws {ZodError} If data schema validation fails
   */
  static fromApi<TCreator = Creator>(data: unknown): TCreator {
    return normalizeCreator<TCreator>(data);
  }

  /**
   * Map array of raw creator responses to SDK Creator models.
   *
   * @param data - Array of raw API creator payloads
   * @returns Array of normalized Creator objects
   * @throws {ZodError} If data schema validation fails for any element
   */
  static fromApiArray<TCreator = Creator>(data: unknown[]): TCreator[] {
    return data.map((item) => this.fromApi<TCreator>(item));
  }
}

/**
 * User response mapper.
 *
 * @example
 * ```ts
 * const user = UserMapper.fromApi(rawResponseData);
 * ```
 */
export class UserMapper {
  /**
   * Map backend user response to SDK User model.
   *
   * @param data - Raw API payload
   * @returns Normalized User object
   * @throws {ZodError} If data schema validation fails
   */
  static fromApi<TUser = User>(data: unknown): TUser {
    return normalizeUser<TUser>(data);
  }
}

/**
 * Transaction response mapper.
 *
 * @example
 * ```ts
 * const tx = TransactionMapper.fromApi(rawResponseData);
 * ```
 */
export class TransactionMapper {
  /**
   * Map backend transaction response to SDK Transaction model.
   *
   * @param data - Raw API payload
   * @returns Normalized Transaction object
   * @throws {ZodError} If data schema validation fails
   */
  static fromApi<TTransaction = Transaction>(data: unknown): TTransaction {
    return normalizeTransaction<TTransaction>(data);
  }

  /**
   * Map array of raw transaction responses to SDK Transaction models.
   *
   * @param data - Array of raw API transaction payloads
   * @returns Array of normalized Transaction objects
   * @throws {ZodError} If data schema validation fails for any element
   */
  static fromApiArray<TTransaction = Transaction>(data: unknown[]): TTransaction[] {
    return data.map((item) => this.fromApi<TTransaction>(item));
  }

  /**
   * Map transaction history envelope response.
   *
   * @param data - Raw transaction history API payload
   * @returns TransactionHistory envelope object
   */
  static mapHistory<TTransaction = Transaction>(data: unknown): TransactionHistory<TTransaction> {
    if (!data || typeof data !== 'object') {
      return { transactions: [], total: 0, page: 1, pageSize: 20 };
    }
    const obj = data as Record<string, unknown>;
    return {
      transactions: this.fromApiArray<TTransaction>(Array.isArray(obj['transactions']) ? obj['transactions'] : []),
      total: Number(obj['total'] ?? 0),
      page: Number(obj['page'] ?? 1),
      pageSize: Number(obj['pageSize'] ?? 20),
    };
  }
}

/**
 * Wallet response mapper.
 *
 * @example
 * ```ts
 * const wallet = WalletMapper.fromApi(rawResponseData);
 * ```
 */
export class WalletMapper {
  /**
   * Map backend wallet response to SDK Wallet model.
   *
   * @param data - Raw API payload
   * @returns Normalized Wallet object
   * @throws {ZodError} If data schema validation fails
   */
  static fromApi<TWallet = Wallet>(data: unknown): TWallet {
    return normalizeWallet<TWallet>(data);
  }

  /**
   * Map array of raw wallet responses to SDK Wallet models.
   *
   * @param data - Array of raw API wallet payloads
   * @returns Array of normalized Wallet objects
   * @throws {ZodError} If data schema validation fails for any element
   */
  static fromApiArray<TWallet = Wallet>(data: unknown[]): TWallet[] {
    return data.map((item) => this.fromApi<TWallet>(item));
  }
}

/**
 * Universal response mapper for dynamic endpoint decoding.
 *
 * @example
 * ```ts
 * const creator = ResponseMapper.mapResponse(data, 'creator');
 * ```
 */
export class ResponseMapper {
  /**
   * Map response object based on specified type discriminator.
   *
   * @param data - Raw API payload
   * @param type - Type discriminator string ('creator' | 'user' | 'transaction' | 'wallet')
   * @returns Mapped domain model instance
   */
  static mapResponse<T>(data: unknown, type: string): T {
    switch (type) {
      case 'creator':
        return CreatorMapper.fromApi(data) as T;
      case 'user':
        return UserMapper.fromApi(data) as T;
      case 'transaction':
        return TransactionMapper.fromApi(data) as T;
      case 'wallet':
        return WalletMapper.fromApi(data) as T;
      default:
        return data as T;
    }
  }
}
