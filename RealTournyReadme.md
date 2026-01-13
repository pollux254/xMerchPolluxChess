PolluxChess Tournament README: Real Players Mode with Supabase and Xahau Integration
This README provides a comprehensive plan for implementing the "Real Players Tournament" feature in PolluxChess. It focuses on the "join via hooks" section for paid entry fees, using Supabase as the off-chain database for UI synchronization and Xahau Hooks for on-chain validation, escrow, and prize distribution. The free bot mode remains unchanged.
This plan is designed for Claude AI (or similar) to execute step-by-step in VS Code. Each section includes CLI commands where applicable. Assume the repo is cloned at https://github.com/pollux254/xMerchPolluxChess and all env vars/secrets (Supabase URL/key, Vercel, Xahau testnet/mainnet endpoints) are already set up perfectly—no deletions or major changes to existing Supabase schemas unless explicitly added.
Important Notes:

Test everything on Xahau Testnet first (toggle via env var NEXT_PUBLIC_XAHAU_NETWORK=testnet).
Use Hooks Builder for Hook deployment/testing.
If errors occur (e.g., state limits, TX failures), debug with Xahau Explorer and add traces to Hook code.
No changes to free bot play—keep it isolated.

1. Project Overview
PolluxChess allows real-money chess tournaments (2, 4, 8, or 16 players) with entry fees in multiple currencies (XRP, XAH, EVR, FUZZY, PLX, RLUSD). Funds/NFTs are escrowed in a Xahau Hook, moves validated on-chain, prizes distributed trustlessly (winner-takes-all after 11% platform fee). Supabase mirrors on-chain state for fast UI (waiting rooms, game boards). Webhooks from Xaman/Xahau trigger DB updates.
Key Flows:

User selects tournament (size, fee, currency) → Pays via Xaman (Payment TX to Hook with memo for room ID).
Hook validates → Adds to room state → Emits success → Webhook updates Supabase → UI shows waiting room.
Room fills → Hook starts tournament, deducts fee.
Moves: Invoke TX with chess notation → Hook validates.
Timeout (10 min): External cron submits Refund Invoke.
Win: Hook emits prizes/NFTs.

Tech Stack:

Frontend: Next.js/React (existing, on Vercel).
Database: Supabase (tables for tournaments, players, logs).
Blockchain: Xahau (Hook in C, XRPL.js for client-side interactions).
Tools: Xaman for signing, webhooks for sync.

2. Architecture Diagram
(Claude: Generate this as ASCII art or use a tool like Draw.io if needed; for now, describe in text.)
textUI (Next.js/Vercel) <-> Supabase (DB + Real-time Channels + Webhooks)
  ^                     ^
  |                     |
  v                     v
Xaman (TX Signing) -> Xahau Ledger (Hook: Validate/Escrow/Distribute)
  ^ 
  | (External Cron for Timeouts: Vercel Cron Job)

Off-Chain (Supabase): Handles UI state (waiting rooms, player lists). Listens to webhooks for TX confirmations.
On-Chain (Hook): Truth source. Stores rooms in namespaces (e.g., hash("PLX_2_10_ROOM4")) with keys like "PLAYERS", "STATUS", "NFTS".

3. Supabase Setup
Extend existing schemas—no deletions. Add fields for Hook integration.
Step-by-Step for Claude:

Open VS Code terminal: cd supabase (or root if no subdir).
Install Supabase CLI if needed: npm install -g supabase (assume already done).
Login to Supabase: supabase login (use your credentials).
Link project: supabase link --project-ref YOUR_PROJECT_REF (from Supabase dashboard).

Schema Updates (SQL via Supabase Studio or CLI):

Run in Supabase SQL Editor or CLI: supabase db remote commit after changes.

SQL-- Add to 'tournaments' table (if not exists)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS hook_namespace TEXT,  -- Hex string of namespace hash (e.g., 'abc123...')
ADD COLUMN IF NOT EXISTS room_id INTEGER,     -- Room number (e.g., 4)
ADD COLUMN IF NOT EXISTS expected_amount JSONB,  -- { "value": 10, "currency": "PLX", "issuer": "rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q" }
ADD COLUMN IF NOT EXISTS entry_tx_hashes TEXT[],  -- Array of TX hashes for entries
ADD COLUMN IF NOT EXISTS status_synced_from_hook TEXT;  -- e.g., 'waiting', 'full', 'in_progress'

-- New table for hook logs (for debugging)
CREATE TABLE IF NOT EXISTS hook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  status TEXT,  -- 'success', 'rejected'
  error TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- New table for NFTs (optional deposits)
CREATE TABLE IF NOT EXISTS tournament_nfts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id),
  uri_token_id TEXT,  -- On-chain URI
  depositor_address TEXT,
  status TEXT DEFAULT 'deposited'  -- 'deposited', 'awarded', 'refunded'
);

-- Enable real-time on new/updated tables
ALTER PUBLICATION supabase_realtime ADD TABLE hook_logs, tournament_nfts;

Push changes: supabase db push.

4. Xahau Hook Development
Deploy a Hook to handle escrow, validation, and distribution. Use C code (your existing examples as base).
Step-by-Step for Claude:

Create/update Hook C file: In VS Code, open/create hooks/chess_hook.c.
Compile/test: Use Hooks Builder online (manual step; copy-paste code).
Deploy: From Hooks Builder, deploy to testnet Hook account (fund it with test XAH).
Set env: Add NEXT_PUBLIC_HOOK_ADDRESS=rYourHookAddress to .env.

