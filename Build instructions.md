Build instructions · MD
Copy

# 🪝 Xahau Chess Wagering Hook - Build Instructions

## 📋 Overview
This is a decentralized chess tournament system using Xahau Hooks for trustless wagering. The Hook handles all financial operations and game validation on-chain, while Supabase tracks player stats and game history off-chain.

---

## 🎯 System Architecture

### ON-CHAIN (Xahau Hook)
- Entry fee payments & escrow
- Full chess move validation
- Tournament bracket management
- Prize distribution (11% platform fee)
- Time control enforcement (20 min per player)

### OFF-CHAIN (Supabase)
- Player profiles (wallet address = player ID)
- Ranked stats (real money games)
- Practice stats (bot games) - **separate from ranked**
- Game history & PGN records
- Leaderboards

---

## ✅ Final Requirements

### 1. **Full Chess Engine Validation**
- ALL moves validated on-chain using complete chess engine
- Must fit within 64KB Hook code limit
- Required validations:
  - Piece movement rules (pawn, knight, bishop, rook, queen, king)
  - Check detection
  - Checkmate detection
  - Stalemate detection
  - Castling (kingside & queenside)
  - En passant capture
  - Pawn promotion
  - Material counting for tiebreaks

### 2. **Platform Fee: 11%**
- Applied when tournament starts (not on cancellation)
- Deducted from total prize pool before distribution

**Example (8-player, 100 XAH entry):**
```
Total Pool: 800 XAH
Platform Fee (11%): 88 XAH
Prize Pool: 712 XAH

Distribution:
- 1st: 427.20 XAH (60%)
- 2nd: 213.60 XAH (30%)
- 3rd: 71.20 XAH (10%)
```

### 3. **Game Outcomes & Tiebreaker**

**NO DRAW OFFERS** (conflicts with bracket progression):
- Players CANNOT offer draws
- Players can only resign
- Material tiebreaker only applies to forced draws

**Possible Game Endings:**
1. **Checkmate** → Winner obvious
2. **Resignation** → Opponent wins
3. **Time Forfeit** → Opponent wins (see time control below)
4. **Forced Draw** (stalemate/repetition/50-move) → Material count decides winner

**Material Tiebreaker (when forced draw occurs):**
```
Material Values:
- Pawn = 1
- Knight = 3
- Bishop = 3
- Rook = 5
- Queen = 9
- King = 0 (doesn't count)

LOWER material = Winner (better position management)

Example:
Player 1: K + R + 2P = 0 + 5 + 2 = 7 points
Player 2: K + N + 3P = 0 + 3 + 3 = 6 points
Winner: Player 2 (6 < 7)

True Tie (same material): Split prize 50/50 (ONLY on final game)
```

**IMPORTANT:** Material tiebreaker splitting ONLY applies to the final/championship game. During bracket matches, if truly tied on material, use arbitrary tiebreak (e.g., white wins).

### 4. **Time Control: 20 Minutes Per Player**

**Timing Rules:**
- Each player gets 20 minutes total
- Total game time: 40 minutes maximum
- Time tracked on-chain via Hook
- Automatic loss if time expires

**Implementation:**
```c
Player Time Remaining = 20 minutes (1200 seconds)

On each move:
  elapsed = current_time - last_move_time
  current_player_time -= elapsed
  
  if (current_player_time <= 0) {
    // Automatic loss by time
    winner = opponent
    result_type = TIME_FORFEIT
  }
```

**Frontend Display:**
- Show both player clocks
- Update in real-time
- Visual warning when < 1 minute remaining
- Auto-submit time forfeit when clock hits 0

### 5. **Tournament Fill Timer: 10 Minutes**

**Rules:**
- Tournament created → 10-minute countdown starts
- If fills within 10 min → Start tournament
- If doesn't fill → Cancel & refund ALL players (no fee charged)

**Implementation:**
```c
if (current_time - tournament.created_at > 600 seconds) {
  if (tournament.player_count < tournament.size) {
    // Cancel tournament
    for each player {
      refund(player, entry_fee); // 100% refund
    }
    tournament.status = CANCELLED;
  }
}
```

