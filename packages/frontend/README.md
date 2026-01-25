# Frontend (SAFU Auth)

Static HTML/CSS with a small vanilla TypeScript controller for the Solana micro-transaction auth flow. Vite is used only for local dev and bundling; no React runtime remains.

## Run locally

```bash
pnpm install
pnpm -C packages/frontend dev --host 0.0.0.0 --port 5173
```

The dev server proxies `/api` to `http://localhost:8787` so the backend keeps working.

## Build

```bash
pnpm -C packages/frontend build
```

## Configuration
- `VITE_API_BASE` (optional): backend URL, e.g., `https://safuauth-backend-production.up.railway.app`. Defaults to same-origin `/api`.

## What’s inside
- Static sections for hero, product highlights, FAQ.
- API snippets (fetch + curl) that update when you supply an API key or webhook URL.
- Live challenge preview: creates challenges, polls authentication status, and shows the resulting session token.
- Developer auth form: sign up / log in, refresh user data, and rotate API keys.
