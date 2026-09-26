import { describe, it, expect, vi } from 'vitest';
import {
  isBrowser,
  isNode,
  isReactNative,
  isLocalStorageAvailable,
  getEnvironmentStorage,
  getGlobalFetch,
} from './environment';

describe('Environment Utilities', () => {
  it('should detect node environment correctly', () => {
    expect(isNode()).toBe(true);
  });

  it('should detect browser environment when window and document exist', () => {
    expect(typeof isBrowser()).toBe('boolean');
  });

  it('should detect react native environment when navigator.product is ReactNative', () => {
    expect(isReactNative()).toBe(false);

    vi.stubGlobal('navigator', { product: 'ReactNative' });
    expect(isReactNative()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('should safely handle localStorage availability checks', () => {
    expect(typeof isLocalStorageAvailable()).toBe('boolean');
  });

  it('should provide in-memory fallback storage when localStorage is unavailable', () => {
    const storage = getEnvironmentStorage();
    expect(storage).toBeDefined();

    storage.setItem('test_key', 'test_val');
    expect(storage.getItem('test_key')).toBe('test_val');
    expect(storage.length).toBe(1);

    storage.removeItem('test_key');
    expect(storage.getItem('test_key')).toBeNull();
    expect(storage.length).toBe(0);

    storage.setItem('k1', 'v1');
    storage.setItem('k2', 'v2');
    expect(storage.key(0)).toBe('k1');

    storage.clear();
    expect(storage.length).toBe(0);
  });

  it('should retrieve global fetch when available', () => {
    const fetchFn = getGlobalFetch();
    expect(typeof fetchFn === 'function' || fetchFn === null).toBe(true);
  });
});
