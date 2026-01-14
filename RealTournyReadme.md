# PolluxChess Tournament README: Real Players Mode with Supabase and Xahau Integration - UPDATED

This README provides a comprehensive plan for implementing the "Real Players Tournament" feature in PolluxChess. It focuses on the "join via hooks" section for paid entry fees, using Supabase as the off-chain database for UI synchronization and Xahau Hooks for on-chain validation, escrow, and prize distribution. The free bot mode remains unchanged.

This plan is designed for Claude AI (or similar) to execute step-by-step in VS Code. Each section includes CLI commands where applicable. Assume the repo is cloned at https://github.com/pollux254/xMerchPolluxChess and all env vars/secrets (Supabase URL/key, Vercel, Xahau testnet/mainnet endpoints) are already set up perfectly—no deletions or major changes to existing Supabase schemas unless explicitly added.

**Important Notes:**
- Test everything on Xahau Testnet first (toggle via env var `NEXT_PUBLIC_XAHAU_NETWORK=testnet`).
- Use Hooks Builder for Hook deployment/testing.
- If errors occur (e.g., state limits, TX failures), debug with Xahau Explorer and add traces to Hook code.
- No changes to free bot play—keep it isolated.

---

## 1. Project Overview

PolluxChess allows real-money chess tournaments (2, 4, 8, or 16 players) with entry fees in multiple currencies (XRP, XAH, EVR, FUZZY, PLX, RLUSD). Funds/NFTs are escrowed in a Xahau Hook, moves validated on-chain, prizes distributed trustlessly (winner-takes-all after 11% platform fee). Supabase mirrors on-chain state for fast UI (waiting rooms, game boards). Webhooks from Xaman/Xahau trigger DB updates.

### Tournament Format
- **Single Elimination:** Lose once = out!
- **2 players:** 1 game (final)
- **4 players:** 2 rounds (semifinals → final)
- **8 players:** 3 rounds (quarterfinals → semifinals → final)
- **16 players:** 4 rounds (round of 16 → quarterfinals → semifinals → final)

### Key Flows

1. **User selects tournament** (size, fee, currency) → Pays via Xaman (Payment TX to Hook with memo for room ID).
2. **Hook validates** → Adds to room state → Emits success → Webhook updates Supabase → UI shows waiting room.
3. **Room fills** → Hook starts tournament, deducts 11% fee.
4. **Moves:** Invoke TX with chess notation → Hook validates.
5. **Timeout (10 min waiting):** External cron submits Refund Invoke.
6. **Win:** Hook emits prizes/NFTs.

### Tech Stack

- **Frontend:** Next.js/React (existing, on Vercel)
- **Database:** Supabase (tables for tournaments, players, logs)
- **Blockchain:** Xahau (Hook in C, XRPL.js for client-side interactions)
- **Tools:** Xaman for signing, webhooks for sync

---

## 2. Architecture Diagram

```
UI (Next.js/Vercel) <-> Supabase (DB + Real-time Channels + Webhooks)
  ^                     ^
  |                     |
  v                     v
Xaman (TX Signing) -> Xahau Ledger (Hook: Validate/Escrow/Distribute)
  ^ 
  | (External Cron for Timeouts: Vercel Cron Job)
```

**Off-Chain (Supabase):** Handles UI state (waiting rooms, player lists, game boards, timers). Listens to webhooks for TX confirmations.

**On-Chain (Hook):** Truth source. Stores rooms in namespaces (e.g., `hash("PLX_2_10_ROOM4")`) with keys like `"PLAYERS"`, `"STATUS"`, `"NFTS"`, `"GAME_STATE"`.

---

## 3. Game Rules & Time Controls

### Time Controls
- **20 minutes per player** (40 minutes total per game)
- **Turn-based countdown:** Clock runs ONLY when it's your turn. Pauses during opponent's turn.
- **First move rule:** If a player doesn't make their first move within **5 minutes**, they automatically forfeit (opponent wins).
- **Time forfeit:** If your clock reaches 0:00 at any point, you automatically lose.

### Material Tiebreaker (for draws)
If a game ends in a forced draw (stalemate, repetition, 50-move rule, insufficient material), we use a material tiebreaker:

**Material values:**
- Pawn = 1
- Knight = 3
- Bishop = 3
- Rook = 5
- Queen = 9

**Tiebreaker rule:** **Higher total material value wins** (better position = more pieces remaining).

**Example:**
- Player A: Queen + Rook = 9 + 5 = 14 points
- Player B: Two Bishops + Knight = 3 + 3 + 3 = 9 points
- **Player A wins** (14 > 9)

