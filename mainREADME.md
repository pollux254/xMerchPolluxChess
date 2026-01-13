# PolluxChess / xMerch — Wallet Login + Network (Testnet/Mainnet) Guide

This repo includes a **Xaman wallet login** flow and a **network configuration** that lets developers run against **Xahau Testnet** for safe testing, while keeping deployment to **Mainnet** straightforward.

## Goals of this doc

1) Explain the **main wallet login** (Xaman SignIn) so anyone can debug it.
2) Provide a **testnet dev setup** so you can safely test new updates.
3) Document a **future toggle** plan (UI switch) so you can flip between networks without rebuilds.

---

## 1) Main Wallet Login (Xaman SignIn)

The **Connect with Xaman** button uses a standard Xaman **SignIn** payload.

### Where it lives

- UI: `app/chess/page.tsx` → `handleLogin()`
- API route: `app/api/auth/xaman/create-signin/xahau-signin/route.ts`
- Supabase Edge Function (preferred in prod): `supabase/functions/xaman-signinPayload/index.ts`

### How it works

1. Frontend calls:
   - `POST /api/auth/xaman/create-signin/xahau-signin`

2. Backend behavior:
   - If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist, it proxies to the **Supabase Edge Function** `xaman-signinPayload`.
   - Otherwise it falls back to local env credentials via the Xumm SDK.

3. Frontend opens the returned `nextUrl`:
   - Mobile: deep-link into Xaman
   - Desktop: popup window

4. Frontend listens to `websocketUrl` until signed.

5. After signing, frontend fetches the payload details from:
   - `POST /api/auth/xaman/get-payload/xahau-payload`

6. The wallet address is stored client-side (`localStorage.playerID`) and also used to create a Supabase anonymous session.

---

## 2) Network Configuration (current)

Right now the UI selects testnet vs mainnet using an **env var** (no UI toggle yet).

### Current env var used by the UI

These pages use:

- `NEXT_PUBLIC_XAHAU_NETWORK` (`testnet` or `mainnet`)

Files:

- `app/chess/page.tsx`
- `app/waiting-room/page.tsx`

### RPC URLs

- **Testnet**: `wss://xahau-test.net:51234`
- **Mainnet**: `wss://xahau.network:51234`

### Hook address selection (UI pages)

- If `NEXT_PUBLIC_HOOK_ADDRESS` is set, it will be used.
- Otherwise, **testnet** falls back to:
  - `r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY`
- Mainnet fallback is blank until you deploy/set a mainnet Hook.

---

## 3) Recommended Dev Setup (Testnet)

### Step A — Create `.env.local`

```bash
cp env.example .env.local
```

### Step B — Set env vars

Edit `.env.local`:

```bash
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"

# IMPORTANT: for dev testing
NEXT_PUBLIC_XAHAU_NETWORK="testnet"

# Optional override (if not set, UI falls back to the testnet hook below)
# NEXT_PUBLIC_HOOK_ADDRESS="r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY"
```

> Note: `env.example` currently does **not** include `NEXT_PUBLIC_XAHAU_NETWORK` yet. It’s still supported by the code (`app/chess/page.tsx`, `app/waiting-room/page.tsx`), so you can safely add it to `.env.local` as shown above.

### Step C — Run

```bash
pnpm dev
```

Notes:

- `NEXT_PUBLIC_*` values are bundled into the browser build; after changing them, restart `pnpm dev`.

---

## 4) Production / Mainnet Setup

In your hosting provider (Vercel env vars, Docker build-time env, etc.), set:

```bash
NEXT_PUBLIC_XAHAU_NETWORK="mainnet"
NEXT_PUBLIC_HOOK_ADDRESS="<MAINNET_HOOK_ADDRESS>"  # when available
```

---

## 5) Planned/Future: UI Toggle (Testnet ⇄ Mainnet)

To make it easy to test new updates on testnet and then deploy to mainnet, the future toggle should:

- Store choice in `localStorage`:
  - key: `network-mode`
  - values: `testnet` | `mainnet`
- Use selection precedence:

1. **localStorage override**
2. `NEXT_PUBLIC_XAHAU_NETWORK` fallback
3. Default to `testnet`

Example selection logic:

```ts
const envNetwork = process.env.NEXT_PUBLIC_XAHAU_NETWORK
const saved = typeof window !== "undefined" ? localStorage.getItem("network-mode") : null
const network = (saved || envNetwork || "testnet") as "testnet" | "mainnet"
```

This approach lets you:

- Keep production default on mainnet.
- Still flip to testnet on-demand (or gate the toggle behind a dev-only flag).

---

## 6) Important note about `lib/xahau-hooks.ts`

The file `lib/xahau-hooks.ts` currently hardcodes:

- `XAHAU_WSS = 'wss://xahau.network'`

Meaning: hook reads/writes in that library are **mainnet-only** until refactored.

If you want hooks to respect testnet vs mainnet, refactor the library to accept `rpcUrl`/`network` as an argument, or build a small `getRpcUrl(network)` helper.

---

## Quick sanity checklist

- [ ] Xaman SignIn works (wallet address is returned and stored)
- [ ] Dev uses `NEXT_PUBLIC_XAHAU_NETWORK=testnet`
- [ ] Hook address is correct for the network
- [ ] Production uses `NEXT_PUBLIC_XAHAU_NETWORK=mainnet` and a deployed mainnet Hook (when ready)
