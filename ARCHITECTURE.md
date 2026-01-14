# 🏗️ Xahau Chess Wagering - UPDATED Architecture

## 🎯 System Overview

This is a **hybrid architecture** that uses:
1. **Xahau Hooks** - On-chain game validation and prize distribution
2. **Supabase** - Backend database, edge functions, and oracle
3. **Next.js (Vercel)** - Frontend application
4. **Xaman Wallet** - User authentication and transaction signing

---

## 📊 Architecture Layers

### Layer 1: Frontend (Next.js on Vercel)
**Location:** `/app`, `/lib`

**Responsibilities:**
- User interface (tournament lobby, game board, profile)
- Xaman wallet integration
- Real-time game state display
- API calls to Supabase Edge Functions

**Key Files:**
- `app/page.tsx` - Main tournament lobby
- `app/game/[matchId]/page.tsx` - Chess game interface
- `lib/xahau-payload.ts` - Transaction payload builder

### Layer 2: Backend (Supabase)
**Location:** `/supabase`

#### A. Database Schema (`/supabase/migrations`)
Stores:
- Player profiles (wallet address = player ID)
- Tournament state (off-chain tracking)
- Match history
- Player stats (ranked vs practice)
- Game moves (PGN format)

#### B. Edge Functions (`/supabase/functions`)
Orchestrates between frontend and blockchain:
- `xaman-createPayload/` - Creates Xahau transaction payloads
- `xaman-webhook/` - Receives Xaman transaction events
- `chess-oracle/` - Watches Xahau ledger for Hook events
- `match-manager/` - Manages game state transitions

#### C. Oracle Service (Edge Function)
Watches Xahau ledger and syncs with Supabase:
- Monitors Hook state changes
- Updates match status when moves are confirmed
- Triggers prize distribution records
- Updates player stats

### Layer 3: Blockchain (Xahau Network)
**Location:** `/hooks` (C code compiled to WASM)

**Responsibilities:**
- Entry fee escrow
- Full chess move validation
- Time control enforcement
- Checkmate/stalemate detection
- Prize distribution (11% platform fee)

**Important:** The Hook is the **source of truth** for:
- Move legality
- Game outcomes
- Prize amounts
- Tournament status

---

## 🔄 Complete Flow Example: "Join Tournament"

### Step 1: User Clicks "Join Tournament"
```typescript
// Frontend (Next.js)
const joinTournament = async (tournamentId: string) => {
  // Call Supabase Edge Function
  const { data } = await supabase.functions.invoke('xaman-createPayload', {
    body: {
      action: 'JOIN',
      tournamentId,
      amount: 100 // XAH
    }
  });
  
  // Open Xaman wallet
  window.open(data.nextUrl, '_blank');
};
```

### Step 2: Supabase Edge Function Creates Payload
```typescript
// /supabase/functions/xaman-createPayload/index.ts
const payload = {
  TransactionType: 'Payment',
  Account: userWallet,
  Destination: HOOK_ACCOUNT,
  Amount: '100000000', // drops
  Memos: [{
    Memo: {
      MemoData: hex('JOIN:' + tournamentId)
    }
  }]
};

// Send to Xaman API
const response = await fetch('https://xumm.app/api/v1/platform/payload', {
  method: 'POST',
  headers: { 'X-API-Key': XAMAN_KEY },
  body: JSON.stringify(payload)
});

return response.json(); // { nextUrl, uuid, qrUrl }
```

### Step 3: User Signs in Xaman
- Xaman displays transaction details
- User approves payment
- Transaction submitted to Xahau ledger

### Step 4: Xahau Hook Processes Transaction
```c
// /hooks/chess-wagering.c
int64_t hook(uint32_t reserved) {
  // Parse memo: "JOIN:tournament_id"
  // Verify payment amount
  // Load tournament state
  // Add player to tournament
  // If full → start tournament, create matches
  // Save updated state
  // Emit event: "TOURNAMENT_JOINED"
}
```