**Edge case:** If both players have exactly the same material value in the final game, the prize is split 50/50.

---

## 4. Supabase Setup

Extend existing schemas—no deletions. Add fields for Hook integration and game state management.

### Step-by-Step for Claude

1. Open VS Code terminal: `cd supabase` (or root if no subdir).
2. Install Supabase CLI if needed: `npm install -g supabase` (assume already done).
3. Login to Supabase: `supabase login` (use your credentials).
4. Link project: `supabase link --project-ref YOUR_PROJECT_REF` (from Supabase dashboard).

### Schema Updates

Run in Supabase SQL Editor or CLI: `supabase db remote commit` after changes.

```sql
-- Add to 'tournaments' table (if not exists)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS hook_namespace TEXT,  -- Hex string of namespace hash (e.g., 'abc123...')
ADD COLUMN IF NOT EXISTS room_id INTEGER,     -- Room number (e.g., 4)
ADD COLUMN IF NOT EXISTS expected_amount JSONB,  -- { "value": 10, "currency": "PLX", "issuer": "rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q" }
ADD COLUMN IF NOT EXISTS entry_tx_hashes TEXT[],  -- Array of TX hashes for entries
ADD COLUMN IF NOT EXISTS status_synced_from_hook TEXT,  -- e.g., 'waiting', 'full', 'in_progress', 'completed'
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,  -- Track bracket round
ADD COLUMN IF NOT EXISTS bracket_structure JSONB;  -- Store bracket matchups

-- New table for individual games within tournaments
CREATE TABLE IF NOT EXISTS tournament_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id),
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player_white UUID REFERENCES tournament_players(id),
  player_black UUID REFERENCES tournament_players(id),
  status TEXT DEFAULT 'waiting',  -- 'waiting', 'in_progress', 'completed'
  winner UUID REFERENCES tournament_players(id),
  game_state JSONB,  -- { fen, moves, captured_pieces, timers }
  white_time_remaining INTEGER DEFAULT 1200,  -- 20 minutes in seconds
  black_time_remaining INTEGER DEFAULT 1200,
  last_move_at TIMESTAMP,
  first_move_made BOOLEAN DEFAULT false,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result_reason TEXT,  -- 'checkmate', 'timeout', 'resign', 'draw', 'forfeit'
  created_at TIMESTAMP DEFAULT NOW()
);

-- New table for hook logs (for debugging)
CREATE TABLE IF NOT EXISTS hook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  tournament_id UUID REFERENCES tournaments(id),
  player_address TEXT,
  action TEXT,  -- 'entry', 'move', 'timeout', 'complete'
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
  status TEXT DEFAULT 'deposited',  -- 'deposited', 'awarded', 'refunded'
  awarded_to TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable real-time on new/updated tables
ALTER PUBLICATION supabase_realtime ADD TABLE hook_logs, tournament_nfts, tournament_games;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_games_tournament ON tournament_games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_status ON tournament_games(status);
CREATE INDEX IF NOT EXISTS idx_hook_logs_tournament ON hook_logs(tournament_id);
```

Push changes: `supabase db push`

---

## 5. Xahau Hook Development

Deploy a Hook to handle escrow, validation, and distribution. Use C code (your existing examples as base).

### Step-by-Step for Claude

1. Create/update Hook C file: In VS Code, open/create `hooks/chess_hook.c`.
2. Compile/test: Use Hooks Builder online (manual step; copy-paste code).
3. Deploy: From Hooks Builder, deploy to testnet Hook account (fund it with test XAH).
4. Set env: Add `NEXT_PUBLIC_HOOK_ADDRESS=rYourHookAddress` to `.env`.

### Sample Hook C Code Outline

(Extend your existing; do not overwrite. Add traces for debug.)

```c
#include "hookapi.h"

// Define namespaces via SHA512 half (util_sha512h)
#define NS_LEN 32
uint8_t ns[NS_LEN];

// Keys (32-byte hashes)
#define KEY_PLAYERS SBUF("PLAYERS")  // Array of addresses
#define KEY_STATUS SBUF("STATUS")    // 'waiting', 'full', 'in_progress', 'completed'
#define KEY_NFTS SBUF("NFTS")        // Array of URITokenIDs
#define KEY_PRIZE_POOL SBUF("PRIZE_POOL")
#define KEY_GAME_STATE SBUF("GAME_STATE")  // FEN string + move history
#define KEY_TIMERS SBUF("TIMERS")  // Player timers
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
    } else if (tx_type == ttINVOKE) {  // For moves, refunds, game completion
        // Parse memo for action (e.g., "move: e2e4", "resign", "timeout")
        
        // For moves:
        // - Validate chess move legality
        // - Update game state (FEN)
        // - Update timers
        // - Check for checkmate/stalemate/draw
        // - If game ends, calculate tiebreaker if needed
        
        // For timeout/first-move-forfeit:
        // - Check timer or first move status
        // - Declare winner, advance bracket
        
        // For tournament completion:
        // - Emit prize payment to winner
        // - Update status to 'completed'
    }

    rollback(SBUF("Invalid TX"), 1);
    return 0;
}
```

