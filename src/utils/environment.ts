/**
 * Environment Detection & Runtime Guard Utilities
 *
 * Safe environment detection helpers for Node.js, Browser, Next.js (SSR/SSG),
 * and React Native runtimes. Prevents runtime exceptions when window,
 * document, or localStorage are accessed in non-browser execution contexts.
 */

/**
 * Check if current execution environment is a browser runtime.
 *
 * @returns True if window and document are defined
 *
 * @example
 * ```ts
 * if (isBrowser()) {
 *   console.log('Running in browser');
 * }
 * ```
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Check if current execution environment is Node.js.
 *
 * @returns True if process and process.versions.node are present
 *
 * @example
 * ```ts
 * if (isNode()) {
 *   console.log('Running in Node.js');
 * }
 * ```
 */
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions !== undefined &&
    process.versions.node !== undefined
  );
}

/**
 * Check if current execution environment is React Native.
 *
 * @returns True if navigator.product is 'ReactNative'
 *
 * @example
 * ```ts
 * if (isReactNative()) {
 *   console.log('Running in React Native');
 * }
 * ```
 */
export function isReactNative(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as unknown as { product?: string }).product === 'ReactNative'
  );
}

/**
 * Check if localStorage is safely accessible in current context without throwing.
 *
 * @returns True if localStorage is defined and writeable
 *
 * @example
 * ```ts
 * if (isLocalStorageAvailable()) {
 *   localStorage.setItem('key', 'val');
 * }
 * ```
 */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return false;
    }
    const testKey = '__dorisio_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * In-memory storage fallback implementation for environments without localStorage.
 */
class InMemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/**
 * Get safe storage implementation (returns localStorage if available, or in-memory fallback).
 *
 * @returns Storage implementation
 *
 * @example
 * ```ts
 * const storage = getEnvironmentStorage();
 * storage.setItem('token', 'abc');
 * ```
 */
export function getEnvironmentStorage(): Storage {
  if (isLocalStorageAvailable()) {
    return window.localStorage;
  }
  return new InMemoryStorage();
}

/**
 * Get native fetch implementation or return null if fetch is unavailable.
 *
 * @returns Fetch function or null
 *
 * @example
 * ```ts
 * const fetchFn = getGlobalFetch();
 * if (!fetchFn) {
 *   throw new Error('Native fetch is not available in this environment');
 * }
 * ```
 */
export function getGlobalFetch(): typeof fetch | null {
  if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
    return globalThis.fetch;
  }
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch;
  }
  return null;
}