Sample Hook C Code Outline (Extend your existing; do not overwrite. Add traces for debug.)
C#include "hookapi.h"

// Define namespaces via SHA512 half (util_sha512h)
#define NS_LEN 32
uint8_t ns[NS_LEN];

// Keys (32-byte hashes)
#define KEY_PLAYERS SBUF("PLAYERS")  // Array of addresses
#define KEY_STATUS SBUF("STATUS")    // 'waiting', 'full', etc.
#define KEY_NFTS SBUF("NFTS")        // Array of URITokenIDs
#define KEY_PRIZE_POOL SBUF("PRIZE_POOL")
#define GLOBAL_NEXT_ROOM SBUF("NEXT_ROOM")  // Global counter

int64_t hook(int64_t reserved) {
    // Get incoming TX type
    int64_t tx_type = otxn_type();

    if (tx_type == ttPAYMENT) {
        // Parse Amount, Memo
        uint8_t amount_buf[48];
        int64_t amount_len = otxn_field(SBUF(amount_buf), sfAmount);
        // Check currency/issuer match (from memo-parsed expected)
        // If mismatch: rollback(SBUF("Invalid currency"));

        // Parse memo for room (e.g., JSON: {"room": "PLX_2_10_ROOM4"})
        // Generate namespace: util_sha512h(ns, NS_LEN, memo_room, memo_len);

        // Add player to state[ns][KEY_PLAYERS]
        // Update prize pool

        // If room full: deduct 11% (emit Payment to dev addr), set STATUS 'full', emit start event

        accept(SBUF("Entry accepted"), 0);
    } else if (tx_type == ttURITOKEN_BUY) {  // For NFT deposits
        // Parse memo for room, add to NFTS
        accept(SBUF("NFT deposited"), 0);
    } else if (tx_type == ttINVOKE) {  // For moves, refunds, etc.
        // Parse memo for action (e.g., "move: e4", "refund")
        // Validate chess move (integrate simple chess logic or external lib if possible)
        // For timeout Invoke: refund all (emit Payments/NFTTransfers)
    }

    rollback(SBUF("Invalid TX"), 1);
    return 0;
}

Multi-Currency: In otxn_field, extract currency (3 bytes) + issuer (20 bytes), compare to room's expected.
Memos: Use otxn_json or manual parse for room ID/action.
Prizes/Refunds: Use etxn_reserve, etxn_details to emit Payments/NFTTransfers.
Moves: Memo with FEN/notation; validate legality/checkmate.

5. UI Updates
Update existing pages for Hook integration (e.g., waiting-room.tsx, page.tsx).
Step-by-Step for Claude:

Open VS Code: code .
Install deps if needed: npm install xrpl.js (for Xahau RPC; Xahau uses XRPL-compatible libs).
Update files as below.

Updates to page.tsx (Tournament Selection):

Add Hook-based join: Replace placeholder handlePayFeeHook with real logic.

tsximport { Client } from 'xrpl';  // For Xahau RPC

async function handlePayFeeHook() {
  const client = new Client(process.env.NEXT_PUBLIC_XAHAU_RPC);  // e.g., 'wss://xahau-test.net'
  await client.connect();

  // Generate memo with room (from Supabase or dynamic)
  const memo = { tournament: `${selectedAsset.currency}_${selectedSize}_${selectedFee}_ROOM${nextRoom}` };

  // Prepare Payment TX to Hook address
  const tx = {
    TransactionType: 'Payment',
    Amount: { value: selectedFee.toString(), currency: selectedAsset.currency, issuer: selectedAsset.issuer },
    Destination: process.env.NEXT_PUBLIC_HOOK_ADDRESS,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(memo)).toString('hex') } }]
  };

  // Sign via Xaman (existing logic)
  // On success, poll Supabase for update
}
Updates to waiting-room.tsx:

Add Hook state polling (optional for debug; use account_namespace via xrpl.js).
Listen for real-time updates via Supabase channels (existing).

6. Webhooks and Integration
Supabase webhooks listen to Xaman/Xahau for TX status.
Step-by-Step:

Create webhook in Supabase: Functions → New Edge Function.
Name: xahau-webhook.
Code: Handle POST from Xaman (TX status), update DB if success.


TypeScript// supabase/functions/xahau-webhook/index.ts
Deno.serve(async (req) => {
  const { tx_hash, status } = await req.json();
  if (status === 'success') {
    // Update tournaments table (e.g., add tx_hash, sync status)
    const { error } = await supabase.from('tournaments').update({ status_synced_from_hook: 'confirmed' }).eq('some_id', id);
  }
  return new Response('OK');
});

Deploy: supabase functions deploy xahau-webhook.
Set Xaman to POST to your webhook URL.

Timeout Cron:

Use Vercel Cron (vercel.json):

JSON{
  "crons": [
    { "path": "/api/timeout-check", "schedule": "*/1 * * * *" }  // Every min
  ]
}

API route: /api/timeout-check.ts – Query Supabase for waiting rooms >10 min old, submit Invoke TX to Hook for refunds.

7. Deployment

Build: npm run build.
Deploy to Vercel: vercel deploy --prod.
Deploy Hook: Manual via Hooks Builder.
Test end-to-end: Create tournament, pay, wait, play moves.

8. Testing and Error Handling

Test Cases: Invalid currency (reject), room fill (fee deduct), timeout (refund), NFT deposit/award.
Errors: State overflow → Split namespaces; TX fail → Poll ledger.
Debug: Use Xahau Explorer for TX/state; Supabase logs for webhooks.

This completes the plan. Implement step-by-step, fixing errors as they arise. If needed, expand with more code snippets.