### Step 5: Xaman Webhook Notifies Supabase
```typescript
// /supabase/functions/xaman-webhook/index.ts
export default async (req: Request) => {
  const { meta, payload_uuidv4 } = await req.json();
  
  if (meta.signed) {
    // Transaction was signed
    // Update database: mark user as "pending join"
    await supabase.from('tournament_players').insert({
      tournament_id: tournamentId,
      wallet_address: payload.Account,
      status: 'pending'
    });
  }
};
```

### Step 6: Oracle Confirms On-Chain State
```typescript
// /supabase/functions/chess-oracle/index.ts (runs every 5 seconds)
async function watchHookState() {
  // Query Xahau ledger for Hook state
  const hookState = await xrpl.getAccountObjects(HOOK_ACCOUNT);
  
  // Parse tournament state from Hook
  const tournament = parseTournamentState(hookState);
  
  // Sync with Supabase
  await supabase.from('tournaments').upsert({
    id: tournament.id,
    player_count: tournament.player_count,
    status: tournament.status,
    prize_pool: tournament.prize_pool,
    updated_at: new Date()
  });
  
  // If tournament started, create match records
  if (tournament.status === 'ACTIVE') {
    await createMatchRecords(tournament);
  }
}
```

### Step 7: Frontend Updates in Real-Time
```typescript
// Frontend subscribes to Supabase real-time
useEffect(() => {
  const subscription = supabase
    .channel('tournaments')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'tournaments' },
      (payload) => {
        setTournament(payload.new);
      }
    )
    .subscribe();
    
  return () => subscription.unsubscribe();
}, []);
```

---

## 🗄️ Database Schema (Supabase)

### Table: `tournaments`
```sql
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  entry_fee DECIMAL(20,6) NOT NULL,
  size INTEGER NOT NULL,
  player_count INTEGER DEFAULT 0,
  prize_pool DECIMAL(20,6) DEFAULT 0,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  hook_state JSONB -- Full Hook state for verification
);
```

### Table: `tournament_players`
```sql
CREATE TABLE tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT REFERENCES tournaments(id),
  wallet_address TEXT NOT NULL,
  position INTEGER, -- Placement (1st, 2nd, 3rd)
  prize_amount DECIMAL(20,6),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `matches`
```sql
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES tournaments(id),
  player1_wallet TEXT NOT NULL,
  player2_wallet TEXT NOT NULL,
  player1_time_left INTEGER, -- milliseconds
  player2_time_left INTEGER,
  board_state JSONB, -- FEN or full board state
  winner TEXT,
  result_type TEXT, -- checkmate, resignation, time_forfeit, material
  status TEXT DEFAULT 'pending',
  move_count INTEGER DEFAULT 0,
  last_move_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `moves`