### 6. **Separate Stats for Bot vs Ranked**

**Two Independent Stat Systems:**

```typescript
// Ranked Stats (real money)
ranked_stats: {
  total_games: number,
  wins: number,
  losses: number,
  draws: number,
  elo_rating: number,
  rank: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond",
  total_wagered: number,
  total_won: number,
  net_profit: number
}

// Practice Stats (bot games)
practice_stats: {
  total_games: number,
  wins: number,
  losses: number,
  draws: number,
  practice_elo: number,
  practice_rank: "Beginner" | "Intermediate" | "Advanced" | "Expert"
}
```

**Profile Display:**
- Show both stat categories separately
- "Ranked Stats" tab for real money games
- "Practice Stats" tab for bot games
- Main leaderboard shows only ranked stats
- Optional practice leaderboard for fun

---

## 🛠️ Implementation Tasks for Cline

### Phase 1: Hook Core Structure

**File:** `hooks/chess-wagering.c`

**Tasks:**
1. Set up Hook skeleton
   - Include Xahau Hook headers
   - Define state structures
   - Implement hook() entry point

2. Define data structures:
```c
// Tournament (max 200 bytes)
typedef struct {
    uint8_t id[32];
    uint64_t entry_fee;
    uint8_t currency[3];
    uint8_t size; // 2, 4, 8, 16
    uint8_t player_count;
    uint8_t players[16][20];
    uint64_t prize_pool;
    uint64_t created_at;
    uint8_t status;
} Tournament;

// Match (max 300 bytes)
typedef struct {
    uint8_t id[32];
    uint8_t tournament_id[32];
    uint8_t player1[20];
    uint8_t player2[20];
    uint64_t player1_time_left; // milliseconds
    uint64_t player2_time_left;
    uint64_t last_move_time;
    ChessBoard board;
    uint8_t winner[20];
    uint8_t result_type;
    uint8_t status;
} Match;

// Chess Board (minimal, ~12 bytes with bitboards)
typedef struct {
    uint64_t pieces[6]; // Bitboards for each piece type
    uint8_t en_passant;
    uint8_t castling;
    uint8_t to_move;
    uint8_t halfmove;
} ChessBoard;
```

3. Implement transaction handlers:
   - `handle_join()` - Accept entry fee, add player
   - `handle_move()` - Validate and execute move
   - `handle_resign()` - Player resignation
   - `handle_cancel_check()` - Check tournament timeouts

### Phase 2: Chess Engine Implementation

**File:** `hooks/chess-engine.c`

**Tasks:**
1. Board representation using bitboards
2. Move generation (only validation, not full generation)
3. Legal move checker:
   - `is_valid_pawn_move()`
   - `is_valid_knight_move()`
   - `is_valid_bishop_move()`
   - `is_valid_rook_move()`
   - `is_valid_queen_move()`
   - `is_valid_king_move()`
   - `is_valid_castling()`
   - `is_valid_en_passant()`

4. Game state checkers:
   - `is_in_check()`
   - `is_checkmate()`
   - `is_stalemate()`
   - `is_insufficient_material()`
   - `is_threefold_repetition()`
   - `is_fifty_move_rule()`

5. Material counter:
```c
uint8_t count_material(ChessBoard* board, uint8_t color) {
    // Count: Pawn=1, Knight=3, Bishop=3, Rook=5, Queen=9
    // Return total material value
}
```

6. Move executor:
```c
void make_move(ChessBoard* board, Move move) {
    // Update board state
    // Handle captures
    // Update castling rights
    // Update en passant square
    // Switch turn
}
```

### Phase 3: Prize Distribution Logic

**File:** `hooks/prize-distribution.c`

