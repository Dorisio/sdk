import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DorisioClient } from '../client';
import { Creator, User, Wallet, Transaction } from '../types/models';
import { normalizeCreator, normalizeUser, normalizeWallet, normalizeTransaction } from '../utils/normalizers';
import { CreatorMapper, UserMapper, WalletMapper, TransactionMapper } from '../utils/mappers';

// Define custom extended types for an integrating platform
interface CustomCreator extends Creator {
  socialLinks: { twitter?: string; github?: string };
  tier: 'silver' | 'gold' | 'platinum';
}

interface CustomUser extends User {
  customField: string;
  preferences: { theme: 'light' | 'dark' };
}

interface CustomWallet extends Wallet {
  network: 'public' | 'testnet';
}

interface CustomTransaction extends Transaction {
  metadata: { note?: string };
}

describe('Issue #19 Custom Generic Types Integration', () => {
  let client: DorisioClient;

  beforeEach(() => {
    client = new DorisioClient({
      baseUrl: 'https://api.dorisio.com',
      token: 'test-token',
    });
  });

  it('should support custom Creator type in client.getCreator and normalizers', async () => {
    const mockData = {
      id: 'c-100',
      userId: 'u-100',
      username: 'custom_creator',
      displayName: 'Custom Creator',
      bio: 'Bio text',
      avatar: 'https://example.com/avatar.png',
      verified: true,
      isPublic: true,
      totalEarnings: 1500,
      pendingBalance: 200,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      socialLinks: { twitter: '@custom' },
      tier: 'gold',
    };

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      success: true,
      data: mockData,
      timestamp: '2025-01-01T00:00:00Z',
    });

    const creator = await client.getCreator<CustomCreator>('c-100');
    expect(creator.id).toBe('c-100');
    expect(creator.username).toBe('custom_creator');
    expect(creator.verified).toBe(true);

    const normalized = normalizeCreator<CustomCreator>(mockData);
    expect(normalized.id).toBe('c-100');

    const mapped = CreatorMapper.fromApi<CustomCreator>(mockData);
    expect(mapped.id).toBe('c-100');
  });

  it('should support custom User type in client.getCurrentUser and normalizers', async () => {
    const mockData = {
      id: 'u-100',
      email: 'custom@example.com',
      name: 'Custom User',
      role: 'fan' as const,
      verified: true,
      avatar: null,
      createdAt: '2025-01-01T00:00:00Z',
      customField: 'custom-val',
      preferences: { theme: 'dark' as const },
    };

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      success: true,
      data: mockData,
      timestamp: '2025-01-01T00:00:00Z',
    });

    const user = await client.getCurrentUser<CustomUser>();
    expect(user.id).toBe('u-100');
    expect(user.email).toBe('custom@example.com');

    const normalized = normalizeUser<CustomUser>(mockData);
    expect(normalized.id).toBe('u-100');

    const mapped = UserMapper.fromApi<CustomUser>(mockData);
    expect(mapped.id).toBe('u-100');
  });

  it('should support custom Wallet type in client.connectWallet and normalizers', async () => {
    const mockData = {
      id: 'w-100',
      userId: 'u-100',
      publicKey: 'GABC123456789',
      name: 'My Custom Wallet',
      verified: true,
      createdAt: '2025-01-01T00:00:00Z',
      network: 'public',
    };

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      success: true,
      data: mockData,
      timestamp: '2025-01-01T00:00:00Z',
    });

    const wallet = await client.connectWallet<CustomWallet>({
      publicKey: 'GABC123456789',
      name: 'My Custom Wallet',
    });
    expect(wallet.id).toBe('w-100');
    expect(wallet.publicKey).toBe('GABC123456789');

    const normalized = normalizeWallet<CustomWallet>(mockData);
    expect(normalized.id).toBe('w-100');

    const mapped = WalletMapper.fromApi<CustomWallet>(mockData);
    expect(mapped.id).toBe('w-100');
  });

  it('should support custom Transaction type in client.createTip and normalizers', async () => {
    const mockData = {
      id: 'tx-100',
      fromUserId: 'u-100',
      creatorId: 'c-100',
      amount: 50,
      message: 'Keep it up!',
      status: 'confirmed' as const,
      stellarTxHash: 'hash123',
      createdAt: '2025-01-01T00:00:00Z',
      metadata: { note: 'special tip' },
    };

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      success: true,
      data: mockData,
      timestamp: '2025-01-01T00:00:00Z',
    });

    const tx = await client.createTip<CustomTransaction>({
      creatorId: 'c-100',
      amount: 50,
    });
    expect(tx.id).toBe('tx-100');
    expect(tx.amount).toBe(50);

    const normalized = normalizeTransaction<CustomTransaction>(mockData);
    expect(normalized.id).toBe('tx-100');

    const mapped = TransactionMapper.fromApi<CustomTransaction>(mockData);
    expect(mapped.id).toBe('tx-100');
  });
});
