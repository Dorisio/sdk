/**
 * Transactions Client Tests
 * Tests for transaction and tip-related SDK methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DorisioClient } from '../client';
import * as TransactionMethods from './transactions';

describe('Transaction Methods', () => {
  let client: DorisioClient;
  const mockRequest = vi.fn();

  beforeEach(() => {
    // Create a minimal client instance for testing
    client = {
      request: mockRequest,
      setToken: vi.fn(),
      clearToken: vi.fn(),
    } as any;

    // Bind methods to client
    client.createTip = TransactionMethods.createTip.bind(client);
    client.getTipStatus = TransactionMethods.getTipStatus.bind(client);
    client.getTransactionHistory = TransactionMethods.getTransactionHistory.bind(client);
    client.getCreatorTipsReceived = TransactionMethods.getCreatorTipsReceived.bind(client);
    client.buildPaymentTransaction = TransactionMethods.buildPaymentTransaction.bind(client);
    client.submitPaymentTransaction = TransactionMethods.submitPaymentTransaction.bind(client);
    client.checkTransactionConfirmation =
      TransactionMethods.checkTransactionConfirmation.bind(client);
    client.updateTipStatus = TransactionMethods.updateTipStatus.bind(client);

    mockRequest.mockClear();
  });

  describe('createTip', () => {
    it('should create a tip with valid data', async () => {
      const mockTip = {
        id: 'tip-123',
        senderId: 'user-123',
        creatorId: 'creator-456',
        amount: 100,
        message: 'Great content!',
        status: 'pending',
        transactionHash: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockTip,
      });

      const result = await client.createTip({
        creatorId: 'creator-456',
        amount: 100,
        message: 'Great content!',
      });

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('POST', '/api/v1/transactions/tip', {
        creatorId: 'creator-456',
        amount: 100,
        message: 'Great content!',
      });
    });

    it('should throw error if creator ID is missing', async () => {
      await expect(
        client.createTip({
          creatorId: '',
          amount: 100,
        })
      ).rejects.toThrow('Creator ID is required');
    });

    it('should throw error if amount is zero or negative', async () => {
      await expect(
        client.createTip({
          creatorId: 'creator-456',
          amount: 0,
        })
      ).rejects.toThrow('must be greater than 0');

      await expect(
        client.createTip({
          creatorId: 'creator-456',
          amount: -100,
        })
      ).rejects.toThrow('must be greater than 0');
    });

    it('should throw error on failed request', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Creator not found' },
      });

      await expect(
        client.createTip({
          creatorId: 'creator-invalid',
          amount: 100,
        })
      ).rejects.toThrow('Creator not found');
    });
  });

  describe('getTipStatus', () => {
    it('should fetch tip status by ID', async () => {
      const mockTip = {
        id: 'tip-123',
        status: 'confirmed',
        transactionHash: 'hash-abc123',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockTip,
      });

      const result = await client.getTipStatus('tip-123');

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/transactions/tip-123');
    });

    it('should throw error on failed request', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Tip not found' },
      });

      await expect(client.getTipStatus('tip-invalid')).rejects.toThrow('Tip not found');
    });
  });

  describe('getTransactionHistory', () => {
    it('should fetch transaction history with default options', async () => {
      const mockHistory = {
        transactions: [
          { id: 'tip-1', amount: 50 },
          { id: 'tip-2', amount: 100 },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockHistory,
      });

      const result = await client.getTransactionHistory();

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/transactions/history');
    });

    it('should fetch with pagination options', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: { transactions: [], total: 0 },
      });

      await client.getTransactionHistory({ page: 2, pageSize: 10 });

      expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/transactions/history?page=2&pageSize=10');
    });

    it('should throw error on failed request', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Unauthorized' },
      });

      await expect(client.getTransactionHistory()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getCreatorTipsReceived', () => {
    it('should fetch creator tips received', async () => {
      const mockHistory = {
        transactions: [{ id: 'tip-1', amount: 50 }],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockHistory,
      });

      const result = await client.getCreatorTipsReceived('creator-456');

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/transactions/creator/creator-456');
    });

    it('should handle pagination', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: { transactions: [], total: 0 },
      });

      await client.getCreatorTipsReceived('creator-456', { page: 3, pageSize: 15 });

      expect(mockRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/transactions/creator/creator-456?page=3&pageSize=15'
      );
    });
  });

  describe('buildPaymentTransaction', () => {
    it('should build payment transaction', async () => {
      const mockResponse = {
        transactionEnvelope: 'AAAAAgAAAAC7...',
        tipId: 'tip-123',
        fee: 100,
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await client.buildPaymentTransaction('tip-123', {
        senderPublicKey: 'GABC123',
        creatorPublicKey: 'GCREATOR123',
        amount: '100',
      });

      expect(result.transactionEnvelope).toBeDefined();
      expect(result.tipId).toBe('tip-123');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should throw error on failed build', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { message: 'Invalid wallet' },
      });

      await expect(
        client.buildPaymentTransaction('tip-123', {
          senderPublicKey: 'INVALID',
          creatorPublicKey: 'GCREATOR123',
          amount: '100',
        })
      ).rejects.toThrow('Invalid wallet');
    });
  });

  describe('submitPaymentTransaction', () => {
    it('should submit signed transaction', async () => {
      const mockResponse = {
        tipId: 'tip-123',
        transactionHash: 'hash123abc',
        status: 'pending',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await client.submitPaymentTransaction('tip-123', {
        transactionEnvelope: 'AAAAAgAAAAC7...',
      });

      expect(result.transactionHash).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should throw error if envelope missing', async () => {
      await expect(
        client.submitPaymentTransaction('tip-123', {
          transactionEnvelope: '',
        })
      ).rejects.toThrow('transaction envelope is required');
    });
  });

  describe('checkTransactionConfirmation', () => {
    it('should check transaction confirmation', async () => {
      const mockTip = {
        id: 'tip-123',
        status: 'confirmed',
        transactionHash: 'hash123',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockTip,
      });

      const result = await client.checkTransactionConfirmation('tip-123');

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('GET', '/api/v1/transactions/tip-123/confirm');
    });
  });

  describe('updateTipStatus', () => {
    it('should update tip status', async () => {
      const mockTip = {
        id: 'tip-123',
        status: 'completed',
      };

      mockRequest.mockResolvedValue({
        success: true,
        data: mockTip,
      });

      const result = await client.updateTipStatus('tip-123', 'completed');

      expect(result).toBeDefined();
      expect(mockRequest).toHaveBeenCalledWith('PATCH', '/api/v1/transactions/tip-123/status', {
        status: 'completed',
      });
    });

    it('should support all status values', async () => {
      mockRequest.mockResolvedValue({
        success: true,
        data: { id: 'tip-123', status: 'failed' },
      });

      const statuses: Array<'pending' | 'completed' | 'failed' | 'cancelled'> = [
        'pending',
        'completed',
        'failed',
        'cancelled',
      ];

      for (const status of statuses) {
        await client.updateTipStatus('tip-123', status);
        expect(mockRequest).toHaveBeenLastCalledWith('PATCH', '/api/v1/transactions/tip-123/status', {
          status,
        });
      }
    });
  });
});