**Tasks:**
1. Implement prize calculation:
```c
void distribute_prizes(Tournament* t) {
    // Deduct 11% platform fee
    uint64_t fee = (t->prize_pool * 11) / 100;
    send_payment(PLATFORM_ACCOUNT, fee);
    
    uint64_t remaining = t->prize_pool - fee;
    
    // Distribution based on tournament size
    switch(t->size) {
        case 2: // 1v1
            send_payment(first_place, remaining);
            break;
        case 4: // 4-player
            send_payment(first, remaining * 70 / 100);
            send_payment(second, remaining * 30 / 100);
            break;
        case 8: // 8-player
            send_payment(first, remaining * 60 / 100);
            send_payment(second, remaining * 30 / 100);
            send_payment(third, remaining * 10 / 100);
            break;
        case 16: // 16-player
            send_payment(first, remaining * 50 / 100);
            send_payment(second, remaining * 25 / 100);
            send_payment(third, remaining * 15 / 100);
            send_payment(fourth, remaining * 10 / 100);
            break;
    }
}
```

2. Handle material tiebreaks:
```c
void resolve_draw(Match* m) {
    uint8_t p1_mat = count_material(&m->board, 0);
    uint8_t p2_mat = count_material(&m->board, 1);
    
    if (p1_mat < p2_mat) {
        m->winner = m->player1;
    } else if (p2_mat < p1_mat) {
        m->winner = m->player2;
    } else {
        // True tie - check if final game
        if (is_final_game(m)) {
            // Split prize 50/50
            split_prize(m);
        } else {
            // Bracket game - arbitrary tiebreak (white wins)
            m->winner = m->player1;
        }
    }
}
```

### Phase 4: Time Control Implementation

**File:** `hooks/time-control.c`

**Tasks:**
1. Initialize player clocks:
```c
void init_match_clocks(Match* m) {
    m->player1_time_left = 1200000; // 20 minutes in milliseconds
    m->player2_time_left = 1200000;
    m->last_move_time = ledger_time();
}
```

2. Update time on move:
```c
void update_clock(Match* m, uint8_t player) {
    uint64_t now = ledger_time();
    uint64_t elapsed = now - m->last_move_time;
    
    if (player == 0) { // White
        if (elapsed >= m->player1_time_left) {
            m->player1_time_left = 0;
            // Time forfeit - black wins
            m->winner = m->player2;
            m->result_type = TIME_FORFEIT;
            end_match(m);
        } else {
            m->player1_time_left -= elapsed;
        }
    } else { // Black
        if (elapsed >= m->player2_time_left) {
            m->player2_time_left = 0;
            // Time forfeit - white wins
            m->winner = m->player1;
            m->result_type = TIME_FORFEIT;
            end_match(m);
        } else {
            m->player2_time_left -= elapsed;
        }
    }
    
    m->last_move_time = now;
}
```

### Phase 5: Frontend Integration

**File:** `app/chess/page.tsx`

**Tasks:**
1. Update "Join via Hook" button:
```typescript
async function handlePayFeeHook() {
    // Create transaction to Hook account
    const tx = {
        TransactionType: "Payment",
        Account: playerID,
        Destination: HOOK_ACCOUNT,
        Amount: (selectedFee * 1000000).toString(), // drops
        Memos: [{
            Memo: {
                MemoData: stringToHex(`JOIN:${tournamentId}`)
            }
        }]
    };
    
    // Sign with Xaman
    const payload = await createXamanPayload(tx);
    // ... existing Xaman flow
}
```

2. Poll Hook state for tournament status:
```typescript
async function pollHookState(tournamentId: string) {
    const interval = setInterval(async () => {
        const state = await queryHookState(tournamentId);
        
        if (state.status === "active") {
            // Tournament started
            clearInterval(interval);
            redirectToGame();
        } else if (state.status === "cancelled") {
            // Tournament cancelled, refunded
            clearInterval(interval);
            showCancelledMessage();
        }
    }, 2000); // Poll every 2 seconds
}
```

3. Implement time display:
```typescript
// In game board component
const [player1Time, setPlayer1Time] = useState(1200); // 20 minutes
const [player2Time, setPlayer2Time] = useState(1200);

useEffect(() => {
    const timer = setInterval(() => {
        if (currentTurn === "player1") {
            setPlayer1Time(prev => {
                if (prev <= 0) {
                    // Time ran out - submit forfeit
                    submitTimeForfeit();
                    return 0;
                }
                return prev - 1;
            });
        } else {
            setPlayer2Time(prev => {
                if (prev <= 0) {
                    submitTimeForfeit();
                    return 0;
                }
                return prev - 1;
            });
        }
    }, 1000);
    
    return () => clearInterval(timer);
}, [currentTurn]);

// Display
Player 1: {formatTime(player1Time)}
Player 2: {formatTime(player2Time)}
```

