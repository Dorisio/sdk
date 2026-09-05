# Dorisio SDK

Platform-agnostic client library for payment and tipping infrastructure on Stellar.

## Features

- 🌐 **Platform-Agnostic**: Embeddable in any platform with REST API support
- 💰 **Tip Management**: Create, build, submit, and confirm tips on Stellar network
- 🔐 **Wallet Verification**: Challenge-response flow with Freighter wallet support
- ⚛️ **React Hooks**: First-class React integration with hooks layer
- 📦 **TypeScript**: Full type safety with comprehensive interfaces
- 🔄 **Transaction Lifecycle**: Complete payment flow from creation to confirmation

## Installation

```bash
npm install dorisio-sdk
```

## Quick Start

### Vanilla Client

```typescript
import { DorisioClient } from 'dorisio-sdk';

// Initialize client
const client = new DorisioClient({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token',
});

// Create a tip
const tip = await client.createTip({
  creatorId: 'creator-123',
  amount: 100,
  message: 'Great content!',
});

console.log('Tip created:', tip.id);
```

### React Integration

```typescript
import { DorisioProvider, useCreateTip, useWallet } from 'dorisio-sdk/react';

function App() {
  const client = new DorisioClient({
    baseUrl: 'https://api.example.com',
    token: userToken,
  });

  return (
    <DorisioProvider client={client} config={client.getConfig()}>
      <YourApp />
    </DorisioProvider>
  );
}

function TipComponent() {
  const { createTip, buildTransaction, submitTransaction, confirmTransaction, state } = useCreateTip();
  const { generateNonce, getChallenge, verifyWallet } = useWallet();

  const handleSendTip = async () => {
    // Step 1: Create tip
    const tip = await createTip({
      creatorId: 'creator-123',
      amount: 100,
    });

    // Step 2: Generate wallet nonce
    const { nonce } = await generateNonce(userPublicKey);

    // Step 3: Get challenge transaction
    const challenge = await getChallenge(nonce);

    // Step 4: Sign with Freighter (pseudocode)
    const signedChallenge = await signWithFreighter(challenge);

    // Step 5: Verify wallet (links wallet and signs challenge)
    const wallet = await verifyWallet(userPublicKey, nonce, signedChallenge);

    // Step 6: Build payment transaction
    const { transactionEnvelope } = await buildTransaction(tip.id, {
      senderPublicKey: wallet.publicKey,
      creatorPublicKey: creatorWallet.publicKey,
      amount: '100',
    });

    // Step 7: Sign with Freighter
    const signedTx = await signWithFreighter(transactionEnvelope);

    // Step 8: Submit signed transaction
    await submitTransaction(tip.id, signedTx);

    // Step 9: Confirm on blockchain
    const confirmed = await confirmTransaction(tip.id);
    console.log('Tip confirmed:', confirmed);
  };

  return (
    <div>
      {state.loading && <p>Processing...</p>}
      {state.error && <p>Error: {state.error}</p>}
      <button onClick={handleSendTip}>Send Tip</button>
    </div>
  );
}
```

## Client API

### Tip Management

```typescript
// Create a tip (initial step)
const tip = await client.createTip({
  creatorId: string;
  amount: number;
  message?: string;
});

// Get tip status
const tip = await client.getTipStatus(tipId);

// Get transaction history
const history = await client.getTransactionHistory({
  page: 1,
  pageSize: 10,
});

// Get tips received by creator
const creatorTips = await client.getCreatorTipsReceived(creatorId, {
  page: 1,
  pageSize: 20,
});
```

### Stellar Transaction Building

```typescript
// Build unsigned transaction for frontend signing
const { transactionEnvelope, tipId, fee } = await client.buildPaymentTransaction(tipId, {
  senderPublicKey: 'GAA...',
  creatorPublicKey: 'GAB...',
  amount: '100',
  assetCode: 'USDC', // optional
  assetIssuer: 'GA...', // optional
});

// Submit signed transaction to network
const { transactionHash, status } = await client.submitPaymentTransaction(tipId, {
  transactionEnvelope: signedXdr,
});

// Check confirmation status on Horizon
const confirmed = await client.checkTransactionConfirmation(tipId);
```

### Wallet Management

```typescript
// Generate nonce for wallet verification
const { nonce } = await client.generateNonce(publicKey);

// Get challenge transaction (sign this with Freighter)
const challenge = await client.getChallenge(nonce);

// Verify wallet signature and link to account
const wallet = await client.verifyWallet(publicKey, nonce, signedChallenge);

// List user's verified wallets
const wallets = await client.listWallets();

// Unlink wallet
await client.unlinkWallet(walletId);

// Get wallet balance
const balance = await client.getWalletBalance(walletId);
```

