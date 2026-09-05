/**
 * Authentication Client Tests
 * Tests for auth-related SDK methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DorisioClient } from '../client';
import * as AuthMethods from './auth';

describe('Auth Methods', () => {
  let client: DorisioClient;
  const mockRequest = vi.fn();
  const mockSetToken = vi.fn();
  const mockClearToken = vi.fn();

  beforeEach(() => {
    client = {
      request: mockRequest,
      setToken: mockSetToken,
      clearToken: mockClearToken,
    } as any;

    // Bind methods
    client.refreshSession = AuthMethods.refreshSession.bind(client);
    client.validateSession = AuthMethods.validateSession.bind(client);
    client.getCurrentUser = AuthMethods.getCurrentUser.bind(client);
    client.logout = AuthMethods.logout.bind(client);
    client.isAuthenticated = AuthMethods.isAuthenticated.bind(client);
    client.extendSession = AuthMethods.extendSession.bind(client);
    client.getSessionExpiry = AuthMethods.getSessionExpiry.bind(client);

    mockRequest.mockClear();
    mockSetToken.mockClear();
    mockClearToken.mockClear();
  });

  describe('refreshSession', () => {
    it('should refresh session and update token', async () => {
      const mockSession = {
        userId: 'user-123',
        email: 'user@example.com',
        token: 'new-token-xyz',
        expiresAt: '2024-01-02T00:00:00Z',
        expiresIn: 3600,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      const result = await client.refreshSession();

      expect(result.token).toBe('new-token-xyz');
      expect(mockSetToken).toHaveBeenCalledWith('new-token-xyz');
      expect(mockRequest).toHaveBeenCalledWith('POST', '/auth/refresh');
    });

    it('should throw error on failed refresh', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Session expired' },
      });

      await expect(client.refreshSession()).rejects.toThrow('Failed to refresh session');
    });
  });

  describe('validateSession', () => {
    it('should validate current session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockUser,
      });

      const result = await client.validateSession();

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/auth/validate');
    });

    it('should throw error if session invalid', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Token expired' },
      });

      await expect(client.validateSession()).rejects.toThrow('Invalid or expired session');
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockUser,
      });

      const result = await client.getCurrentUser();

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/users/me');
    });

    it('should throw error on failed fetch', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Unauthorized' },
      });

      await expect(client.getCurrentUser()).rejects.toThrow('Failed to fetch current user');
    });
  });

  describe('logout', () => {
    it('should logout and clear token on success', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: {},
      });

      await client.logout();

      expect(mockRequest).toHaveBeenCalledWith('POST', '/auth/logout');
      expect(mockClearToken).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if session valid', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: { id: 'user-123' },
      });

      const result = await client.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false if session invalid', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Invalid session' },
      });

      const result = await client.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const result = await client.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('should extend session and update token', async () => {
      const mockSession = {
        userId: 'user-123',
        email: 'user@example.com',
        token: 'extended-token-abc',
        expiresAt: '2024-01-03T00:00:00Z',
        expiresIn: 7200,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      const result = await client.extendSession();

      expect(result.expiresIn).toBe(7200);
      expect(mockSetToken).toHaveBeenCalledWith('extended-token-abc');
      expect(mockRequest).toHaveBeenCalledWith('POST', '/auth/extend');
    });

    it('should throw error on failed extend', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Cannot extend expired session' },
      });

      await expect(client.extendSession()).rejects.toThrow('Failed to extend session');
    });
  });

  describe('getSessionExpiry', () => {
    it('should fetch session expiry info', async () => {
      const mockExpiry = {
        expiresAt: '2024-01-02T00:00:00Z',
        expiresIn: 3600,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockExpiry,
      });

      const result = await client.getSessionExpiry();

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresIn).toBe(3600);
      expect(result.isExpired).toBe(false);
    });

    it('should mark session as expired if expiresIn <= 0', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: {
          expiresAt: '2024-01-01T00:00:00Z',
          expiresIn: -100,
        },
      });

      const result = await client.getSessionExpiry();

      expect(result.isExpired).toBe(true);
      expect(result.expiresIn).toBe(0);
    });

    it('should throw error on failed fetch', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Unauthorized' },
      });

      await expect(client.getSessionExpiry()).rejects.toThrow('Failed to fetch session expiry');
    });
  });
});