4. Remove draw offer button:
```typescript
// DELETE this button from game UI:
// Offer Draw

// Keep only:
Resign
```

### Phase 6: Backend Oracle Updates

**File:** `api/oracle/game-watcher.ts`

**Tasks:**
1. Listen for Hook events:
```typescript
async function watchHookEvents() {
    const ws = new WebSocket(XAHAU_WSS);
    
    ws.on('message', async (data) => {
        const event = JSON.parse(data);
        
        if (event.type === 'MATCH_COMPLETE') {
            // Update Supabase stats
            await updatePlayerStats(event.winner, event.loser);
        }
    });
}
```

2. Update player stats after game:
```typescript
async function updatePlayerStats(winnerId: string, loserId: string, gameType: 'ranked' | 'practice') {
    const table = gameType === 'ranked' ? 'ranked_stats' : 'practice_stats';
    
    // Update winner
    await supabase
        .from(table)
        .update({
            total_games: sql`total_games + 1`,
            wins: sql`wins + 1`,
            elo_rating: calculateNewElo(winner.elo, loser.elo, 1)
        })
        .eq('wallet_address', winnerId);
    
    // Update loser
    await supabase
        .from(table)
        .update({
            total_games: sql`total_games + 1`,
            losses: sql`losses + 1`,
            elo_rating: calculateNewElo(loser.elo, winner.elo, 0)
        })
        .eq('wallet_address', loserId);
}
```

### Phase 7: Database Schema Updates

**File:** `supabase/migrations/add_separate_stats.sql`

**Tasks:**
1. Create separate stats tables:
```sql
-- Ranked stats (real money)
CREATE TABLE ranked_stats (
    wallet_address TEXT PRIMARY KEY,
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    elo_rating INT DEFAULT 1200,
    rank TEXT DEFAULT 'Bronze',
    total_wagered DECIMAL(20,6) DEFAULT 0,
    total_won DECIMAL(20,6) DEFAULT 0,
    net_profit DECIMAL(20,6) DEFAULT 0,
    highest_win DECIMAL(20,6) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice stats (bot games)
CREATE TABLE practice_stats (
    wallet_address TEXT PRIMARY KEY,
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    practice_elo INT DEFAULT 1200,
    practice_rank TEXT DEFAULT 'Beginner',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game history with type indicator
ALTER TABLE games ADD COLUMN game_type TEXT NOT NULL DEFAULT 'ranked';
ALTER TABLE games ADD COLUMN time_control_used BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX idx_ranked_elo ON ranked_stats(elo_rating DESC);
CREATE INDEX idx_practice_elo ON practice_stats(practice_elo DESC);
CREATE INDEX idx_games_type ON games(game_type);
```

---

## 🚀 Build & Deploy Steps

### Step 1: Compile Hook
```bash
cd hooks/
make clean
make chess-wagering.wasm
```

### Step 2: Test on Xahau Testnet
```bash
# Deploy hook to testnet account
xahau-cli deploy-hook \
    --account rTestAccount... \
    --hook chess-wagering.wasm

# Test entry fee payment
xahau-cli send-payment \
    --from rPlayer1... \
    --to rHookAccount... \
    --amount 10 \
    --memo "JOIN:tournament_123"
```

### Step 3: Frontend Testing
```bash
npm run dev
# Test flow:
# 1. Connect wallet
# 2. Click "Join via Hook"
# 3. Sign Xaman transaction
# 4. Verify tournament state updates
```

### Step 4: Integration Testing
```bash
# Run full tournament flow:
# - 8 players join
# - Tournament starts
# - Play games
# - Verify prize distribution
# - Check stats updates (ranked vs practice)
```

---

## 📚 Required Reading for Cline

**Before starting, read these files in order:**