```sql
CREATE TABLE moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT REFERENCES matches(id),
  move_number INTEGER NOT NULL,
  player TEXT NOT NULL,
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  piece TEXT NOT NULL,
  promotion TEXT,
  is_capture BOOLEAN DEFAULT false,
  is_check BOOLEAN DEFAULT false,
  is_checkmate BOOLEAN DEFAULT false,
  time_remaining INTEGER, -- Player's time after move
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `ranked_stats`
```sql
CREATE TABLE ranked_stats (
  wallet_address TEXT PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1200,
  rank TEXT DEFAULT 'Bronze',
  total_wagered DECIMAL(20,6) DEFAULT 0,
  total_won DECIMAL(20,6) DEFAULT 0,
  net_profit DECIMAL(20,6) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `practice_stats`
```sql
CREATE TABLE practice_stats (
  wallet_address TEXT PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  practice_elo INTEGER DEFAULT 1200,
  practice_rank TEXT DEFAULT 'Beginner',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 Edge Functions Overview

### 1. `xaman-createPayload`
**Purpose:** Create Xahau transaction payloads for Xaman wallet

**Endpoints:**
- `JOIN` - Join tournament
- `MOVE` - Submit chess move
- `RESIGN` - Resign from match
- `CHECK_TIMEOUT` - Check for time expiration

**Example:**
```typescript
const payload = await supabase.functions.invoke('xaman-createPayload', {
  body: { action: 'MOVE', matchId, from: 'e2', to: 'e4' }
});
```

### 2. `xaman-webhook`
**Purpose:** Receive transaction events from Xaman

**Handles:**
- Transaction signed/rejected
- Transaction successful/failed
- Updates database accordingly

### 3. `chess-oracle` (NEW)
**Purpose:** Watch Xahau ledger and sync Hook state to Supabase

**Runs:** Every 5 seconds (configurable)

**Tasks:**
- Query Hook state from Xahau
- Compare with Supabase state
- Update tournaments, matches, and player stats
- Emit notifications for state changes

### 4. `match-manager` (NEW)
**Purpose:** Manage game flow and state transitions

**Tasks:**
- Initialize new matches
- Validate move submissions
- Check time controls
- Handle resignations
- Record game outcomes

---

## 🎮 Game Flow State Machine

```
TOURNAMENT CREATED (Supabase)
    ↓
[Players join via Xaman]
    ↓
TOURNAMENT STARTED (Hook confirms)
    ↓
[Oracle creates match records in Supabase]
    ↓
MATCH IN PROGRESS
    ↓
[Players submit moves via Xaman]
    ↓
[Hook validates on-chain]
    ↓
[Oracle updates Supabase]
    ↓
[Frontend displays updated board]
    ↓
MATCH COMPLETE (checkmate/resign/time/material)
    ↓
[Hook distributes prizes]
    ↓
[Oracle updates stats]
    ↓
TOURNAMENT COMPLETE
```

---

## 🚀 Deployment Architecture

### Production Setup:
1. **Frontend:** Vercel (auto-deploy from GitHub)
2. **Database:** Supabase (PostgreSQL)
3. **Edge Functions:** Supabase (globally distributed)
4. **Hook:** Xahau Mainnet

### Environment Variables:

**Vercel (.env.production):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_XAHAU_NETWORK_ID=21337
NEXT_PUBLIC_HOOK_ACCOUNT=rHookAccount...
```

**Supabase Secrets:**
```bash
supabase secrets set \
  XUMM_API_KEY=your_key \
  XUMM_API_SECRET=your_secret \
  XAHAU_WSS=wss://xahau.network \
  HOOK_ACCOUNT=rHookAccount...
```

---

## 💡 Key Design Decisions

### Why Supabase Edge Functions?
✅ Keep Xaman secrets secure (not in frontend)
✅ Globally distributed (low latency)
✅ Serverless (scales automatically)
✅ Built-in database connection

### Why Oracle Service?
✅ Hook state is source of truth
✅ Supabase syncs for frontend queries
✅ Enables real-time UI updates
✅ Maintains move history

### Why Separate Stats Tables?
✅ Bot games don't affect ranked ELO
✅ Cleaner leaderboards
✅ Better data integrity

---

## 🧪 Development Workflow

### Local Development:
```bash
# 1. Start Supabase locally
supabase start

# 2. Run database migrations
supabase db reset

# 3. Start Next.js dev server
pnpm dev

# 4. Test edge functions locally
supabase functions serve
```

### Testing Flow:
1. Create mock tournament in Supabase
2. Use Xaman testnet for transactions
3. Watch Oracle logs for state updates
4. Verify frontend updates in real-time

---

## 📚 Next Steps

This architecture document replaces the Hook-centric approach with a **Supabase-centric** one where:
- Hook handles **validation and money**
- Supabase handles **state and history**
- Frontend handles **UI and interactions**

Ready to build Phase 1 with this architecture! 🚀
