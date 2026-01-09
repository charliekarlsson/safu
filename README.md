# SAFU Auth Protocol (Solana micro-transaction login)

Open-source reference implementing a signing-free authentication pattern on Solana by asking users to send a tiny SOL transfer to a one-time recipient. Components:

- Backend listener + API (Node/TypeScript, Express, @solana/web3.js)
- Frontend demo (React + Vite + TypeScript) with dark/pixel theme
- Shared types for payloads

## Quick start

1. Install pnpm (v9+) if missing.
2. Install deps: `pnpm install`.
3. Run backend dev server: `pnpm dev:backend`.
4. Run frontend dev server: `pnpm dev:frontend`.

## Deploy to Railway (backend)

Railway can build the backend via the provided Dockerfile.

Steps:
- Create a new Railway service from this repo, choose Docker deployment.
- Set environment variables (see .env.example): `SOLANA_RPC`, `MIN_LAMPORTS`, `CHALLENGE_TTL_MS`, `JWT_SECRET`, `SOLANA_COMMITMENT`, `PORT` (use 8787 or Railway `$PORT`).
- Exposed port: 8787.
- Build & run: Dockerfile already runs `pnpm -r build` and starts `pnpm --filter backend start`.

If you prefer Nixpacks instead of Docker, set:
- Root: repository root
- Install command: `npm install -g pnpm && pnpm install`
- Build command: `pnpm -r build`
- Start command: `pnpm --filter backend start`

## Hosted / multi-tenant usage

- Developers can sign up via `/api/dev/signup` (email/password demo) to receive a project-scoped API key and defaults (min lamports, TTL, commitment, optional webhook URL).
- Use `x-api-key: <key>` on `POST /api/challenge` to mint challenges tied to your project config.
- `GET /api/poll-auth?id=...` remains public for clients to poll status.
- Rotate keys with `POST /api/dev/rotate-key` (Bearer dev token).
- Optional webhook: include `webhookUrl` on signup or per-challenge body to receive `challenge.consumed` POST payloads `{ challengeId, projectId, userPubkey, txSignature, amountLamports, receivedLamports, status }`.

## Security notes

- Ephemeral recipients are single-use; challenges expire after TTL (default 5 minutes) and enforce a min lamport amount (default 10,000 lamports).
- Listener verifies recipient, amount, and expiry before issuing a JWT bound to the sender pubkey; transaction signature is recorded for audit.
- Avoid arbitrary signing prompts entirely; users only perform a standard SOL transfer.
- Store `JWT_SECRET` securely; rotate it if compromised.

## Concept

Instead of message signing, users send a micro-transfer (e.g., 0.00001 SOL) to a fresh recipient. The backend matches the transfer, validates amount and expiry, and issues a session bound to the sender wallet.

## Repo layout

- packages/backend — API, listener, session issuance
- packages/frontend — Landing + login demo UI
- packages/shared — Types shared by client/server

See backend and frontend READMEs for details.
