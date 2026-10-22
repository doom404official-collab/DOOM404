# DOOM404 Wallet Signal

Version: v0.1

## Local and Codex Cloud setup

From the repository root:

```sh
cd mvp/wallet-signal
npm install --no-audit --no-fund
npm run build
npm start
```

The application `.npmrc` uses a writable `.npm-cache` directory in the
application workspace, so installation does not require a writable home directory
or a manual `--cache` override. The cache is excluded from Git.

Run the offline tests with `node --test tests/*.test.mjs`. These tests use mock
RPC responses; do not run the live diagnostic scripts for offline verification.

DOOM404 Wallet Signal is an experimental Solana wallet analytics prototype.

## MVP

Input:
- Public Solana wallet address

Analysis:
- Latest 100 transactions
- Basic wallet/account information

Signals:
- Activity
- Diversification
- Trading
- Maturity

## Principles

- Explainable signals
- Public blockchain data only
- No wallet connection required
- No private keys
- No transaction signing
- No smart contract required
- No "safe", "scam", or investment verdicts

## Status

MVP development started.
