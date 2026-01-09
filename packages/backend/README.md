# Backend (SAFU Auth)

Express + @solana/web3.js reference backend for micro-transaction login.

## Run

```bash
pnpm install
pnpm dev:backend
```

Environment variables (optional):
- `PORT` (default 8787)
- `SOLANA_RPC` (default https://api.devnet.solana.com)
- `MIN_LAMPORTS` (default 10000)
- `CHALLENGE_TTL_MS` (default 300000)
- `JWT_SECRET` (default change-me)
- `SOLANA_COMMITMENT` (default confirmed)

## API
- `POST /api/challenge` -> `{ id, recipient, amountLamports, expiresAt }`
- `GET /api/poll-auth?id=...` -> `{ status: pending|authenticated|expired|not_found, sessionToken?, userPubkey?, txSignature? }`

## Listener
A websocket log listener watches for SOL transfers to ephemeral recipients, validates amount/expiry, marks challenge consumed, and issues a JWT bound to the sender pubkey.