1. `/mnt/user-data/outputs/xahau-hooks-planning.md` - Initial planning
2. `/mnt/user-data/outputs/hybrid-architecture-final.md` - Architecture details
3. `/mnt/user-data/outputs/final-requirements.md` - Detailed specifications
4. This `README.md` - Build instructions

**Reference Documentation:**
- Xahau Hooks Docs: https://docs.xahau.network/
- Xahau Hook Examples: https://github.com/Xahau/xahau-hooks
- Chess Programming Wiki: https://www.chessprogramming.org/

---

## ⚠️ Critical Implementation Notes

### 1. **No Draw Offers**
- Remove any UI for offering draws
- Only forced draws (stalemate, etc.) trigger material tiebreaker
- Players can only resign voluntarily

### 2. **Time Control is Mandatory**
- Every match has 20-min-per-player limit
- Automatic loss on time expiration
- Time tracked on-chain by Hook

### 3. **Material Splitting Only on Finals**
- Bracket games with true material tie: arbitrary winner (white)
- Final/championship game with true material tie: split prize 50/50

### 4. **Stats Must Be Separate**
- Bot games NEVER affect ranked stats
- Completely independent ELO systems
- Different leaderboards

### 5. **11% Fee Applied at Start**
- Fee deducted when tournament begins
- NOT applied on cancellations/refunds
- Sent to platform account immediately

---

## 🐛 Testing Checklist

- [ ] Entry fee payment accepted
- [ ] Tournament fills and starts
- [ ] Tournament cancels after 10 min if not filled
- [ ] All players refunded on cancellation
- [ ] Legal moves accepted
- [ ] Illegal moves rejected
- [ ] Checkmate detection works
- [ ] Stalemate detection works
- [ ] Time forfeit triggers correctly
- [ ] Material tiebreaker calculates correctly
- [ ] Prize distribution correct (11% fee deducted)
- [ ] Ranked stats update after real money game
- [ ] Practice stats update after bot game
- [ ] Stats remain separate (no crossover)
- [ ] Player can't leave mid-game without forfeit
- [ ] Player redirected to game on refresh
- [ ] Platform fee sent to correct account

---

## 📝 Known Challenges

### Challenge 1: Chess Engine in 64KB
**Solution:** Use bitboard representation, minimal move validation (not generation)

### Challenge 2: Threefold Repetition Detection
**Solution:** Store last 10 position hashes (~80 bytes), check for repeats

### Challenge 3: Hook State Size Limits
**Solution:** Store only current board state, not full move history

### Challenge 4: Gas Costs
**Solution:** Optimize state reads/writes, batch updates where possible

---

## 🎯 Success Criteria

**Hook is complete when:**
1. ✅ Accepts entry fees correctly
2. ✅ Validates all chess moves accurately
3. ✅ Enforces time controls (20 min/player)
4. ✅ Detects all game endings (checkmate, stalemate, resign, time)
5. ✅ Applies material tiebreaker correctly
6. ✅ Distributes prizes with 11% fee
7. ✅ Cancels and refunds unfilled tournaments
8. ✅ All integration tests pass

**Frontend is complete when:**
1. ✅ "Join via Hook" sends real transactions
2. ✅ Displays live tournament status from Hook
3. ✅ Shows player clocks counting down
4. ✅ Prevents leaving during active games
5. ✅ Auto-redirects to games on refresh
6. ✅ NO draw offer button visible

**Backend is complete when:**
1. ✅ Listens for Hook events
2. ✅ Updates ranked stats after real money games
3. ✅ Updates practice stats after bot games
4. ✅ Keeps stats completely separate
5. ✅ Stores full game history with PGN

---

## 🔄 Iterative Development Process

**After Cline builds first version:**
1. Test on Xahau testnet
2. Document bugs/issues
3. Update this README with fixes
4. Cline implements fixes
5. Repeat until stable

**This README will be updated with:**
- Bug fixes
- Performance improvements
- New edge cases discovered
- Optimization techniques

---

## 🚀 Ready to Build!

Cline, please read all referenced documents, then begin implementation starting with Phase 1 (Hook Core Structure). Ask questions if any requirements are unclear!