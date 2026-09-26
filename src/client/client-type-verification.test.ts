import { describe, it, expect } from 'vitest';
import { DorisioClient } from '../client';

describe('DorisioClient Method Implementations (#17)', () => {
  it('has non-declare real class method implementations on prototype', () => {
    const proto = DorisioClient.prototype;
    expect(typeof proto.getCreator).toBe('function');
    expect(typeof proto.listCreators).toBe('function');
    expect(typeof proto.getCreatorProfile).toBe('function');
    expect(typeof proto.verifyCreator).toBe('function');

    expect(typeof proto.connectWallet).toBe('function');
    expect(typeof proto.disconnectWallet).toBe('function');
    expect(typeof proto.getWallets).toBe('function');
    expect(typeof proto.getWallet).toBe('function');
    expect(typeof proto.updateWallet).toBe('function');
    expect(typeof proto.verifyWallet).toBe('function');
    expect(typeof proto.getWalletBalance).toBe('function');

    expect(typeof proto.createTip).toBe('function');
    expect(typeof proto.getTipStatus).toBe('function');
    expect(typeof proto.getTransactionHistory).toBe('function');
    expect(typeof proto.getCreatorTipsReceived).toBe('function');
    expect(typeof proto.buildPaymentTransaction).toBe('function');
    expect(typeof proto.submitPaymentTransaction).toBe('function');
    expect(typeof proto.checkTransactionConfirmation).toBe('function');
    expect(typeof proto.updateTipStatus).toBe('function');

    expect(typeof proto.getFullTransactionHistory).toBe('function');
    expect(typeof proto.getTransactionStats).toBe('function');
    expect(typeof proto.getCreatorEarnings).toBe('function');
    expect(typeof proto.exportTransactionHistory).toBe('function');

    expect(typeof proto.getBalance).toBe('function');
    expect(typeof proto.getCreatorPendingPayout).toBe('function');
    expect(typeof proto.canPayout).toBe('function');
    expect(typeof proto.getAccountSummary).toBe('function');

    expect(typeof proto.requestCreatorVerification).toBe('function');
    expect(typeof proto.getCreatorVerificationStatus).toBe('function');
    expect(typeof proto.getWalletVerificationStatus).toBe('function');
    expect(typeof proto.requestWalletVerificationChallenge).toBe('function');
    expect(typeof proto.isTransactionVerified).toBe('function');

    expect(typeof proto.refreshSession).toBe('function');
    expect(typeof proto.validateSession).toBe('function');
    expect(typeof proto.getCurrentUser).toBe('function');
    expect(typeof proto.logout).toBe('function');
    expect(typeof proto.isAuthenticated).toBe('function');
    expect(typeof proto.extendSession).toBe('function');
    expect(typeof proto.getSessionExpiry).toBe('function');
  });

  it('delegates calls correctly from client instances', async () => {
    const client = new DorisioClient({
      baseUrl: 'https://api.dorisio.com',
      mode: 'sandbox',
    });

    const creator = await client.getCreator('creator-1');
    expect(creator).toBeDefined();
    expect(creator.id).toBeDefined();

    const user = await client.getCurrentUser();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });
});