**Key Features:**
- **Multi-Currency:** Extract currency (3 bytes) + issuer (20 bytes), compare to room's expected.
- **Memos:** Use `otxn_json` or manual parse for room ID/action.
- **Prizes/Refunds:** Use `etxn_reserve`, `etxn_details` to emit Payments/NFTTransfers.
- **Moves:** Memo with FEN/notation; validate legality/checkmate.
- **Timers:** Track turn-based countdown, enforce 5-minute first move rule.
- **Material Tiebreaker:** Calculate remaining pieces, compare totals (higher wins).

---

## 6. UI Updates

Update existing pages for Hook integration and game board display.

### Step-by-Step for Claude

1. Open VS Code: `code .`
2. Install deps: `npm install chess.js react-chessboard xrpl`
3. Update files as below.

### New Page: `/app/game-multiplayer/page.tsx`

```tsx
// Real-time multiplayer chess game
// Features: Turn-based timer, move validation, resign, real-time sync
```

**Key Features:**
- Load game from `tournament_games` table via `tournamentId` + `matchNumber` query params
- Display chess board using `react-chessboard`
- Validate moves with `chess.js`
- Show timer for each player (countdown only on their turn)
- Real-time move sync via Supabase channels
- Detect checkmate/stalemate/timeout
- Resign button
- First move 5-minute warning

### Updates to `/app/chess/page.tsx`

(Already done - just document)

### Updates to `/app/waiting-room/page.tsx`

- Show bracket structure when tournament fills
- Display current round/match
- Auto-redirect to `/game-multiplayer` when match starts

---

## 7. Webhooks and Integration

Supabase webhooks listen to Xaman/Xahau for TX status and update game state.

### Webhook: `supabase/functions/xaman-webhook/index.ts`

(Already implemented - handles entry payments)

### New Webhook: `supabase/functions/game-move-webhook/index.ts`

```typescript
// Handle move transactions
// Update tournament_games table
// Check for game completion
// Trigger prize distribution if tournament complete
```

### Timeout Cron

Use Vercel Cron (`vercel.json`):

```json
{
  "crons": [
    { "path": "/api/timeout-check", "schedule": "*/1 * * * *" },  // Every min
    { "path": "/api/first-move-check", "schedule": "*/30 * * * * *" }  // Every 30 sec
  ]
}
```

**API routes:**
- `/api/timeout-check.ts` — Query games where timer = 0, declare winner
- `/api/first-move-check.ts` — Query games where first move not made in 5 min, forfeit

---

## 8. Deployment

1. **Build:** `npm run build`
2. **Deploy to Vercel:** `vercel deploy --prod`
3. **Deploy Hook:** Manual via Hooks Builder
4. **Deploy Edge Functions:** `supabase functions deploy xaman-webhook game-move-webhook`
5. **Test end-to-end:** Create tournament, pay, wait, play moves, test timeout/resign

---

## 9. Testing and Error Handling

### Test Cases
- ✅ Invalid currency (reject)
- ✅ Room fill (11% fee deduct)
- ✅ Timeout (refund if waiting room, forfeit if in game)
- ✅ First move timeout (5 min forfeit)
- ✅ NFT deposit/award
- ✅ Checkmate detection
- ✅ Material tiebreaker calculation
- ✅ Timer pause/resume on turn change
- ✅ Resign functionality
- ✅ Bracket advancement

### Errors
- **State overflow** → Split namespaces
- **TX fail** → Poll ledger
- **Debug:** Use Xahau Explorer for TX/state; Supabase logs for webhooks

---

## 10. Next Steps

**Phase 1 (Current):** Basic multiplayer game with timer
**Phase 2:** Prize distribution automation via Hook
**Phase 3:** Stats tracking (ELO, leaderboard)
**Phase 4:** Profile pages, match history
**Phase 5:** Advanced features (chat, spectate, replays)

---

This completes the updated plan. Implement step-by-step, fixing errors as they arise.