## React Hooks

### DorisioProvider

```typescript
<DorisioProvider client={client} config={client.getConfig()}>
  <YourApp />
</DorisioProvider>
```

**Context provides:**

- `client`: DorisioClient instance
- `auth`: Authentication state
- `error`: Global error state
- `isLoading`: Global loading state
- `setError()`, `clearError()`: Error management
- `setIsLoading()`: Loading state management

### useCreateTip

```typescript
const {
  createTip,
  buildTransaction,
  submitTransaction,
  confirmTransaction,
  state: { loading, error, step, data },
} = useCreateTip();
```

**Steps:** `idle` → `creating` → `building` → `submitting` → `confirming` → `success`

### useWallet

```typescript
const {
  generateNonce,
  getChallenge,
  verifyWallet,
  listWallets,
  selectWallet,
  unlinkWallet,
  renameWallet,
  getBalance,
  wallets,
  selectedWallet,
  loading,
  error,
} = useWallet();
```

### useCreatorBalance

```typescript
const {
  fetchBalance,
  refetch,
  balance: { totalEarnings, pendingBalance, lumens, usdc },
  loading,
  error,
} = useCreatorBalance(creatorId);
```

### useTransactionHistory

```typescript
const {
  fetchHistory,
  transactions,
  total,
  page,
  pageSize,
  goToPage,
  nextPage,
  prevPage,
  setPageSize,
  loading,
  error,
} = useTransactionHistory({ page: 1, pageSize: 10 });
```

## Platform Configuration

The SDK is platform-agnostic and can be integrated into any platform with a REST API.

### Required Endpoints

Your backend must implement these endpoints (as specified in backend documentation):

```
POST   /api/v1/transactions/tip
GET    /api/v1/transactions/:id
GET    /api/v1/transactions/history
GET    /api/v1/transactions/creator/:creatorId
PATCH  /api/v1/transactions/:id/status
POST   /api/v1/transactions/:id/build
POST   /api/v1/transactions/:id/submit
GET    /api/v1/transactions/:id/confirm

POST   /api/v1/wallet/nonce
GET    /api/v1/wallet/challenge/:nonce
POST   /api/v1/wallet/verify
GET    /api/v1/wallet/list
DELETE /api/v1/wallet/:walletId
PATCH  /api/v1/wallet/:walletId/name
GET    /api/v1/wallet/:walletId/balance
```

### Wallet Verification Flow

The SDK implements a secure challenge-response flow:

1. **Generate Nonce**: `POST /api/v1/wallet/nonce` → get random nonce
2. **Get Challenge**: `GET /api/v1/wallet/challenge/{nonce}` → get transaction to sign
3. **Sign Challenge**: User signs with Freighter wallet (frontend)
4. **Verify Signature**: `POST /api/v1/wallet/verify` → backend verifies and links wallet

See `DECOUPLING_VERIFICATION.md` for platform integration examples.

## Authentication

The SDK uses bearer token authentication:

```typescript
const client = new DorisioClient({
  baseUrl: 'https://api.example.com',
  token: 'your-jwt-or-bearer-token',
});

// Update token
client.setToken('new-token');

// Clear token
client.clearToken();
```

## Error Handling

```typescript
try {
  const tip = await client.createTip({
    creatorId: 'creator-123',
    amount: 100,
  });
} catch (error) {
  console.error('Error creating tip:', error.message);
}
```

React hooks provide error state:

```typescript
const { error, setError, clearError } = useDorisio();

if (error) {
  console.error(`[${error.code}] ${error.message}`);
}
```

## Advanced Configuration

```typescript
import { setConfig } from 'dorisio-sdk';

setConfig({
  apiUrl: 'https://api.example.com',
  timeout: 60000,
  retryAttempts: 3,
  retryDelay: 2000,
  debug: true,
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests (86 tests: 46 client + 40 hooks)
npm run test

# Watch mode for development
npm run test:watch

# Build SDK
npm run build

# Watch mode build
npm run dev

# Lint
npm run lint

# Type check
npm run type-check
```

**Test Coverage:**

- Client methods: All auth, creator, and transaction methods with success/error scenarios
- React hooks: All hooks with state management, pagination, error handling
- 100% test success rate

## Publishing

```bash
npm publish
```

This publishes as `dorisio-sdk@0.1.0` with:

- Main export: `dist/index.js`
- React export: `dist/react/index.js`
- TypeScript types included

## License

MIT
