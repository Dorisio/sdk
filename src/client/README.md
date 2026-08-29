# Dorisio SDK Client Methods

Comprehensive guide to all DorisioClient methods for interacting with the Dorisio API.

## Initialization

```typescript
import { DorisioClient } from '@Dorisio/sdk';

const client = new DorisioClient({
  baseUrl: 'https://api.Dorisio.io',
  token: 'your-jwt-token', // optional, can be set later
  timeout: 30000, // optional, default 30s
});
```

## Authentication Methods

### refreshSession()

Refresh user session and get a new token.

```typescript
const session = await client.refreshSession();
// { userId, email, token, expiresAt, expiresIn }
```

### validateSession()

Validate current session.

```typescript
const user = await client.validateSession();
```

### getCurrentUser()

Get current user info.

```typescript
const user = await client.getCurrentUser();
```

### logout()

Logout and invalidate session.

```typescript
await client.logout();
client.clearToken(); // Clear from client
```

### isAuthenticated()

Check if user is authenticated.

```typescript
const authenticated = await client.isAuthenticated();
```

### extendSession()

Keep-alive to extend session expiry.

```typescript
const session = await client.extendSession();
```

### getSessionExpiry()

Get session expiry time.

```typescript
const expiry = await client.getSessionExpiry();
// { expiresAt, expiresIn, isExpired }
```

## Creator Methods

### getCreator(creatorId)

Get creator by ID.

```typescript
const creator = await client.getCreator('creator-id');
```

### listCreators(options?)

List creators with pagination.

```typescript
const result = await client.listCreators({
  page: 1,
  pageSize: 20,
  verified: true, // optional
});
// { creators, total, page, pageSize }
```

### getCreatorProfile(username)

Get public creator profile by username.

```typescript
const profile = await client.getCreatorProfile('username');
// includes stats: { totalTips, averageTip, lastTipDate }
```

### verifyCreator(creatorId)

Verify creator identity (admin only).

```typescript
const creator = await client.verifyCreator('creator-id');
```

### getCreatorVerificationStatus(creatorId)

Get creator verification status.

```typescript
const status = await client.getCreatorVerificationStatus('creator-id');
// { verified, verifiedAt, expiresAt, status }
```

### requestCreatorVerification(creatorId, data)

Request creator verification (submit for review).

```typescript
const status = await client.requestCreatorVerification('creator-id', {
  documentType: 'government_id',
  documentUrl: 'https://...',
  description: 'Optional notes',
});
```

### getCreatorEarnings(creatorId)

Get creator earnings summary.

```typescript
const earnings = await client.getCreatorEarnings('creator-id');
// { totalEarnings, pendingBalance, confirmedBalance, transactionCount }
```

## Wallet Methods

### connectWallet(data)

Connect a wallet to user account.

```typescript
const wallet = await client.connectWallet({
  publicKey: 'GXXXXX...',
  name: 'My Stellar Wallet', // optional
});
```

### disconnectWallet(walletId)

Disconnect a wallet from user account.

```typescript
await client.disconnectWallet('wallet-id');
```

### getWallets(userId)

Get user's wallets.

```typescript
const wallets = await client.getWallets('user-id');
```

### getWallet(walletId)

Get wallet by ID.

```typescript
const wallet = await client.getWallet('wallet-id');
```

### updateWallet(walletId, data)

Update wallet details.

```typescript
const wallet = await client.updateWallet('wallet-id', {
  name: 'Updated Name',
});
```

### verifyWallet(walletId, proof)

Verify wallet ownership (challenge/response).

```typescript
const wallet = await client.verifyWallet('wallet-id', 'signature-proof');
```

### getWalletVerificationStatus(walletId)

Get wallet verification status.

```typescript
const status = await client.getWalletVerificationStatus('wallet-id');
// { verified, verifiedAt, expiresAt }
```

### requestWalletVerificationChallenge(walletId)

Request wallet verification challenge.

```typescript
const challenge = await client.requestWalletVerificationChallenge('wallet-id');
// { challenge, expiresIn }
```

## Transaction Methods

### createTip(data)

Create a tip transaction.

```typescript
const transaction = await client.createTip({
  creatorId: 'creator-id',
  amount: 10.5,
  message: 'Great content!', // optional
  fromWalletId: 'wallet-id',
  toWalletId: 'creator-wallet-id',
});
```

### getTipStatus(transactionId)

Get transaction status.

```typescript
const transaction = await client.getTipStatus('tx-id');
```

### getTransactionHistory(options?)

Get transaction history with filters.

```typescript
const history = await client.getTransactionHistory({
  userId: 'user-id',
  creatorId: 'creator-id',
  page: 1,
  pageSize: 20,
  status: 'confirmed',
});
// { transactions, total, page, pageSize }
```

### getUserTipsSent(userId, options?)

Get user's tips sent.

```typescript
const history = await client.getUserTipsSent('user-id', {
  page: 1,
  pageSize: 20,
});
```

### getCreatorTipsReceived(creatorId, options?)

Get creator's tips received.

```typescript
const history = await client.getCreatorTipsReceived('creator-id', {
  page: 1,
  pageSize: 20,
});
```

### retryTransaction(transactionId)

Retry failed transaction.

```typescript
const transaction = await client.retryTransaction('tx-id');
```

### isTransactionVerified(transactionId)

Check if transaction is verified.

```typescript
const verified = await client.isTransactionVerified('tx-id');
```

## Balance Methods

### getBalance(userId)

Get user's total balance across all wallets.

```typescript
const balance = await client.getBalance('user-id');
// { total, available, pending, wallets }
```

### getWalletBalance(walletId)

Get single wallet balance.

```typescript
const balance = await client.getWalletBalance('wallet-id');
// { walletId, available, pending, total, currency }
```

### getCreatorPendingPayout(creatorId)

Get creator's pending payout.

```typescript
const payout = await client.getCreatorPendingPayout('creator-id');
// { pending, nextPayoutDate, minimumThreshold }
```

### canPayout(creatorId)

Check if minimum payout threshold is reached.

```typescript
const canPayout = await client.canPayout('creator-id');
```

### getAccountSummary()

Get account summary with balance and stats.

```typescript
const summary = await client.getAccountSummary();
// { userId, email, role, balance, totalTipsSent, totalEarnings, lastActivityDate }
```

## History & Stats Methods

### getFullTransactionHistory(options?)

Get full transaction history with advanced filtering.

```typescript
const history = await client.getFullTransactionHistory({
  page: 1,
  pageSize: 20,
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  status: 'confirmed',
});
```

### getTransactionStats(userId?)

Get transaction statistics.

```typescript
const stats = await client.getTransactionStats('user-id');
// { totalTransactions, totalAmount, averageAmount, lastTransactionDate }
```

### exportTransactionHistory(options?)

Export transaction history (CSV or JSON).

```typescript
const data = await client.exportTransactionHistory({
  format: 'csv', // or 'json'
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
});
```

## Error Handling

All methods throw errors on failure. Use try/catch:

```typescript
try {
  const creator = await client.getCreator('id');
} catch (error) {
  console.error('Failed to fetch creator:', error.message);
}
```

## Token Management

```typescript
// Set token
client.setToken('new-jwt-token');

// Clear token
client.clearToken();

// Get config
const config = client.getConfig();
```
