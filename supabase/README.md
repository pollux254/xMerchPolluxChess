# Supabase Edge Functions (Xahau) for xBase (Donate Form)

This template keeps all Xaman secrets in Supabase Vault. Your Next.js app (and Docker/Evernode container) only needs the public Supabase URL + anon key to call these functions.

## Prerequisites
- Supabase project + CLI installed (`npm i -g supabase`)
- Supabase project linked: `supabase link --project-ref <YOUR_PROJECT_REF>`

## Configure Secrets (required)
Set these once per project:
```bash
supabase secrets set \
  XUMM_API_KEY=your_xaman_app_key \
  XUMM_API_SECRET=your_xaman_app_secret \
  XAH_DESTINATION=your_xahau_raddress \
  SB_URL=https://<your-project>.supabase.co \
  SB_SERVICE_ROLE_KEY=your_service_role_key # optional; needed if writing donation rows
```

## Deploy Functions
```bash
supabase functions deploy xaman-createPayload
supabase functions deploy xaman-webhook --no-verify-jwt
```

## Required env in Next.js
Add to `.env.local` (and production env):
```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
```

## What they do
- `xaman-createPayload`: builds a Xahau payment payload using your secrets (no secrets in the container). Sets webhook to the Supabase function.
- `xaman-webhook`: verifies signed transactions with Xaman API and optionally stores a donation record in Supabase (if `SUPABASE_SERVICE_ROLE_KEY` is set).
