/**
 * Authentication Methods
 *
 * SDK methods for session and token management.
 */

import { User } from '../types/models';
import { normalizeUser } from '../utils/normalizers';
import { DorisioClient } from '../client';

export interface SessionInfo {
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  expiresIn: number;
}

/**
 * Refresh user session and get new token
 */
export async function refreshSession(this: DorisioClient): Promise<SessionInfo> {
  const response = await this.request('POST', '/auth/refresh');

  if (!response.success || !response.data) {
    throw new Error('Failed to refresh session');
  }

  const data = response.data as any;

  // Update client token if provided
  if (data.token) {
    this.setToken(data.token);
  }

  return {
    userId: data.userId,
    email: data.email,
    token: data.token,
    expiresAt: data.expiresAt,
    expiresIn: data.expiresIn || 3600,
  };
}

/**
 * Validate current session
 */
export async function validateSession(this: DorisioClient): Promise<User> {
  const response = await this.request('GET', '/auth/validate');

  if (!response.success || !response.data) {
    throw new Error('Invalid or expired session');
  }

  return normalizeUser(response.data);
}

/**
 * Get current user info
 */
export async function getCurrentUser(this: DorisioClient): Promise<User> {
  const response = await this.request('GET', '/users/me');

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch current user');
  }

  return normalizeUser(response.data);
}

/**
 * Logout and invalidate session
 */
export async function logout(this: DorisioClient): Promise<void> {
  try {
    await this.request('POST', '/auth/logout');
  } finally {
    // Clear token regardless of response
    this.clearToken();
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(this: DorisioClient): Promise<boolean> {
  try {
    await this.validateSession();
    return true;
  } catch {
    return false;
  }
}

/**
 * Extend session expiry (keep-alive)
 */
export async function extendSession(this: DorisioClient): Promise<SessionInfo> {
  const response = await this.request('POST', '/auth/extend');

  if (!response.success || !response.data) {
    throw new Error('Failed to extend session');
  }

  const data = response.data as any;

  // Update token if provided
  if (data.token) {
    this.setToken(data.token);
  }

  return {
    userId: data.userId,
    email: data.email,
    token: data.token,
    expiresAt: data.expiresAt,
    expiresIn: data.expiresIn || 3600,
  };
}

/**
 * Get session expiry time
 */
export async function getSessionExpiry(this: DorisioClient): Promise<{
  expiresAt: string;
  expiresIn: number;
  isExpired: boolean;
}> {
  const response = await this.request('GET', '/auth/expiry');

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch session expiry');
  }

  const d = response.data as any;
  const expiresIn = Math.max(0, d.expiresIn || 0);
  const isExpired = expiresIn <= 0;

  return {
    expiresAt: d.expiresAt,
    expiresIn,
    isExpired,
  };
}
